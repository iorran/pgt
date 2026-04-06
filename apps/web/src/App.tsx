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
import { AppLayout } from './components/layout/app-layout';
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

  if (isPending) return <div style={{ padding: 40 }}>Carregando...</div>;

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/criar-academia" element={<CriarAcademiaPage />} />
        <Route path="/entrar/:code" element={<EntrarPage />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  const user = session.user as any;

  // No academy yet (instructor mid-setup)
  if (!user.academyId) {
    return (
      <Routes>
        <Route path="/criar-academia" element={<CriarAcademiaPage />} />
        <Route path="*" element={<Navigate to="/criar-academia" />} />
      </Routes>
    );
  }

  // Pending approval
  if (user.status === 'pending') {
    return (
      <Routes>
        <Route path="/aguardando" element={<AguardandoPage />} />
        <Route path="*" element={<Navigate to="/aguardando" />} />
      </Routes>
    );
  }

  // Rejected
  if (user.status === 'rejected') {
    return (
      <Routes>
        <Route path="*" element={<RejectedView />} />
      </Routes>
    );
  }

  // Normal authenticated routes
  return (
    <Routes>
      <Route element={<AppLayout />}>
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
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
