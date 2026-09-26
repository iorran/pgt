import { NavLink } from 'react-router-dom';

interface TabItem {
  to: string;
  label: string;
}

export function TabsNav({ items, title }: { items: TabItem[]; title?: string }) {
  return (
    <>
      {title && <h1 className="font-heading text-2xl uppercase tracking-wide mb-3">{title}</h1>}
      <nav className="flex gap-1 border-b border-border overflow-x-auto flex-nowrap whitespace-nowrap">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              `shrink-0 inline-flex items-center min-h-11 px-4 font-heading uppercase text-sm tracking-wide no-underline transition-colors border-b-2 -mb-px ${
                isActive ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
