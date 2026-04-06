import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './lib/auth-client';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
import { AppLayout } from './components/layout/app-layout';

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
        <Route path="/classes" element={<div>Classes (TODO)</div>} />
        <Route path="/students" element={<div>Students (TODO)</div>} />
        <Route path="/billing" element={<div>Billing (TODO)</div>} />
        <Route path="/marketplace" element={<div>Marketplace (TODO)</div>} />
        <Route path="/gamification" element={<div>Gamification (TODO)</div>} />
        <Route path="/tournaments" element={<div>Tournaments (TODO)</div>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
