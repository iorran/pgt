import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SubpageHeader } from './subpage-header';
import { RadioOptions } from './options';

type Language = 'pt-BR' | 'en';

export default function LanguagePage() {
  const { t, i18n } = useTranslation();
  const [current, setCurrent] = useState<Language>(i18n.language === 'en' ? 'en' : 'pt-BR');

  function handle(value: Language) {
    // ponytail: not persisted across reloads (i18n init hardcodes pt-BR), same as the owner header toggle.
    void i18n.changeLanguage(value);
    setCurrent(value);
  }

  return (
    <div className="flex flex-col gap-4">
      <SubpageHeader title={t('me.language')} />
      <RadioOptions
        label={t('me.language')}
        options={[
          { value: 'pt-BR', label: t('me.languagePortuguese') },
          { value: 'en', label: t('me.languageEnglish') },
        ]}
        value={current}
        onChange={handle}
      />
    </div>
  );
}
