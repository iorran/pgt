type Period = 'day' | 'week' | 'month';

export function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const opts: Period[] = ['day', 'week', 'month'];
  return (
    <div className="flex gap-1" role="group">
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-3 py-1 rounded text-sm ${value === o ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
        >
          {o.charAt(0).toUpperCase() + o.slice(1)}
        </button>
      ))}
    </div>
  );
}
