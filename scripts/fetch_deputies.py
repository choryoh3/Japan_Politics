#!/usr/bin/env python3
"""
副大臣・大臣政務官の名簿を日本語版 Wikipedia から取得・解析し、JSON を標準出力へ出す。

開発者が手元で 1 回だけ実行するための道具。CI・テスト・seed からは呼ばない。
出力（JSON）を見て、packages/db/src/cabinet-deputies-data.ts を更新する。
使い方: python3 -I scripts/fetch_deputies.py > deputies.json
よみがなは、各人物のページ冒頭「氏名（よみがな、生年月日…）」から機械的に取る。取れなければ null。
"""
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

API = "https://ja.wikipedia.org/w/api.php"
UA = "research-client"
CABINETS = {"第1次高市内閣": "2025-10-22", "第2次高市内閣": "2026-02-19"}
SECTIONS = {"副大臣": 6, "大臣政務官": 7}


def call(params):
    """MediaWiki API を呼び JSON を返す。空応答のときは数回やり直す。"""
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    for attempt in range(8):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as res:
                body = res.read()
            if body:
                return json.loads(body)
        except Exception as err:  # noqa: BLE001 - 取得の失敗は再試行する
            print("retry:", err, file=sys.stderr)
        time.sleep(10 * (attempt + 1))  # 429 のときは待ってからやり直す
    raise RuntimeError("取得できませんでした: " + url)


def link_text(cell):
    """セルから (表示名, リンク先) を取り出す。リンクが無ければリンク先は None。"""
    m = re.search(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", cell)
    if m:
        return (m.group(2) or m.group(1)).strip(), m.group(1).strip()
    return re.sub(r"<[^>]+>|'''", "", cell.split("|")[-1]).strip(), None


def parse_table(wikitext, default_post=None):
    """表を行ごとに読み、(役職名, 氏名, リンク先) の一覧を返す。rowspan の役職名は引き継ぐ。"""
    out = []
    post = default_post
    # 「|-」の行（style 付きや末尾に空白があるものを含む）で行を区切る。その行自体は捨てる
    for row in re.split(r"\n\|-[^\n]*", wikitext)[1:]:
        cells = [c for c in row.split("\n") if c and c[0] in "!|"]
        cells = [c for c in cells if not c.startswith("|}")]
        if not cells:
            continue
        if cells[0].startswith("!"):
            post = link_text(re.sub(r"^!\s*(rowspan=\"?\d+\"?\s*\|)?", "", cells[0]))[0]
            cells = cells[1:]
        if not cells:
            continue
        name_cell = re.sub(r"^\|\s*(style=\"[^\"]*\"\s*\|)?", "", cells[0])
        name, target = link_text(name_cell)
        out.append((post, name, target))
    return out


def main():
    result = {"cabinets": {}, "kana": {}}
    targets = {}
    for cabinet, date in CABINETS.items():
        entries = []
        for kind, idx in SECTIONS.items():
            d = call({"action": "parse", "page": cabinet, "prop": "wikitext", "section": idx})
            for post, name, target in parse_table(d["parse"]["wikitext"]["*"]):
                entries.append({"kind": kind, "post": post, "name": name, "date": date})
                if target:
                    targets.setdefault(unicodedata.normalize("NFC", name), target)
        result["cabinets"][cabinet] = entries
    names = sorted({unicodedata.normalize("NFC", e["name"]) for es in result["cabinets"].values() for e in es})
    # 負荷を減らすため、タイトルを 10 件ずつまとめて問い合わせる
    for i in range(0, len(names), 10):
        chunk = names[i : i + 10]
        titles = [targets.get(n, n) for n in chunk]
        d = call({"action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1,
                  "exlimit": 10, "redirects": 1, "titles": "|".join(titles)})
        # 正規化・リダイレクトで変わったタイトルを元に戻す対応表
        moved = {}
        for key in ("normalized", "redirects"):
            for r in d["query"].get(key, []):
                moved[r["from"]] = r["to"]
        by_title = {p["title"]: p.get("extract", "") for p in d["query"]["pages"].values()}
        for name, title in zip(chunk, titles):
            t = moved.get(title, title)
            t = moved.get(t, t)
            text = by_title.get(t, "")
            m = re.match(r"^[^（(]{1,20}[（(]([ぁ-ゖー ・]+)[、,）)]", text)
            kana = m.group(1).replace(" ", "").replace("・", "") if m else None
            result["kana"][name] = {"kana": kana, "title": title, "head": text[:60]}
        time.sleep(3)
    json.dump(result, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
