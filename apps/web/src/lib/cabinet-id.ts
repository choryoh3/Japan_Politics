import { z } from "zod";

/** URL の内閣 ID は 1 以上の整数の文字列だけを受け付ける。 */
const cabinetIdSchema = z
  .string()
  .regex(/^[1-9]\d{0,9}$/)
  .transform(Number);

/**
 * URL から来た内閣 ID を検証して数値にする。
 * @param raw URL の文字列
 * @returns 内閣 ID。不正な形式なら null
 */
export function parseCabinetId(raw: string): number | null {
  const result = cabinetIdSchema.safeParse(raw);
  return result.success ? result.data : null;
}
