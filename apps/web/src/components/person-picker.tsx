"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { validatePersonInput } from "@japan-politics/db/person-input";
import { errorsFromResponse } from "@/lib/form-errors";
import { SEARCH_QUERY_MAX_LENGTH } from "@/lib/search-query";
import { ERROR_TEXT_CLASS, INPUT_CLASS, SECONDARY_BUTTON_CLASS } from "@/lib/ui-classes";

/** 入力が止まってから検索を始めるまでの待ち時間（ミリ秒）。 */
const DEBOUNCE_MS = 200;

/** 選択された人物。 */
export interface PickedPerson {
  id: number;
  name: string;
}

/** 検索結果の人物 1 件。 */
interface Candidate {
  id: number;
  name: string;
  kana: string;
}

/** 検索結果。どの検索語に対する結果かを持ち、古い結果で「該当なし」を出さないようにする。 */
interface SearchResult {
  query: string;
  persons: Candidate[];
  failed: boolean;
}

/**
 * 人物を名前で検索して選ぶ入力欄。
 * 候補が 0 件のときは「新しい人物として登録」を出し、登録するとその人物が選択された状態になる。
 * 人物の登録は既存の POST /api/persons（氏名・よみがなの検証は人物フォームと同じ関数）を使う。
 * @param props.value 選択中の人物（未選択なら null）
 * @param props.onChange 選択が変わったときに呼ぶ
 * @param props.inputId 検索欄の id（ラベルと結ぶ）
 * @param props.invalid エラー表示中か
 * @param props.describedBy エラー文の id
 */
export function PersonPicker({
  value,
  onChange,
  inputId,
  invalid,
  describedBy,
}: {
  value: PickedPerson | null;
  onChange: (person: PickedPerson | null) => void;
  inputId: string;
  invalid: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("personPicker");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [kana, setKana] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  // 今の検索語に対する結果だけを使う（入力が進んだあと、古い結果を見せない）
  const current = result && result.query === trimmed ? result : null;
  const loading = trimmed !== "" && current === null;

  // 入力が止まってから検索する。新しい入力が来たら、前の待ち・通信は捨てる
  useEffect(() => {
    if (trimmed === "" || trimmed.length > SEARCH_QUERY_MAX_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as { persons: Candidate[] };
        setResult({ query: trimmed, persons: body.persons, failed: false });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResult({ query: trimmed, persons: [], failed: true });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  /**
   * 人物を選ぶ。検索の状態は片づける。
   * @param person 選んだ人物
   */
  function choose(person: PickedPerson) {
    onChange(person);
    setQuery("");
    setResult(null);
    setKana("");
    setRegisterError(null);
  }

  /** 選択を外して、検索欄に戻る。 */
  function clearSelection() {
    onChange(null);
    // 検索欄が描かれてからフォーカスする
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  /** 入力された氏名・よみがなで新しい人物を登録し、成功したらその人物を選ぶ。 */
  async function register() {
    // 人物フォームと同じ検証関数を先に当てる（サーバーでも必ず検証される）
    const checked = validatePersonInput({ name: query, kana });
    if (!checked.ok) {
      setRegisterError(checked.errors.name ?? checked.errors.kana ?? "unknown");
      return;
    }
    setRegisterError(null);
    setRegistering(true);
    try {
      const response = await fetch("/api/persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: checked.value.name, kana: checked.value.kana }),
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        const errors = errorsFromResponse(response.status, body, ["name", "kana"]);
        setRegisterError(errors.name ?? errors.kana ?? errors.form ?? "unknown");
        return;
      }
      const id = (body as { id?: number } | undefined)?.id;
      if (typeof id !== "number") {
        setRegisterError("unknown");
        return;
      }
      choose({ id, name: checked.value.name });
    } catch {
      setRegisterError("unknown");
    } finally {
      setRegistering(false);
    }
  }

  /** ラベルの中身（「人物」と必須の印。印は読み上げには含めない）。 */
  const labelContent = (
    <>
      {t("label")}
      <span aria-hidden="true" className="ml-2 text-mute">
        {t("required")}
      </span>
    </>
  );

  // 選択済みのときは、入力欄が無いので <label> ではなく見出しとして出し、
  // 「選び直す」ボタンの名前がラベルに上書きされないようにする
  if (value) {
    return (
      <div role="group" aria-labelledby={`${inputId}-label`}>
        <p id={`${inputId}-label`} className="text-sm font-medium tracking-wider">
          {labelContent}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <p className="text-lg font-medium" data-testid="selected-person">
            <span className="sr-only">{t("selected")}: </span>
            {value.name}
          </p>
          <button type="button" onClick={clearSelection} className={SECONDARY_BUTTON_CLASS}>
            {t("change")}
          </button>
        </div>
      </div>
    );
  }

  const noMatch = current !== null && !current.failed && current.persons.length === 0;

  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-medium tracking-wider">
        {labelContent}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={current !== null && current.persons.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-required="true"
        autoComplete="off"
        placeholder={t("placeholder")}
        maxLength={SEARCH_QUERY_MAX_LENGTH}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setRegisterError(null);
        }}
        // 検索欄で Enter を押しても、閣僚人事のフォームを送信しない
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
        className={INPUT_CLASS}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? describedBy : undefined}
      />
      {loading ? (
        <p role="status" className="mt-2 text-sm text-mute">
          {t("searching")}
        </p>
      ) : null}
      {current?.failed ? (
        <p role="alert" className={ERROR_TEXT_CLASS}>
          {t("searchError")}
        </p>
      ) : null}
      <ul
        id={listId}
        role="listbox"
        aria-label={t("candidates")}
        hidden={current === null || current.persons.length === 0}
        className="mt-2 rounded-card border border-hairline"
      >
        {(current?.persons ?? []).map((person) => (
          <li key={person.id} role="option" aria-selected={false}>
            <button
              type="button"
              onClick={() => choose({ id: person.id, name: person.name })}
              className="flex min-h-11 w-full flex-wrap items-baseline gap-x-3 px-4 py-2 text-left text-ink hover:bg-row-hover"
            >
              <span className="font-medium">{person.name}</span>
              <span className="text-sm text-mute">{person.kana}</span>
            </button>
          </li>
        ))}
      </ul>
      {noMatch ? (
        <div
          role="group"
          aria-label={t("registerGroup")}
          className="mt-4 space-y-4 rounded-card border-l-4 border-primary bg-surface-card p-4"
        >
          <p role="status" className="font-medium text-ink">
            {t("noMatch")}
          </p>
          <p className="text-body">
            <span className="text-sm text-mute">{t("registerName")}: </span>
            <span className="font-medium">{trimmed}</span>
          </p>
          <div>
            <label htmlFor={`${inputId}-kana`} className="text-sm font-medium tracking-wider">
              {t("registerKana")}
              <span aria-hidden="true" className="ml-2 text-mute">
                {t("required")}
              </span>
            </label>
            <input
              id={`${inputId}-kana`}
              type="text"
              aria-required="true"
              value={kana}
              onChange={(event) => setKana(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                void register();
              }}
              className={INPUT_CLASS}
              aria-invalid={registerError ? true : undefined}
              aria-describedby={registerError ? `${inputId}-register-error` : undefined}
            />
            <p className="mt-2 text-sm text-mute">{t("registerKanaHint")}</p>
          </div>
          {registerError ? (
            <p id={`${inputId}-register-error`} role="alert" className={ERROR_TEXT_CLASS}>
              {t(`registerErrors.${registerError}`)}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void register()}
            disabled={registering}
            className={SECONDARY_BUTTON_CLASS}
          >
            {registering ? t("registering") : t("registerTitle")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
