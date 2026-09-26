import { Check } from 'lucide-react';

// Radio list shared by the theme and language pickers.
export function RadioOptions<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className="flex min-h-[56px] items-center gap-4 px-4 py-3 text-left font-body transition-colors duration-[var(--motion-fast)] active:bg-muted/50"
          >
            <span className="flex-1">{opt.label}</span>
            {selected ? <Check className="size-5 text-[color:var(--pgt-green)]" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}
