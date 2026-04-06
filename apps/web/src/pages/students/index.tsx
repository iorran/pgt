import { useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useApiQuery } from '@/hooks/use-api';
import { Link } from 'react-router-dom';
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

interface Student {
  id: string;
  name: string;
  belt: string;
  plan?: string;
  dueDay?: number;
}

const BELT_CLASSES: Record<string, string> = {
  white: 'bg-gray-200 text-gray-800',
  blue: 'bg-belt-blue text-white',
  purple: 'bg-belt-purple text-white',
  brown: 'bg-belt-brown text-white',
  black: 'bg-belt-black text-white',
};

function getBeltClasses(belt: string) {
  return BELT_CLASSES[belt?.toLowerCase()] || 'bg-gray-200 text-gray-800';
}

export default function StudentsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [search, setSearch] = useState('');

  const { data: students = [], isLoading } = useApiQuery<Student[]>(
    ['students', user?.academyId],
    `/students?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="p-5 text-muted-foreground">{t('common.loading')}</div>;

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="font-heading uppercase tracking-wider text-lg">{t('students.title')}</h1>
        <Badge variant="outline">{students.length}</Badge>
      </div>

      <Input
        placeholder={t('common.search')}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">{t('common.noResults')}</p>
      ) : (
        <div className="rounded-sm border border-border">
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
              {filtered.map(s => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-card/80">
                  <TableCell>
                    <Link to={`/students/${s.id}`} className="hover:text-primary">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge className={getBeltClasses(s.belt)}>{s.belt}</Badge>
                  </TableCell>
                  <TableCell>{s.plan || '-'}</TableCell>
                  <TableCell className="font-mono">{s.dueDay ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
