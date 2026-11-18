import { describe, expect, it } from "vitest";
import { parseCabinetId } from "./cabinet-id";

describe("parseCabinetId", () => {
  it("正の整数を数値にする", () => {
    expect(parseCabinetId("12")).toBe(12);
  });
  it("不正な形式は null", () => {
    for (const bad of ["abc", "0", "-1", "1.5", "", "99999999999"]) {
      expect(parseCabinetId(bad)).toBeNull();
    }
  });
});
