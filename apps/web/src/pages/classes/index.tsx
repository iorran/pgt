import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';
import { InstructorClassesView } from './instructor-view';
import { StudentClassesView } from './student-view';

export default function ClassesPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  if (isOwner(user)) return <InstructorClassesView />;
  return <StudentClassesView />;
}
