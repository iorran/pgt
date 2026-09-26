import { useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useApiQuery } from '@/hooks/use-api';
import { Link } from 'react-router-dom';
import { PageLoader } from '@/components/page-loader';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { TabsNav } from '@/components/tabs-nav';
import { Button } from '@/components/ui/button';
import { beltClasses, beltKey } from '@/lib/belts';
import { formatMoney } from '@/lib/format';
import { studentTabs } from './families';

interface Student {
  id: string;
  name: string;
  belt: string;
  dueDay?: number | null;
  monthlyFee?: string | null;
  familyName?: string | null;
  modalities?: Modality[];
}

interface Modality {
  id: string;
  name: string;
}

function ModalityBadges({ modalities = [] }: { modalities?: Modality[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {modalities.map(m => (
        <Badge key={m.id} variant="outline" className="text-xs">
          {m.name}
        </Badge>
      ))}
    </span>
  );
}

const PAGE_SIZE = 50;

export default function StudentsPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [modalityId, setModalityId] = useState('');

  const { data: students = [], isLoading } = useApiQuery<Student[]>(
    ['students', user?.academyId],
    `/students?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  // Filter options come from the loaded rows: modalities nobody trains aren't worth filtering by.
  const modalities = [
    ...new Map(students.flatMap(s => s.modalities ?? []).map(m => [m.id, m])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  const filtered = students
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    .filter(s => !modalityId || s.modalities?.some(m => m.id === modalityId))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const visible = filtered.slice(0, limit);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <TabsNav
        title={t('nav.students')}
        items={studentTabs(t)}
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length === students.length
          ? t('students.count', { count: students.length })
          : t('students.countFiltered', { shown: filtered.length, count: students.length })}
      </p>

      <Input
        type="search"
        aria-label={t('common.search')}
        placeholder={t('common.search')}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {modalities.length > 0 && (
        <div role="group" aria-label={t('students.training.modalities')} className="flex flex-wrap gap-2">
          {[{ id: '', name: t('students.training.allModalities') }, ...modalities].map(m => (
            <button
              key={m.id}
              type="button"
              aria-pressed={modalityId === m.id}
              onClick={() => setModalityId(m.id)}
              className={`min-h-11 px-4 rounded-sm text-xs font-heading uppercase transition-colors ${
                modalityId === m.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">{t('common.noResults')}</p>
      ) : (
        <>
          <ul aria-label={t('nav.students')} className="md:hidden divide-y divide-border rounded-sm border border-border">
            {visible.map(s => (
              <li key={s.id} className="relative flex items-center justify-between gap-3 p-3 hover:bg-card/80">
                <div className="min-w-0 space-y-1">
                  <Link
                    to={`/students/${s.id}`}
                    className="block truncate font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    {s.name}
                  </Link>
                  {s.familyName && <p className="text-xs text-muted-foreground truncate">{s.familyName}</p>}
                  <p className="text-sm text-muted-foreground truncate">
                    {s.monthlyFee != null ? formatMoney(s.monthlyFee, i18n.language) : '-'}
                    {s.dueDay != null && ` · ${t('students.dueDay')} ${s.dueDay}`}
                  </p>
                  <ModalityBadges modalities={s.modalities} />
                </div>
                <Badge className={beltClasses(s.belt)}>{t(beltKey(s.belt))}</Badge>
              </li>
            ))}
          </ul>
          <div className="hidden md:block rounded-sm border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('students.name')}</TableHead>
                  <TableHead>{t('students.belt')}</TableHead>
                  <TableHead>{t('students.training.modalities')}</TableHead>
                  <TableHead>{t('students.fee.title')}</TableHead>
                  <TableHead>{t('students.dueDay')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(s => (
                  <TableRow key={s.id} className="relative cursor-pointer hover:bg-card/80">
                    <TableCell>
                      <Link
                        to={`/students/${s.id}`}
                        className="hover:text-primary after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                      >
                        {s.name}
                      </Link>
                      {s.familyName && <span className="ml-2 text-xs text-muted-foreground">{s.familyName}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={beltClasses(s.belt)}>{t(beltKey(s.belt))}</Badge>
                    </TableCell>
                    <TableCell>
                      <ModalityBadges modalities={s.modalities} />
                    </TableCell>
                    <TableCell className="arena-stat">
                      {s.monthlyFee != null ? formatMoney(s.monthlyFee, i18n.language) : '-'}
                    </TableCell>
                    <TableCell className="font-mono">{s.dueDay ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length > limit && (
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setLimit(l => l + PAGE_SIZE)}>
              {t('students.showMore')}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
