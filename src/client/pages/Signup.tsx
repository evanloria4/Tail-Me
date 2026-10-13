import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import {
  AuthLayout,
  Field,
  FormError,
  SubmitButton,
} from '../components/AuthLayout';

export default function Signup() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();

  const [passcode, setPasscode] = useState('');
  const [passcodeOk, setPasscodeOk] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const checkPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/passcode', { passcode });
      setPasscodeOk(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Incorrect passcode'));
    } finally {
      setSubmitting(false);
    }
  };

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/signup', {
        passcode,
        fullName,
        username,
        email,
        password,
      });
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create account'));
    } finally {
      setSubmitting(false);
    }
  };

  const signInLink = (
    <p className="mt-6 text-center text-sm text-gray-400">
      Already have an account?{' '}
      <Link to="/login" className="text-emerald-400 hover:underline">
        Sign in
      </Link>
    </p>
  );

  if (!passcodeOk) {
    return (
      <AuthLayout title="Join Tail Me" subtitle="Enter the group passcode">
        <form onSubmit={checkPasscode}>
          <FormError message={error} />
          <Field
            id="passcode"
            label="Passcode"
            type="password"
            autoComplete="off"
            required
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
          <SubmitButton disabled={submitting}>
            {submitting ? 'Checking…' : 'Continue'}
          </SubmitButton>
        </form>
        {signInLink}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account">
      <form onSubmit={createAccount}>
        <FormError message={error} />
        <Field
          id="fullName"
          label="Full name"
          autoComplete="name"
          required
          maxLength={60}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Field
          id="username"
          label="Username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]+"
          title="Letters, numbers and underscores"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
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
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </SubmitButton>
      </form>
      {signInLink}
    </AuthLayout>
  );
}
