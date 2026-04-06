import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './lib/auth-client';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
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

function App() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div style={{ padding: 40 }}>Carregando...</div>;

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<div>Dashboard (TODO)</div>} />
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
