import { describe, expect, it } from "vitest";

import { parseTheme } from "./theme";

describe("parseTheme", () => {
  it("light と dark はそのまま返す", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("未保存や不正な値は undefined（OS の設定に従う）", () => {
    expect(parseTheme(undefined)).toBeUndefined();
    expect(parseTheme(null)).toBeUndefined();
    expect(parseTheme("")).toBeUndefined();
    expect(parseTheme("blue")).toBeUndefined();
  });
});
