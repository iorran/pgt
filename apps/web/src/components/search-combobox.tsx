import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { beltClasses, beltKey } from '@/lib/belts';
import { cn } from '@/lib/utils';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';

export interface SearchItem {
  id: string;
  name: string;
  // People show their belt next to the name.
  belt?: string | null;
}

interface CommonProps {
  id: string;
  items: SearchItem[];
  placeholder?: string;
  'aria-label'?: string;
}

type SingleProps = CommonProps & {
  multiple?: false;
  // Blocks the form from submitting until an item is picked.
  required?: boolean;
  value: SearchItem | null;
  onChange: (value: SearchItem | null) => void;
};

type MultipleProps = CommonProps & {
  multiple: true;
  value: SearchItem[];
  onChange: (value: SearchItem[]) => void;
};

// Type to filter, tap to pick: one item, or several shown as removable chips. For lists that grow with the
// academy (students, teachers, families); short fixed lists stay a plain select.
export function SearchCombobox(props: SingleProps | MultipleProps) {
  const { t } = useTranslation();
  const anchor = useComboboxAnchor();
  const { id, items, placeholder } = props;
  const shared = {
    items,
    itemToStringLabel: (item: SearchItem) => item.name,
    isItemEqualToValue: (a: SearchItem, b: SearchItem) => a.id === b.id,
    autoHighlight: true,
  };

  const list = (
    <ComboboxContent anchor={props.multiple ? anchor : undefined}>
      <ComboboxEmpty>{t('common.noResults')}</ComboboxEmpty>
      <ComboboxList>
        {(item: SearchItem) => (
          <ComboboxItem key={item.id} value={item} className="min-h-11 text-base md:min-h-8 md:text-sm">
            <span className="flex-1">{item.name}</span>
            {item.belt && (
              <span className={cn('rounded-sm px-2 py-0.5 text-xs ring-1 ring-white/40', beltClasses(item.belt))}>
                {t(beltKey(item.belt))}
              </span>
            )}
          </ComboboxItem>
        )}
      </ComboboxList>
    </ComboboxContent>
  );

  if (props.multiple) {
    return (
      <Combobox {...shared} multiple value={props.value} onValueChange={(v: SearchItem[]) => props.onChange(v)}>
        <ComboboxChips ref={anchor} className="min-h-11 md:min-h-8">
          <ComboboxValue>
            {(values: SearchItem[]) => (
              <Fragment>
                {values.map((v) => (
                  <ComboboxChip
                    key={v.id}
                    removeLabel={t('common.removeItem', { name: v.name })}
                    className="h-8 text-sm md:h-6 md:text-xs"
                  >
                    {v.name}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  id={id}
                  aria-label={props['aria-label']}
                  placeholder={values.length === 0 ? placeholder : undefined}
                  className="text-base md:text-sm"
                />
              </Fragment>
            )}
          </ComboboxValue>
        </ComboboxChips>
        {list}
      </Combobox>
    );
  }

  return (
    <Combobox {...shared} required={props.required} value={props.value} onValueChange={(v: SearchItem | null) => props.onChange(v)}>
      <ComboboxInput
        id={id}
        aria-label={props['aria-label']}
        placeholder={placeholder}
        showClear={!!props.value}
        className="h-11 w-full text-base md:h-8 md:text-sm"
      />
      {list}
    </Combobox>
  );
}
