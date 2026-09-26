import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getStoredTheme, setTheme, type Theme } from '@/lib/theme';
import { SubpageHeader } from './subpage-header';
import { RadioOptions } from './options';

const OPTIONS: { value: Theme; labelKey: string }[] = [
  { value: 'light', labelKey: 'me.themeLight' },
  { value: 'dark', labelKey: 'me.themeDark' },
  { value: 'system', labelKey: 'me.themeSystem' },
];

export default function ThemePage() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<Theme>('system');
  useEffect(() => setCurrent(getStoredTheme()), []);

  function handle(value: Theme) {
    setTheme(value);
    setCurrent(value);
  }

  return (
    <div className="flex flex-col gap-4">
      <SubpageHeader title={t('me.theme')} />
      <RadioOptions
        label={t('me.theme')}
        options={OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
        value={current}
        onChange={handle}
      />
    </div>
  );
}
