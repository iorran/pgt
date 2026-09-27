// Which ranking a student competes in (docs/CONTEXT.md "Ranking Category").
// IBJJF gives adult belts from 16 and kids belts below; white belts need another signal.
const KIDS_BELTS = new Set([
  'grey-white', 'grey', 'grey-black',
  'yellow-white', 'yellow', 'yellow-black',
  'orange-white', 'orange', 'orange-black',
  'green-white', 'green', 'green-black',
]);
const KID_AGE_LIMIT = 16;

export type RankingCategory = 'kids' | 'adults';

export function rankingCategory(
  student: { belt: string; dateOfBirth: string | null; modalities: string[] },
  today: Date = new Date(),
): RankingCategory {
  if (student.belt !== 'white') {
    return KIDS_BELTS.has(student.belt) ? 'kids' : 'adults';
  }
  if (student.dateOfBirth) {
    const born = new Date(`${student.dateOfBirth.slice(0, 10)}T00:00`);
    const age = (today.getTime() - born.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age < KID_AGE_LIMIT ? 'kids' : 'adults';
  }
  return student.modalities.includes('Kids') ? 'kids' : 'adults';
}
