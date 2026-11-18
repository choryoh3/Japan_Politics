#!/usr/bin/env python3
"""ハーネス用ドキュメントの機械チェック（プロジェクト非依存）。

検証対象:
  docs/project.md              プロジェクト設定（種別・起動方法・検証コマンド）
  docs/spec.md                 製品仕様書
  docs/sprints/sprint-N.md     スプリント計画と契約
  docs/sprints/sprint-N-eval.md Evaluator の判定記録

使い方:
  python3 scripts/validate_docs.py            # docs/ 配下をすべて検証（CI・手動）
  python3 scripts/validate_docs.py FILE...    # 指定ファイルを検証
  python3 scripts/validate_docs.py --hook     # Claude Code の PostToolUse フック（stdin の JSON を読む）
  python3 scripts/validate_docs.py --verdict N  # Sprint N の最新判定（PASS/FAIL/NONE）を標準出力へ

違反があれば内容を stderr に出して終了コード 2 を返す（フックでは書いたエージェントに差し戻される）。
閾値は docs/project.md の「ハーネス設定」で上書きできる（下記 OVERRIDES 参照）。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PROJECT_RE = re.compile(r"docs/project\.md$")
SPRINT_RE = re.compile(r"docs/sprints/sprint-\d+\.md$")
EVAL_RE = re.compile(r"docs/sprints/sprint-\d+-eval\.md$")
SPEC_RE = re.compile(r"docs/spec\.md$")

SPEC_HEADINGS = ["概要", "ターゲットユーザー", "機能一覧", "非目標", "技術スタック"]
PROJECT_TYPES = ["web-ui", "api", "cli", "library", "other"]

# 既定の閾値。docs/project.md の `- 機能数: 2-4` `- 契約項目数: 5-15` で上書きできる。
DEFAULTS = {"features": (2, 4), "contract": (5, 15)}

# 曖昧で Evaluator がテストできない契約表現
VAGUE_PHRASES = [
    "直感的", "使いやすい", "分かりやすい", "わかりやすい", "見やすい", "美しい", "モダン",
    "パフォーマンスが良", "パフォーマンスが高", "高速に動作", "高速である", "快適",
    "コードが綺麗", "コードがきれい", "きれいなコード", "綺麗なコード",
    "適切に動作", "正常に動作する", "正しく動作する", "スムーズ", "適切に処理", "いい感じ",
    "など適宜", "必要に応じて",
]
# 実装詳細に踏み込んだ契約（Generator に任せるべき内容）。project.md の「契約で許可する語」で除外できる。
IMPL_PHRASES = ["CREATE TABLE", "エンドポイント設計", "テーブル設計", "Redux", "Zustand", "useState", "useEffect"]
# 先送り表現（契約・仕様に紛れ込ませない）
DEFER_PHRASES = ["TODO", "後で対応", "後日対応", "将来対応", "暫定", "いずれ"]

VERDICT_RE = re.compile(r"^\s*VERDICT:\s*(PASS|FAIL)\s*$", re.M)
RETURN_RE = re.compile(r"^\s*RETURN_TO:\s*(generator|designer|planner|none)\s*$", re.M)


def section(text, heading_pattern):
    """見出し（#）以降、次の同階層以上の見出しまでを返す。"""
    m = re.search(rf"^(#+)\s*{heading_pattern}.*$", text, re.M)
    if not m:
        return None
    level = len(m.group(1))
    rest = text[m.end():]
    nxt = re.search(rf"^#{{1,{level}}}\s", rest, re.M)
    return rest[: nxt.start()] if nxt else rest


def kv(text, key):
    """`- キー: 値` 形式の行から値を返す（無ければ None）。"""
    m = re.search(rf"^\s*[-*]\s*{re.escape(key)}\s*[:：]\s*(.*)$", text, re.M)
    return m.group(1).strip() if m else None


def parse_range(value, default):
    if not value:
        return default
    m = re.fullmatch(r"(\d+)\s*[-〜~]\s*(\d+)", value.strip())
    return (int(m.group(1)), int(m.group(2))) if m else default


def load_project():
    p = ROOT / "docs" / "project.md"
    return p.read_text(encoding="utf-8") if p.exists() else ""


def settings():
    text = load_project()
    allowed = [w.strip() for w in re.split(r"[,、，]", kv(text, "契約で許可する語") or "") if w.strip() and w.strip() != "なし"]
    return {
        "features": parse_range(kv(text, "機能数"), DEFAULTS["features"]),
        "contract": parse_range(kv(text, "契約項目数"), DEFAULTS["contract"]),
        "allowed": allowed,
    }


def check_project(path, text):
    errs = []
    ptype = kv(text, "種別")
    if not ptype:
        errs.append("`- 種別: web-ui | api | cli | library | other` の行がありません")
    elif ptype not in PROJECT_TYPES:
        errs.append(f"種別 `{ptype}` は無効です（{' / '.join(PROJECT_TYPES)} のいずれか）")
    for key in ["起動コマンド", "検証コマンド", "UI評価"]:
        if kv(text, key) is None:
            errs.append(f"`- {key}:` の行がありません（不要なら「なし」と書く）")
    ui = kv(text, "UI評価")
    if ui is not None and ui not in ("あり", "なし"):
        errs.append(f"`UI評価` は「あり」か「なし」で書いてください（現在: `{ui}`）")
    if ptype == "web-ui" and ui == "なし":
        errs.append("種別が web-ui なのに UI評価が「なし」です")
    return errs


def check_sprint(path, text, cfg):
    errs = []
    if not re.search(r"^#+\s*Sprint\s*\d+", text, re.M):
        errs.append("見出し `## Sprint N: タイトル` がありません")

    features = section(text, r"実装する機能")
    if features is None:
        errs.append("`### 実装する機能` セクションがありません")
    else:
        n = len(re.findall(r"^\s*[-*]\s+\S", features, re.M))
        lo, hi = cfg["features"]
        if not lo <= n <= hi:
            errs.append(f"実装する機能が {n} 個です（{lo}〜{hi} 個に収めてください）")

    if section(text, r"対象外") is None:
        errs.append("`### 対象外（このスプリントでやらないこと）` セクションがありません")

    contract = section(text, r"スプリント契約")
    if contract is None:
        errs.append("`### スプリント契約（完了条件）` セクションがありません")
        return errs
    items = re.findall(r"^\s*-\s*\[[ xX]\]\s*(.+)$", contract, re.M)
    lo, hi = cfg["contract"]
    if not lo <= len(items) <= hi:
        errs.append(f"契約項目が {len(items)} 個です（{lo}〜{hi} 個にしてください。形式は `- [ ] 条件`）")
    if len(set(i.strip() for i in items)) != len(items):
        errs.append("契約項目に重複があります")
    for item in items:
        if len(item.strip()) < 12:
            errs.append(f"契約条件が短すぎます（操作と期待結果を書く）: {item.strip()}")
        for p in VAGUE_PHRASES:
            if p in item:
                errs.append(f"曖昧な契約条件です（「{p}」）: {item.strip()} — Evaluator がテストできる具体的な記述（操作→期待結果）にしてください")
                break
        for p in IMPL_PHRASES:
            if p in item and p not in cfg["allowed"]:
                errs.append(f"実装詳細に踏み込んだ契約です（「{p}」）: {item.strip()} — 「何を作るか」だけを書いてください")
                break
        for p in DEFER_PHRASES:
            if p in item:
                errs.append(f"先送り表現が契約に含まれています（「{p}」）: {item.strip()}")
                break
    return errs


def check_spec(path, text):
    errs = []
    for h in SPEC_HEADINGS:
        if not re.search(rf"^#+\s*{h}", text, re.M):
            errs.append(f"`## {h}` セクションがありません")
    return errs


def check_eval(path, text):
    verdicts = VERDICT_RE.findall(text)
    if not verdicts:
        return ["判定行 `VERDICT: PASS` または `VERDICT: FAIL` がありません（Evaluator の出力を原文のまま保存してください）"]
    errs = []
    if verdicts[-1] == "FAIL" and not RETURN_RE.findall(text):
        errs.append("不合格なのに `RETURN_TO: generator|designer|planner` の行がありません")
    return errs


def validate(path):
    rel = Path(path).resolve().relative_to(ROOT).as_posix()
    text = Path(path).read_text(encoding="utf-8")
    cfg = settings()
    if PROJECT_RE.search(rel):
        errs = check_project(rel, text)
    elif EVAL_RE.search(rel):
        errs = check_eval(rel, text)
    elif SPRINT_RE.search(rel):
        errs = check_sprint(rel, text, cfg)
    elif SPEC_RE.search(rel):
        errs = check_spec(rel, text)
    else:
        errs = []
    return [f"{rel}: {e}" for e in errs]


def targets_all():
    docs = ROOT / "docs"
    files = [docs / n for n in ("project.md", "spec.md") if (docs / n).exists()]
    sprints = docs / "sprints"
    if sprints.exists():
        files += sorted(sprints.glob("sprint-[0-9]*.md"), key=lambda p: [int(x) for x in re.findall(r"\d+", p.name)])
    return files


def check_sequence():
    """スプリント番号が 1 から連続していること。"""
    sprints = ROOT / "docs" / "sprints"
    if not sprints.exists():
        return []
    nums = sorted(int(m.group(1)) for p in sprints.glob("sprint-*.md")
                  if (m := re.fullmatch(r"sprint-(\d+)\.md", p.name)))
    if nums and nums != list(range(1, nums[-1] + 1)):
        return [f"docs/sprints: スプリント番号が連続していません（{nums}）"]
    return []


def latest_verdict(n):
    p = ROOT / "docs" / "sprints" / f"sprint-{n}-eval.md"
    if not p.exists():
        return "NONE"
    v = VERDICT_RE.findall(p.read_text(encoding="utf-8"))
    return v[-1] if v else "NONE"


def main(argv):
    if "--verdict" in argv:
        i = argv.index("--verdict")
        print(latest_verdict(int(argv[i + 1])))
        return 0

    full = False
    if "--hook" in argv:
        try:
            data = json.load(sys.stdin)
            fp = data.get("tool_input", {}).get("file_path", "")
        except Exception:
            return 0
        if not fp or not Path(fp).exists():
            return 0
        try:
            Path(fp).resolve().relative_to(ROOT)
        except ValueError:
            return 0
        files = [Path(fp)]
    elif len(argv) > 1:
        files = [Path(a) for a in argv[1:]]
    else:
        files = targets_all()
        full = True

    errors = []
    for f in files:
        errors += validate(f)
    if full:
        errors += check_sequence()
    if errors:
        print("ドキュメント検証エラー:\n" + "\n".join(f"- {e}" for e in errors), file=sys.stderr)
        return 2
    print(f"OK: {len(files)} ファイルを検証しました", file=sys.stderr if "--hook" in argv else sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
