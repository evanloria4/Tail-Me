import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import RequireAuth from './auth/RequireAuth';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
