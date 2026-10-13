import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading…</div>;
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
