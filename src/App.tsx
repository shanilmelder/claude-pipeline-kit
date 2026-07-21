import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginScreen } from './components/LoginScreen/LoginScreen';
import { ForgotPasswordScreen } from './components/ForgotPasswordScreen/ForgotPasswordScreen';
import { ResetPasswordScreen } from './components/ResetPasswordScreen/ResetPasswordScreen';
import { DashboardPage } from './pages/DashboardPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
      <Route path="/reset-password" element={<ResetPasswordScreen />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}