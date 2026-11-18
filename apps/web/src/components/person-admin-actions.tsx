"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { ERROR_TEXT_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@/lib/ui-classes";

/**
 * 人物ページの管理者向け操作（編集リンクと、確認つきの削除）。
 * 管理者にだけサーバーが描画する。権限の最終確認は API が行う。
 * @param props.personId 人物 ID
 * @param props.personName 確認ダイアログに出す氏名
 */
export function PersonAdminActions({
  personId,
  personName,
}: {
  personId: number;
  personName: string;
}) {
  const t = useTranslations("personDetail");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  /** 確認ダイアログを開く。 */
  function openDialog() {
    setErrorKey(null);
    dialogRef.current?.showModal();
  }

  /** 確認ダイアログを閉じる。 */
  function closeDialog() {
    dialogRef.current?.close();
  }

  /** 削除 API を呼び、成功したら内閣一覧へ戻る。 */
  async function handleDelete() {
    setBusy(true);
    setErrorKey(null);
    try {
      const response = await fetch(`/api/persons/${personId}`, { method: "DELETE" });
      if (response.ok) {
        router.push("/");
        router.refresh();
        return;
      }
      const body: unknown = await response.json().catch(() => undefined);
      const code =
        typeof body === "object" && body !== null && "code" in body
          ? (body as { code?: unknown }).code
          : undefined;
      if (code === "hasCareers") setErrorKey("hasCareers");
      else if (response.status === 404) setErrorKey("notFound");
      else if (response.status === 401 || response.status === 403) setErrorKey("forbidden");
      else setErrorKey("unknown");
    } catch {
      setErrorKey("unknown");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-4">
      <Link href={`/persons/${personId}/edit`} className={SECONDARY_BUTTON_CLASS}>
        {t("edit")}
      </Link>
      <button type="button" onClick={openDialog} className={SECONDARY_BUTTON_CLASS}>
        {t("delete")}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="delete-dialog-title"
        className="m-auto w-[min(32rem,calc(100vw-3rem))] rounded-card border border-hairline bg-canvas p-6 text-ink md:p-8 backdrop:bg-black/70"
      >
        <h2 id="delete-dialog-title" className="text-heading-lg font-light">
          {t("deleteDialogTitle")}
        </h2>
        <p className="mt-4 text-body">{t("deleteDialogBody", { name: personName })}</p>
        {errorKey ? (
          <p role="alert" className={ERROR_TEXT_CLASS}>
            {t(`deleteErrors.${errorKey}`)}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className={PRIMARY_BUTTON_CLASS}
          >
            {busy ? t("deleting") : t("deleteConfirm")}
          </button>
          <button type="button" onClick={closeDialog} className={SECONDARY_BUTTON_CLASS}>
            {t("deleteCancel")}
          </button>
        </div>
      </dialog>
    </div>
  );
}
