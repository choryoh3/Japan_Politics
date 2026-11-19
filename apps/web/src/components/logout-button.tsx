"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * ログアウトボタン。押すとセッションを終了し、画面を取得し直してヘッダーを「ログイン」に戻す。
 * @param props.label ボタンの文言
 * @param props.className ボタンの見た目
 */
export function LogoutButton({ label, className }: { label: string; className: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  /** ログアウトして、表示中のページを最新の状態に更新する。 */
  async function handleClick() {
    setBusy(true);
    try {
      await authClient.signOut();
    } finally {
      setBusy(false);
      // サーバー側でヘッダーを作り直させる（成功しても失敗しても現在の状態に合わせる）
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={busy} className={className}>
      {label}
    </button>
  );
}
