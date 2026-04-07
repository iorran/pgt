interface ClassSchedule {
  recurrence: string;
  dayOfWeek: number | null;
  date: string | null;
  startTime: string;
  endTime: string;
}

const BUFFER_BEFORE_MIN = 15;
const BUFFER_AFTER_MIN = 60;

export function isClassActiveNow(cls: ClassSchedule, now: Date = new Date()): boolean {
  if (cls.recurrence === 'weekly') {
    if (cls.dayOfWeek !== now.getDay()) return false;
  } else {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (cls.date !== todayStr) return false;
  }

  const [startH, startM] = cls.startTime.split(':').map(Number);
  const [endH, endM] = cls.endTime.split(':').map(Number);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const windowStart = startMinutes - BUFFER_BEFORE_MIN;
  const windowEnd = endMinutes + BUFFER_AFTER_MIN;

  return nowMinutes >= windowStart && nowMinutes <= windowEnd;
}
