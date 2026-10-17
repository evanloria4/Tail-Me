import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import RequireAuth from './auth/RequireAuth';
import AppLayout from './components/AppLayout';
import { ToastProvider } from './components/Toast';
import Feed from './pages/Feed';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Series from './pages/Series';
import Signup from './pages/Signup';

export default function App() {
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
            <Route path="/new" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
