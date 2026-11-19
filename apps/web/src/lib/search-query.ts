import { z } from "zod";

/** 検索語の最大文字数。長すぎる入力は DB に渡さない。 */
export const SEARCH_QUERY_MAX_LENGTH = 50;

/** 検索語の検証。前後の空白を除き、最大文字数を超えるものは受け付けない。 */
export const searchQuerySchema = z.string().trim().max(SEARCH_QUERY_MAX_LENGTH);
