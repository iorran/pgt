// CSV that Excel in Portuguese opens as a table: ";" separators, comma decimals, and a BOM so it reads UTF-8.
export type CsvRow = (string | number | null)[];

export const csvMoney = (value: string | number) => Number(value).toFixed(2).replace('.', ',');

function cell(value: string | number | null) {
  const s = value === null ? '' : String(value);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: CsvRow[]): string {
  return `﻿${rows.map((row) => row.map(cell).join(';')).join('\r\n')}`;
}

export function downloadCsv(filename: string, rows: CsvRow[]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Let the browser start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
