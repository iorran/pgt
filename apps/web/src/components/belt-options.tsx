import { useTranslation } from 'react-i18next';
import { ADULT_BELTS, KIDS_BELTS, beltKey } from '@/lib/belts';

// <option>s for a belt <select>, grouped Adulto (with white) / Infantil.
export function BeltOptions() {
  const { t } = useTranslation();
  const groups = [
    { label: 'beltGroups.adult', belts: ['white', ...ADULT_BELTS] },
    { label: 'beltGroups.kids', belts: KIDS_BELTS },
  ];
  return groups.map(g => (
    <optgroup key={g.label} label={t(g.label)}>
      {g.belts.map(b => (
        <option key={b} value={b}>
          {t(beltKey(b))}
        </option>
      ))}
    </optgroup>
  ));
}
