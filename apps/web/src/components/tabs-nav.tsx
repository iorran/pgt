import { Link, useLocation } from 'react-router-dom';

interface TabItem {
  to: string;
  label: string;
}

export function TabsNav({ items }: { items: TabItem[] }) {
  const location = useLocation();

  return (
    <nav className="flex gap-1 border-b border-border">
      {items.map((item) => {
        const isActive = location.pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`px-4 py-2 font-heading uppercase text-sm tracking-wide no-underline transition-colors border-b-2 -mb-px ${
              isActive
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
