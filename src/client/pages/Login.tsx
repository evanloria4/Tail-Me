import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import {
  AuthLayout,
  Field,
  FormError,
  SubmitButton,
} from '../components/AuthLayout';

export default function Login() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Back where they were headed, query included (a shared /?slip=<id> link)
  const fromLocation = (location.state as { from?: Location })?.from;
  const from = fromLocation
    ? `${fromLocation.pathname}${fromLocation.search ?? ''}`
    : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Navigate to={from} replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch {
      setError('Incorrect email or password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to see the slips">
      <form onSubmit={onSubmit}>
        <FormError message={error} />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-gray-400">
        New here?{' '}
        <Link to="/signup" className="text-emerald-400 hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
