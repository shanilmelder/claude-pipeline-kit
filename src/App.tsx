import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginScreen } from './components/LoginScreen/LoginScreen';
import { DashboardPage } from './pages/DashboardPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}
