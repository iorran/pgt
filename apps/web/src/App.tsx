import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession, signOut } from './lib/auth-client';
import { useTranslation } from 'react-i18next';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
import CriarAcademiaPage from './pages/criar-academia';
import EntrarPage from './pages/entrar';
import AguardandoPage from './pages/aguardando';
import DashboardPage from './pages/dashboard';
import PendingStudentsPage from './pages/pending-students';
import { StaffShell } from './components/layout/staff-shell';
import { StudentShell } from './components/layout/student-shell';
import MePage from './pages/me';
import BillingStatusPage from './pages/me/billing-status';
import ClassesPage from './pages/classes/index';
import CheckinHistoryPage from './pages/classes/checkin';
import StudentsPage from './pages/students/index';
import StudentDetailPage from './pages/students/detail';
import BillingOverduePage from './pages/billing/index';
import PlansPage from './pages/billing/plans';
import PaymentsPage from './pages/billing/payments';
import MarketplacePage from './pages/marketplace/index';
import OrdersPage from './pages/marketplace/orders';
import LeaderboardPage from './pages/gamification/leaderboard';
import SeasonsPage from './pages/gamification/seasons';
import ResultsPage from './pages/gamification/results';
import GamificationProfilePage from './pages/gamification/profile';
import TournamentsPage from './pages/tournaments/index';
import ForgotPasswordPage from './pages/forgot-password';
import ResetPasswordPage from './pages/reset-password';
import TotemPage from './pages/totem';
import CheckinScanPage from './pages/checkin-scan';
import SettingsPage from './pages/settings';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { useNavigate } from 'react-router-dom';

function RejectedView() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center arena-stripes px-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="pt-8 pb-8 px-8 text-center space-y-6">
          <h1 className="font-display text-4xl text-primary leading-none arena-glow">
            PGT
          </h1>
          <h2 className="font-heading text-2xl text-foreground uppercase">
            {t('onboarding.rejectedTitle')}
          </h2>
          <p className="text-muted-foreground">
            {t('onboarding.rejectedMessage')}
          </p>
          <Button variant="outline" onClick={handleSignOut}>
            {t('auth.logout')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function App() {
  const { data: session, isPending } = useSession();

  console.log('[App] isPending:', isPending, 'session:', session ? { user: { id: (session.user as any).id, academyId: (session.user as any).academyId, role: (session.user as any).role, status: (session.user as any).status } } : null);

  if (isPending) {
    console.log('[App] Routing → loading');
    return <div style={{ padding: 40 }}>Carregando...</div>;
  }

  if (!session) {
    console.log('[App] Routing → unauthenticated (login/signup)');
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/criar-academia" element={<CriarAcademiaPage />} />
        <Route path="/entrar/:code" element={<EntrarPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/checkin" element={<CheckinScanPage />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  const user = session.user as any;

  // No academy yet — allow both flows (create academy OR join via code)
  if (!user.academyId) {
    console.log('[App] Routing → no academy (criar-academia)');
    return (
      <Routes>
        <Route path="/criar-academia" element={<CriarAcademiaPage />} />
        <Route path="/entrar/:code" element={<EntrarPage />} />
        <Route path="*" element={<Navigate to="/criar-academia" />} />
      </Routes>
    );
  }

  // Pending approval
  if (user.status === 'pending') {
    console.log('[App] Routing → pending approval');
    return (
      <Routes>
        <Route path="/aguardando" element={<AguardandoPage />} />
        <Route path="*" element={<Navigate to="/aguardando" />} />
      </Routes>
    );
  }

  // Rejected
  if (user.status === 'rejected') {
    console.log('[App] Routing → rejected');
    return (
      <Routes>
        <Route path="*" element={<RejectedView />} />
      </Routes>
    );
  }

  console.log('[App] Routing → authenticated (dashboard)');

  // Normal authenticated routes
  const Shell = (user.role as string) === 'student' ? StudentShell : StaffShell;

  return (
    <Routes>
      <Route path="/totem" element={<TotemPage />} />
      <Route path="/checkin" element={<CheckinScanPage />} />
      <Route element={<Shell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/pending" element={<PendingStudentsPage />} />
        <Route path="/classes" element={<ClassesPage />} />
        <Route path="/classes/history" element={<CheckinHistoryPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/:id" element={<StudentDetailPage />} />
        <Route path="/billing" element={<BillingOverduePage />} />
        <Route path="/billing/plans" element={<PlansPage />} />
        <Route path="/billing/payments" element={<PaymentsPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/marketplace/orders" element={<OrdersPage />} />
        <Route path="/gamification" element={<LeaderboardPage />} />
        <Route path="/gamification/seasons" element={<SeasonsPage />} />
        <Route path="/gamification/results" element={<ResultsPage />} />
        <Route path="/gamification/profile" element={<GamificationProfilePage />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/me" element={<MePage />} />
        <Route path="/me/billing" element={<BillingStatusPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
