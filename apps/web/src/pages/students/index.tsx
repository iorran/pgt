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
import { studentTabs } from './families';

interface Student {
  id: string;
  name: string;
  belt: string;
  planName?: string | null;
  dueDay?: number | null;
  familyName?: string | null;
}

const PAGE_SIZE = 50;

export default function StudentsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: students = [], isLoading } = useApiQuery<Student[]>(
    ['students', user?.academyId],
    `/students?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const filtered = students
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const visible = filtered.slice(0, limit);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <TabsNav
        title={t('nav.students')}
        items={studentTabs(t)}
      />
      <p className="text-sm text-muted-foreground">{t('students.count', { count: students.length })}</p>

      <Input
        type="search"
        aria-label={t('common.search')}
        placeholder={t('common.search')}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

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
                    {s.planName || '-'}
                    {s.dueDay != null && ` · ${t('students.dueDay')} ${s.dueDay}`}
                  </p>
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
                  <TableHead>{t('students.plan')}</TableHead>
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
                    <TableCell>{s.planName || '-'}</TableCell>
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
