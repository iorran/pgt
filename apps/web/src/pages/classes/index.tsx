import { useSession } from '@/lib/auth-client';
import { InstructorClassesView } from './instructor-view';
import { StudentClassesView } from './student-view';

export default function ClassesPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  if (user?.role === 'instructor') return <InstructorClassesView />;
  return <StudentClassesView />;
}
