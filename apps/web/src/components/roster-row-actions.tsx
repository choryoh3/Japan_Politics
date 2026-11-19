"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import {
  ERROR_TEXT_CLASS,
  PRIMARY_BUTTON_CLASS,
  ROW_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

/**
 * 閣僚名簿の 1 行ぶんの管理者向け操作（編集リンクと、確認つきの削除）。
 * 管理者にだけサーバーが描画する。権限の最終確認は API が行う。
 * @param props.cabinetId 内閣 ID
 * @param props.appointmentId 人事 ID
 * @param props.postName 確認ダイアログに出す役職名
 * @param props.personName 確認ダイアログに出す氏名
 * @param props.describedBy どの行の操作かを読み上げに伝える要素の id
 */
export function RosterRowActions({
  cabinetId,
  appointmentId,
  postName,
  personName,
  describedBy,
}: {
  cabinetId: number;
  appointmentId: number;
  postName: string;
  personName: string;
  describedBy: string;
}) {
  const t = useTranslations("cabinetDetail");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const titleId = `delete-title-${appointmentId}`;

  /** 確認ダイアログを開く。 */
  function openDialog() {
    setErrorKey(null);
    dialogRef.current?.showModal();
  }

  /** 確認ダイアログを閉じる。 */
  function closeDialog() {
    dialogRef.current?.close();
  }

  /** 削除 API を呼び、成功したら名簿を読み直す。 */
  async function handleDelete() {
    setBusy(true);
    setErrorKey(null);
    try {
      const response = await fetch(`/api/cabinets/${cabinetId}/appointments/${appointmentId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        closeDialog();
        router.refresh();
        return;
      }
      if (response.status === 404) setErrorKey("notFound");
      else if (response.status === 401 || response.status === 403) setErrorKey("forbidden");
      else setErrorKey("unknown");
    } catch {
      setErrorKey("unknown");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
      <Link
        href={`/cabinets/${cabinetId}/appointments/${appointmentId}/edit`}
        aria-describedby={describedBy}
        className={ROW_BUTTON_CLASS}
      >
        {t("edit")}
      </Link>
      <button
        type="button"
        onClick={openDialog}
        aria-describedby={describedBy}
        className={ROW_BUTTON_CLASS}
      >
        {t("delete")}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100vw-3rem))] rounded-card border border-hairline bg-canvas p-6 text-ink md:p-8 backdrop:bg-black/70"
      >
        <h2 id={titleId} className="text-heading-lg font-light">
          {t("deleteDialogTitle")}
        </h2>
        <p className="mt-4 text-body">
          {t("deleteDialogBody", { post: postName, name: personName })}
        </p>
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
