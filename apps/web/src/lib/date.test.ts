import { describe, expect, it } from "vitest";
import { parseIsoDate } from "./date";

describe("parseIsoDate", () => {
  it("0 埋めを外して年月日に分ける", () => {
    expect(parseIsoDate("2020-09-16")).toEqual({ year: "2020", month: "9", day: "16" });
  });
  it("形式が不正なら null", () => {
    expect(parseIsoDate("2020/09/16")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
  });
});
