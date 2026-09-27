// The academy is in Portugal: Portuguese UI formats numbers Portugal-style ("30,00 €").
const toLocale = (locale: string) => (locale.startsWith('pt') ? 'pt-PT' : locale);

// The academy bills in euros. API decimals arrive as strings.
export const formatMoney = (value: string | number, locale: string) =>
  Number(value).toLocaleString(toLocale(locale), { style: 'currency', currency: 'EUR' });

// YYYY-MM-DD parsed as local midnight; `new Date('YYYY-MM-DD')` is UTC and shows the previous day west of UTC.
export const formatDate = (ymd: string, locale: string) =>
  new Date(`${ymd.slice(0, 10)}T00:00`).toLocaleDateString(toLocale(locale), { day: '2-digit', month: '2-digit', year: 'numeric' });

// Local (not UTC) YYYY-MM-DD, so late-evening entries don't land on tomorrow.
export function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Ranking points with their sign: "+5", "−3" (real minus sign), "0".
export function signedPoints(points: number): string {
  if (points > 0) {
    return `+${points}`;
  }
  return points < 0 ? `−${-points}` : '0';
}
