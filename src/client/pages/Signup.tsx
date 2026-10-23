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
import AvatarPicker from '../components/AvatarPicker';
import { uploadAvatar } from '../lib/avatar';

export default function Signup() {
  const { session, signIn, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [passcode, setPasscode] = useState('');
  const [passcodeOk, setPasscodeOk] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Optional; uploaded once the account exists and they're signed in
  const [photo, setPhoto] = useState<File | null>(null);
  const [avatarColor, setAvatarColor] = useState('emerald');
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
      // Same as the photo: nice to have, never worth blocking signup
      if (!photo && avatarColor !== 'emerald') {
        await api
          .patch('/me', { avatarColor })
          .then(refreshProfile)
          .catch(() => {});
      }
      if (photo) {
        // A photo that fails to upload isn't worth blocking signup over; they
        // can add one later in Settings
        await uploadAvatar(photo)
          .then(refreshProfile)
          .catch(() => {});
      }
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
      <AuthLayout title="Join TailMe" subtitle="Enter the group passcode">
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
        <div className="mb-4">
          <span className="mb-2 block text-sm font-medium text-gray-300">
            Profile photo or color{' '}
            <span className="text-gray-500">(optional)</span>
          </span>
          <AvatarPicker
            name={fullName}
            color={avatarColor}
            onColor={setAvatarColor}
            onPick={setPhoto}
            onRemove={() => setPhoto(null)}
          />
        </div>
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
