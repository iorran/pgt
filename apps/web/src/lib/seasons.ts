import { todayYmd } from './format';

interface SeasonDates {
  id: string;
  startDate: string;
  endDate: string;
}

// The API's `active` flag is always true: a season is active while today is inside its date range.
export function isSeasonActive(s: Omit<SeasonDates, 'id'>, today = todayYmd()): boolean {
  return s.startDate.slice(0, 10) <= today && today <= s.endDate.slice(0, 10);
}

// The season running today, else the first one (the API lists the newest first).
export function defaultSeasonId(seasons: SeasonDates[], today = todayYmd()): string {
  return (seasons.find((s) => isSeasonActive(s, today)) ?? seasons[0])?.id ?? '';
}
