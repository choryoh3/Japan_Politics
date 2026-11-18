#!/usr/bin/env python3
"""Serena の REPL（mcp__serena__serena_repl）に渡された Python コードを検査する PreToolUse フック。

serena_repl は Python コードを実行するため、`settings.json` の Read 拒否ルール（.env など）を素通りできる。
そこで、機密ファイルへのアクセスや、Serena の API を迂回する手段を含むコードを実行前に拒否する。

使い方:
  python3 scripts/block_serena_secrets.py   # stdin の JSON（tool_input.code）を読む

違反があれば理由を stderr に出して終了コード 2 を返す（呼び出し元のエージェントに差し戻される）。
これは「うっかり」を防ぐ対策であり、文字列を組み立てて回避するような意図的な迂回は防げない。
機密ファイルをプロジェクト外に置く、サンドボックスで動かす、などが根本的な対策になる。
"""
import json
import re
import sys

# (パターン, 理由)。コード全体に対して大文字小文字を区別せずに検索する。
RULES = [
    # 機密ファイル
    (r"\.env(?![\w])(?!\.(example|sample|template)\b)", ".env 系ファイルへの参照"),
    (r"dotenv", "dotenv の利用"),
    (r"secrets?[/\\]", "secrets ディレクトリへの参照"),
    (r"\.(pem|key|pfx|p12|jks|keystore|kdbx|ppk)\b", "鍵・証明書ファイルへの参照"),
    (r"id_(rsa|dsa|ecdsa|ed25519)", "SSH 秘密鍵への参照"),
    (r"[/\\]\.(ssh|aws|gnupg|kube|docker)\b", "資格情報ディレクトリへの参照"),
    (r"\.(npmrc|netrc|pypirc|git-credentials)\b", "資格情報ファイルへの参照"),
    (r"\.git[/\\]config", ".git/config（トークンを含み得る）への参照"),
    (r"credentials?\.(json|ya?ml|toml|ini)", "資格情報ファイルへの参照"),
    # 無視設定の回避
    (r"skip_ignored_files\s*=\s*False", "無視対象ファイルを検索対象に含める指定"),
    (r"require_not_ignored", "無視設定の検証の操作"),
    # Serena の API を迂回する手段
    (r"\b(import|from)\s+(os|sys|subprocess|pathlib|shutil|socket|urllib|http|requests|ctypes|glob|io|builtins|importlib|pty|multiprocessing)\b", "標準ライブラリによる OS・ファイル・ネットワーク操作"),
    (r"__import__|importlib", "動的インポート"),
    (r"\b(eval|exec|compile)\s*\(", "動的なコード実行"),
    (r"\bopen\s*\(", "open() によるファイル操作"),
    (r"\bPath\s*\(", "pathlib によるファイル操作"),
    (r"\b(environ|getenv|putenv)\b", "環境変数へのアクセス"),
    (r"\bs\.shell\b|execute_shell_command", "シェル実行（無効化済み）"),
    (r"\b(globals|locals|vars)\s*\(\s*\)\s*\[|getattr\s*\(\s*s\b|__dict__|__builtins__|__class__|__subclasses__", "リフレクションによる制限の回避"),
]


def main() -> int:
    try:
        payload = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        code = payload["tool_input"]["code"]
        if not isinstance(code, str):
            raise TypeError("code が文字列ではありません")
    except Exception as e:  # 検査できないものは通さない
        _err(f"serena_repl のコードを検査できないため拒否しました（{type(e).__name__}: {e}）")
        return 2

    hits = []
    for pattern, reason in RULES:
        if re.search(pattern, code, re.IGNORECASE):
            hits.append(reason)

    if hits:
        _err(
            "serena_repl のコードを拒否しました（機密情報の保護）:\n"
            + "\n".join(f"  - {h}" for h in dict.fromkeys(hits))
            + "\nSerena の s.fs / s.lsp / s.edit / s.mem の API だけを使い、機密ファイルには触れないでください。"
            "コマンドの実行は Bash で行ってください。"
        )
        return 2
    return 0


def _err(message: str) -> None:
    sys.stderr.buffer.write((message + "\n").encode("utf-8"))
    sys.stderr.flush()


if __name__ == "__main__":
    sys.exit(main())
