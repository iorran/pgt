// The academy bills in euros (Portugal). API decimals arrive as strings.
export const formatMoney = (value: string | number, locale: string) =>
  Number(value).toLocaleString(locale, { style: 'currency', currency: 'EUR' });

// YYYY-MM-DD parsed as local midnight; `new Date('YYYY-MM-DD')` is UTC and shows the previous day west of UTC.
export const formatDate = (ymd: string, locale: string) =>
  new Date(`${ymd.slice(0, 10)}T00:00`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
