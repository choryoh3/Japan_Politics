"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { SearchSuggestions } from "@japan-politics/db";
import { SEARCH_QUERY_MAX_LENGTH } from "@/lib/search-query";

/** 入力が止まってから検索を始めるまでの待ち時間（ミリ秒）。 */
const DEBOUNCE_MS = 200;

/** 候補 1 件分（表示用に人物・内閣をそろえた形）。 */
interface Option {
  key: string;
  href: string;
  label: string;
  hint?: string;
}

/** 検索の状態。idle は未入力、done は結果あり（0 件を含む）。 */
type Status = "idle" | "loading" | "done" | "error";

/**
 * 検索結果を、人物→内閣の順に並んだ候補の一覧にする。キーボード操作の順番と見た目の順番を一致させるため。
 * @param result 検索 API の結果
 * @returns 候補の配列
 */
function toOptions(result: SearchSuggestions): { persons: Option[]; cabinets: Option[] } {
  return {
    persons: result.persons.map((p) => ({
      key: `person-${p.id}`,
      href: `/persons/${p.id}`,
      label: p.name,
      hint: p.kana,
    })),
    cabinets: result.cabinets.map((c) => ({
      key: `cabinet-${c.id}`,
      href: `/cabinets/${c.id}`,
      label: c.name,
    })),
  };
}

/**
 * ヘッダーの検索欄。入力を止めると人物・内閣の候補を出し、選ぶとそのページへ移動する。
 * 下矢印・上矢印で候補を選び、Enter で移動、Escape で閉じる。
 */
export function SearchBox() {
  const t = useTranslations("search");
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [groups, setGroups] = useState<{ persons: Option[]; cabinets: Option[] }>({
    persons: [],
    cabinets: [],
  });
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const options = [...groups.persons, ...groups.cabinets];

  // 入力が止まってから検索する。新しい入力が来たら、前の待ち・通信は捨てる
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === "") return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        setGroups(toOptions((await res.json()) as SearchSuggestions));
        setActiveIndex(-1);
        setStatus("done");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  /**
   * 入力が変わったときに、状態を更新する。
   * @param value 入力欄の新しい値
   */
  function handleChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (value.trim() === "") {
      setStatus("idle");
      setGroups({ persons: [], cabinets: [] });
    } else {
      setStatus("loading");
    }
    setActiveIndex(-1);
  }

  /**
   * 候補のページへ移動し、候補を閉じる。
   * @param option 選んだ候補
   */
  function go(option: Option) {
    setOpen(false);
    setQuery("");
    setStatus("idle");
    setGroups({ persons: [], cabinets: [] });
    router.push(option.href);
  }

  /**
   * キーボード操作（上下で選択、Enter で移動、Escape で閉じる）。
   * @param event キー入力イベント
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // 日本語入力の変換確定の Enter では移動しない
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" && options.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp" && options.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      const chosen = options[activeIndex];
      if (open && chosen) {
        event.preventDefault();
        go(chosen);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  /**
   * 検索欄の外にフォーカスが移ったら候補を閉じる。
   * @param event フォーカス離脱イベント
   */
  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(event.relatedTarget)) setOpen(false);
  }

  /**
   * 候補 1 件ぶんの行を作る。
   * @param option 候補
   */
  function renderOption(option: Option) {
    const index = options.indexOf(option);
    const active = index === activeIndex;
    return (
      <li
        key={option.key}
        id={`${listId}-${option.key}`}
        role="option"
        aria-selected={active}
        // フォーカスが外れて閉じる前に click を受けるため、mousedown の既定動作を止める
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => go(option)}
        onMouseEnter={() => setActiveIndex(index)}
        className={`flex min-h-11 cursor-pointer items-baseline gap-3 px-4 py-2 ${
          active ? "bg-primary text-on-dark" : "text-ink"
        }`}
      >
        <span className="font-medium">{option.label}</span>
        {option.hint && (
          <span className={`text-sm ${active ? "text-on-dark" : "text-mute"}`}>{option.hint}</span>
        )}
      </li>
    );
  }

  const showPanel = open && status !== "idle";
  const noResults = status === "done" && options.length === 0;
  const activeOption = options[activeIndex];

  return (
    <div ref={containerRef} onBlur={handleBlur} className="relative w-full md:max-w-sm">
      <input
        type="search"
        role="combobox"
        aria-label={t("label")}
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showPanel && activeOption ? `${listId}-${activeOption.key}` : undefined
        }
        autoComplete="off"
        placeholder={t("placeholder")}
        maxLength={SEARCH_QUERY_MAX_LENGTH}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="h-11 w-full rounded-full border border-on-dark/40 bg-transparent px-5 text-base text-on-dark placeholder:text-on-dark-mute"
      />
      <div
        id={listId}
        role="listbox"
        aria-label={t("label")}
        hidden={!showPanel || options.length === 0}
        className="absolute left-0 right-0 top-full z-20 mt-2 max-h-[70vh] overflow-y-auto rounded-card border border-hairline bg-canvas py-2 text-ink shadow-lg"
      >
        {groups.persons.length > 0 && (
          <ul role="group" aria-labelledby={`${listId}-persons`}>
            <li
              role="presentation"
              id={`${listId}-persons`}
              className="px-4 pt-2 text-sm text-mute"
            >
              {t("persons")}
            </li>
            {groups.persons.map(renderOption)}
          </ul>
        )}
        {groups.cabinets.length > 0 && (
          <ul role="group" aria-labelledby={`${listId}-cabinets`}>
            <li
              role="presentation"
              id={`${listId}-cabinets`}
              className="px-4 pt-2 text-sm text-mute"
            >
              {t("cabinets")}
            </li>
            {groups.cabinets.map(renderOption)}
          </ul>
        )}
      </div>
      {showPanel && (noResults || status === "error") && (
        <p
          role="status"
          className="absolute left-0 right-0 top-full z-20 mt-2 rounded-card border border-hairline bg-canvas px-4 py-3 text-ink shadow-lg"
        >
          {status === "error" ? t("error") : t("noResults")}
        </p>
      )}
    </div>
  );
}
