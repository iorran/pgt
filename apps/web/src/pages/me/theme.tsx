import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getStoredTheme, setTheme, type Theme } from '@/lib/theme';
import { Button } from '@/components/ui/button';

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
    <div className="flex flex-col gap-3">
      {OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant={current === opt.value ? 'default' : 'outline'}
          className="h-12 justify-start"
          onClick={() => handle(opt.value)}
        >
          {t(opt.labelKey)}
        </Button>
      ))}
    </div>
  );
}
