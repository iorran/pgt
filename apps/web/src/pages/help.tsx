import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { isOwner } from '@/lib/roles';
import { findSection, GUIDES, matches, parseGuide, type GuideKind } from '@/lib/guide';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Screenshots stay in the vault; Vite turns each into a hashed URL, fetched only when shown.
const IMAGES = import.meta.glob('../../../../docs/assets/user-guide/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function imageUrl(src = '') {
  const rel = src.replace(/^\.\//, '');
  return Object.entries(IMAGES).find(([key]) => key.endsWith(`/docs/${rel}`))?.[1];
}

const LINK = 'text-primary underline underline-offset-2';

function decodeHash(hash: string) {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

// Help usage signal for the team (logged by the API); never allowed to affect the page.
function track(type: 'search_miss' | 'section_open', guide: GuideKind, value: string) {
  api('/help/events', { method: 'POST', body: JSON.stringify({ type, guide, value }) }).catch(() => {});
}

function markdownComponents(search: string, owner: boolean): Components {
  return {
    h3: ({ children }) => <h3 className="mt-6 mb-2 font-heading text-lg uppercase tracking-wide">{children}</h3>,
    h4: ({ children }) => <h4 className="mt-4 mb-2 font-heading text-base uppercase tracking-wide">{children}</h4>,
    p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
    blockquote: ({ children }) => (
      <blockquote className="mb-3 rounded-sm border-l-4 border-primary bg-card px-4 pt-3 pb-1">{children}</blockquote>
    ),
    table: ({ children }) => (
      <div className="mb-3 overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => <th className="border-b border-border p-2 text-left font-heading uppercase">{children}</th>,
    td: ({ children }) => <td className="border-b border-border p-2 align-top">{children}</td>,
    code: ({ children }) => <code className="rounded-sm bg-muted px-1 font-mono text-sm">{children}</code>,
    img: ({ src, alt }) => {
      const url = imageUrl(typeof src === 'string' ? src : undefined);
      return url ? <img src={url} alt={alt ?? ''} loading="lazy" className="my-3 max-w-full rounded-sm border border-border" /> : null;
    },
    a: ({ href = '', children }) => {
      if (href.startsWith('#')) {
        return (
          <Link to={{ search, hash: href }} className={LINK}>
            {children}
          </Link>
        );
      }
      if (href.endsWith('.md')) {
        // Cross-guide link: only the owner can read both guides.
        if (!owner) {
          return <>{children}</>;
        }
        return (
          <Link to={href.includes('Student') ? '/ajuda?guia=aluno' : '/ajuda'} className={LINK}>
            {children}
          </Link>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer" className={LINK}>
          {children}
        </a>
      );
    },
  };
}

export default function HelpPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const owner = isOwner(session?.user);
  const [params] = useSearchParams();
  const { hash, search } = useLocation();
  const guide: GuideKind = owner && params.get('guia') !== 'aluno' ? 'owner' : 'student';
  const { intro, sections } = useMemo(() => parseGuide(GUIDES[guide], i18n.language), [guide, i18n.language]);
  const components = useMemo(() => markdownComponents(search, owner), [search, owner]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const target = useMemo(() => findSection(sections, decodeHash(hash))?.id, [sections, hash]);
  useEffect(() => {
    if (!target) {
      return;
    }
    setOpen((o) => new Set(o).add(target));
    requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView?.({ block: 'start' }));
  }, [target]);

  const searching = query.trim() !== '';
  const visible = searching ? sections.filter((s) => matches(s, query)) : sections;

  // Log only the settled query: one event per search the guide can't answer.
  useEffect(() => {
    const settled = query.trim().slice(0, 100);
    if (settled.length < 2 || sections.some((s) => matches(s, settled))) {
      return;
    }
    const timer = setTimeout(() => track('search_miss', guide, settled), 1000);
    return () => clearTimeout(timer);
  }, [query, sections, guide]);

  function toggled(id: string, isOpen: boolean) {
    // While searching every match is forced open; don't let that leak into the user's choices.
    if (searching) {
      return;
    }
    if (isOpen && !open.has(id)) {
      track('section_open', guide, id);
    }
    setOpen((o) => {
      const next = new Set(o);
      if (isOpen) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  const tabClass = (active: boolean) =>
    `inline-flex min-h-11 items-center border-b-2 -mb-px px-4 font-heading text-sm uppercase tracking-wide no-underline ${
      active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-3 font-heading text-2xl uppercase tracking-wide">{t('help.title')}</h1>
      {owner && (
        <nav aria-label={t('help.title')} className="mb-4 flex gap-1 border-b border-border">
          <Link to="/ajuda" aria-current={guide === 'owner' ? 'page' : undefined} className={tabClass(guide === 'owner')}>
            {t('help.ownerGuide')}
          </Link>
          <Link
            to="/ajuda?guia=aluno"
            aria-current={guide === 'student' ? 'page' : undefined}
            className={tabClass(guide === 'student')}
          >
            {t('help.studentGuide')}
          </Link>
        </nav>
      )}

      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('help.search')}
        aria-label={t('help.search')}
        className="mb-4"
      />

      {!searching && (
        <div className="mb-4 text-muted-foreground">
          <Markdown remarkPlugins={[remarkGfm]} components={components}>
            {intro}
          </Markdown>
        </div>
      )}

      {visible.length === 0 && <p className="text-muted-foreground">{t('help.noResults')}</p>}

      {visible.map((s) => {
        const isOpen = searching || open.has(s.id);
        return (
          <details
            key={`${guide}-${s.id}`}
            id={s.id}
            open={isOpen}
            onToggle={(e) => toggled(s.id, e.currentTarget.open)}
            className="group scroll-mt-4 border-b border-border"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-3 font-heading text-lg uppercase tracking-wide hover:text-primary [&::-webkit-details-marker]:hidden">
              <span>{s.title}</span>
              <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            {isOpen && (
              <div className="pb-4">
                <Markdown remarkPlugins={[remarkGfm]} components={components}>
                  {s.body}
                </Markdown>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
