/**
 * 配色の選択を保存する localStorage のキー。
 * サーバー側の layout（初期化スクリプト）とクライアント側のボタンの両方が使うため、
 * "use client" ではない独立したファイルに置く。
 */
export const THEME_STORAGE_KEY = "jp-theme";
