import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface ClassItem {
  id: string;
  name: string;
  type: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  instructor?: string;
}

const DAY_KEYS = [
  'classes.days.sun',
  'classes.days.mon',
  'classes.days.tue',
  'classes.days.wed',
  'classes.days.thu',
  'classes.days.fri',
  'classes.days.sat',
];

export default function ClassesPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: '', dayOfWeek: '1', startTime: '', endTime: '' });
  const [checkinMsg, setCheckinMsg] = useState('');

  useEffect(() => {
    if (!user?.academyId) return;
    api<ClassItem[]>(`/classes?academyId=${user.academyId}`)
      .then(setClasses)
      .finally(() => setLoading(false));
  }, [user?.academyId]);

  const grouped = classes.reduce<Record<number, ClassItem[]>>((acc, c) => {
    (acc[c.dayOfWeek] = acc[c.dayOfWeek] || []).push(c);
    return acc;
  }, {});

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const created = await api<ClassItem>('/classes', {
      method: 'POST',
      body: JSON.stringify({ ...form, dayOfWeek: Number(form.dayOfWeek), academyId: user.academyId }),
    });
    setClasses(prev => [...prev, created]);
    setForm({ name: '', type: '', dayOfWeek: '1', startTime: '', endTime: '' });
    setShowForm(false);
  }

  async function handleCheckin(classId: string) {
    try {
      await api('/checkins', {
        method: 'POST',
        body: JSON.stringify({ classId, studentId: user.id }),
      });
      setCheckinMsg(t('classes.checkinSuccess'));
      setTimeout(() => setCheckinMsg(''), 3000);
    } catch {
      setCheckinMsg(t('classes.checkinError'));
    }
  }

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('classes.title')}</h1>

      {checkinMsg && <p style={{ color: 'green', fontWeight: 'bold' }}>{checkinMsg}</p>}

      {user?.role === 'instructor' && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px' }}>
            {showForm ? t('common.cancel') : t('classes.createClass')}
          </button>
          {showForm && (
            <form onSubmit={handleCreate} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
              <input placeholder={t('classes.className')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={{ padding: 8 }} />
              <input placeholder={t('classes.classType')} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} required style={{ padding: 8 }} />
              <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))} style={{ padding: 8 }}>
                {DAY_KEYS.map((k, i) => <option key={i} value={i}>{t(k)}</option>)}
              </select>
              <input type="time" placeholder={t('classes.startTime')} value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} required style={{ padding: 8 }} />
              <input type="time" placeholder={t('classes.endTime')} value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} required style={{ padding: 8 }} />
              <button type="submit" style={{ padding: 10 }}>{t('common.save')}</button>
            </form>
          )}
        </div>
      )}

      {[0, 1, 2, 3, 4, 5, 6].map(day => {
        const dayClasses = grouped[day];
        if (!dayClasses || dayClasses.length === 0) return null;
        return (
          <div key={day} style={{ marginBottom: 20 }}>
            <h2>{t(DAY_KEYS[day])}</h2>
            {dayClasses.map(c => (
              <div key={c.id} style={{ padding: 12, border: '1px solid #ddd', borderRadius: 6, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{c.name}</strong> <span style={{ color: '#666' }}>({c.type})</span>
                  <br />
                  <span>{c.startTime} - {c.endTime}</span>
                  {c.instructor && <span style={{ marginLeft: 12, color: '#888' }}>{c.instructor}</span>}
                </div>
                {user?.role === 'student' && (
                  <button onClick={() => handleCheckin(c.id)} style={{ padding: '6px 14px' }}>
                    {t('classes.checkin')}
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {classes.length === 0 && <p>{t('common.noResults')}</p>}
    </div>
  );
}
