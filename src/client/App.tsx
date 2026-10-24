import React, { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { onNotificationOpen } from './lib/push';
import { AuthProvider } from './auth/AuthProvider';
import RequireAuth from './auth/RequireAuth';
import AppLayout from './components/AppLayout';
import { ToastProvider } from './components/Toast';
import Admin from './pages/Admin';
import Billing from './pages/Billing';
import Feed from './pages/Feed';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Records from './pages/Records';
import Series from './pages/Series';
import Signup from './pages/Signup';
import Settings from './pages/Settings';

export default function App() {
  // A notification tapped while the app is already open goes to its slip
  const navigate = useNavigate();
  useEffect(() => onNotificationOpen((path) => navigate(path)), [navigate]);

  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Feed />} />
            <Route path="/u/:username" element={<Profile />} />
            <Route path="/u/:username/s/:seriesId" element={<Series />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/records" element={<Records />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/new" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
