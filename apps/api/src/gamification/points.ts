// Season points are stored keyed by podium position: { 1: 10, 2: 7, 3: 5 }.
// Seasons created before 2026-09-27 from the web form were saved as { first, second, third }.
const NAMED: Record<string, number> = { first: 1, second: 2, third: 3 };

export type PointsConfig = Record<number, number>;

export function normalizePointsConfig(input: Record<string, unknown> | null | undefined): PointsConfig {
  const out: PointsConfig = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    const position = NAMED[key] ?? Number(key);
    const points = Number(value);
    if (Number.isInteger(position) && position > 0 && Number.isFinite(points)) {
      out[position] = points;
    }
  }
  return out;
}

export function pointsForPosition(config: Record<string, unknown> | null | undefined, position: number | null): number {
  return position === null ? 0 : normalizePointsConfig(config)[position] ?? 0;
}

// Competition ranking: ties share a rank and the next rank skips (10, 10, 7 → 1, 1, 3).
export function withRanks<T extends { totalPoints: number }>(sorted: T[]): (T & { rank: number })[] {
  const out: (T & { rank: number })[] = [];
  sorted.forEach((row, i) => {
    const prev = out[i - 1];
    out.push({ ...row, rank: prev && prev.totalPoints === row.totalPoints ? prev.rank : i + 1 });
  });
  return out;
}

// XP follows points: approved → max(0, points) × 10; otherwise no XP entry (null).
export function xpForResult(result: { status: string; pointsAwarded: number }): number | null {
  return result.status === 'approved' ? Math.max(0, result.pointsAwarded) * 10 : null;
}
