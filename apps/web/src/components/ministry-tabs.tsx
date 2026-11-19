"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/** タブ 1 つ分。key は URL（?tab=）にも使う。 */
export interface MinistryTab {
  key: string;
  label: string;
  /** そのタブの中身（サーバーで作った表）。選ばれていないタブは hidden で隠す */
  panel: ReactNode;
}

/**
 * 省庁ページのタブ（大臣・副大臣・大臣政務官）。WAI-ARIA の tablist / tab / tabpanel の作りで、
 * ←→ キー（Home / End も）でタブを移れる。選んだタブは URL の ?tab= に反映する（URL を共有すると同じタブが開く）。
 * @param props.tabs タブの一覧
 * @param props.initialKey 最初に開くタブの key（URL の ?tab=。不正な値なら先頭）
 * @param props.label タブ一覧の読み上げ名
 * @param props.idPrefix ページ内で一意な id の接頭辞
 */
export function MinistryTabs({
  tabs,
  initialKey,
  label,
  idPrefix,
}: {
  tabs: readonly MinistryTab[];
  initialKey: string | undefined;
  label: string;
  idPrefix: string;
}) {
  const firstKey = tabs[0]?.key ?? "";
  const [active, setActive] = useState(
    tabs.some((tab) => tab.key === initialKey) ? (initialKey as string) : firstKey,
  );
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  /**
   * タブを切り替え、URL に反映する。
   * @param key 開くタブの key
   * @param moveFocus true ならそのタブへフォーカスも移す（キー操作のとき）
   */
  function select(key: string, moveFocus: boolean) {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
    if (moveFocus) tabRefs.current[key]?.focus();
  }

  /**
   * 矢印キーでタブを移る。端では反対側へ回る。
   * @param event キー入力
   * @param index 操作中のタブの位置
   */
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    select(tabs[next]!.key, true);
  }

  return (
    <div className="mt-12">
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-x-8 border-b border-ink">
        {tabs.map((tab, index) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              ref={(element) => {
                tabRefs.current[tab.key] = element;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${tab.key}`}
              // 選ばれているタブだけが Tab キーの停止位置。残りは矢印キーで移る
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.key, false)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`-mb-px inline-flex min-h-12 items-center whitespace-nowrap border-b-4 px-1 text-lg ${
                selected
                  ? "border-primary font-medium text-ink"
                  : "border-transparent font-light text-mute hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`${idPrefix}-panel-${tab.key}`}
          aria-labelledby={`${idPrefix}-tab-${tab.key}`}
          hidden={tab.key !== active}
          tabIndex={0}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
