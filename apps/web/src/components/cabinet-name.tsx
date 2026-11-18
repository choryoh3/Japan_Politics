import { Fragment } from "react";

/**
 * 内閣名を表示する。日本語は単語の途中で折れやすいので、「第N次」と、「第N次」に続かない「改造」の前にだけ
 * 折り返し候補（wbr）を入れる（「第2次」と「改造」を引き離さないため）。文字列そのもの（textContent）は内閣名のまま変わらない。
 * @param props.name 内閣名
 */
export function CabinetName({ name }: { name: string }) {
  return (
    <span className="[word-break:keep-all]">
      {name.split(/(?=第\d+次|(?<!次)改造)/).map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
