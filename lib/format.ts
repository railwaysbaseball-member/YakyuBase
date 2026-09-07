/** 打率・出塁率などを ".417" のように先頭の0を省いた野球式表記にする */
export function formatAvg(value: number): string {
  if (!Number.isFinite(value)) return ".000";
  const sign = value < 0 ? "-" : "";
  const fixed = Math.abs(value).toFixed(3);
  return `${sign}${fixed.replace(/^0\./, ".")}`;
}

/** 防御率・WHIPなどの小数第2位表記 */
export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}
