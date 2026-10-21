import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import supabase from '../lib/supabase';
import { DarkModeSwitch, useLayout } from '../components/AppLayout';
import { useToast } from '../components/Toast';
import AvatarPicker from '../components/AvatarPicker';
import { removeAvatar, uploadAvatar } from '../lib/avatar';
import { isPromoActive, FREE_UNTIL } from '../../shared/billing';
import { inSiteZone } from '../../shared/time';

// Everything about your own account on one page: profile, sign-in, look,
// plan, help. The account menu links here instead of listing each.

const inputClass =
  'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none focus:border-emerald-500';
const primaryButton =
  'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:opacity-50';
/** Every outlined button is the same width, so a column of them lines up */
const secondaryButton =
  'inline-flex w-40 flex-none items-center justify-center rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-gray-600 hover:bg-gray-800 hover:text-white';

/**
 * One settings row: what it is on the left, the controls on the right,
 * divided by hairlines rather than boxed in cards. Stacks on phones.
 */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-gray-800 py-7 first:border-t-0 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/**
 * A row whose control is one button (plus maybe a line of status): centered
 * on the title, status on the left, button pinned to the right edge.
 */
function ActionRow({
  title,
  status,
  children,
}: {
  title: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4 border-t border-gray-800 py-7">
      <div className="min-w-0 md:w-52 md:flex-none">
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-300">{status}</p>
        {children}
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="mb-1 block text-gray-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
      {message}
    </p>
  );
}

function ProfileSection() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.fullName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed =
    name.trim() !== (profile?.fullName ?? '') ||
    bio.trim() !== (profile?.bio ?? '');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch('/me', { fullName: name, bio });
      await refreshProfile();
      toast('Profile saved');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save your profile'));
    } finally {
      setSaving(false);
    }
  };

  // The photo saves the moment one is picked, separately from name and bio
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Remounting the picker drops a failed photo's preview
  const [pickerKey, setPickerKey] = useState(0);
  const savePhoto = async (run: () => Promise<unknown>, done: string) => {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await run();
      await refreshProfile();
      toast(done);
    } catch (err) {
      setPhotoError(
        isAxiosError(err)
          ? apiErrorMessage(err, 'Could not save your photo')
          : (err as Error).message
      );
      setPickerKey((k) => k + 1);
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <Section title="Profile">
      <div className="mb-5 space-y-2">
        <AvatarPicker
          key={pickerKey}
          name={profile?.fullName}
          url={profile?.avatarUrl}
          busy={photoBusy}
          onPick={(file) =>
            savePhoto(() => uploadAvatar(file), 'Photo updated')
          }
          onRemove={() => savePhoto(removeAvatar, 'Photo removed')}
        />
        <FormError message={photoError} />
      </div>
      <form onSubmit={save} className="space-y-3">
        <Field id="settings-name" label="Name">
          <input
            id="settings-name"
            className={inputClass}
            value={name}
            maxLength={60}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field id="settings-bio" label="Bio" hint="Up to 160 characters">
          <textarea
            id="settings-bio"
            className={`${inputClass} resize-none`}
            rows={2}
            value={bio}
            maxLength={160}
            placeholder="Hammer or fade?"
            onChange={(e) => setBio(e.target.value)}
          />
        </Field>
        <p className="text-sm text-gray-500">
          Username{' '}
          <span className="font-medium text-gray-300">
            @{profile?.username}
          </span>{' '}
          can&apos;t be changed.
        </p>
        <FormError message={error} />
        <div className="flex items-center justify-between gap-3">
          <Link
            to={`/u/${profile?.username}`}
            className="text-sm font-medium text-emerald-400 hover:underline"
          >
            View your profile
          </Link>
          <button
            type="submit"
            disabled={saving || !changed}
            className={primaryButton}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Section>
  );
}

function AccountSection() {
  const { session } = useAuth();
  const toast = useToast();
  const email = session?.user.email ?? '';
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmNext, setConfirmNext] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOpen(false);
    setCurrent('');
    setNext('');
    setConfirmNext('');
    setError(null);
  };

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError('Your new password needs at least 8 characters.');
      return;
    }
    if (next !== confirmNext) {
      setError('The new passwords don’t match.');
      return;
    }
    setSaving(true);
    // Confirm it's really them before changing anything
    const check = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (check.error) {
      setError('Your current password isn’t right.');
      setSaving(false);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({
      password: next,
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    reset();
    toast('Password changed');
  };

  return (
    <Section title="Account">
      <div className="text-sm">
        <p className="text-gray-400">Email</p>
        <p className="mt-0.5 truncate font-medium">{email}</p>
      </div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${secondaryButton} mt-4`}
        >
          Change password
        </button>
      ) : (
        <form onSubmit={change} className="mt-4 space-y-3">
          <Field id="settings-current" label="Current password">
            <input
              id="settings-current"
              type="password"
              autoComplete="current-password"
              className={inputClass}
              value={current}
              required
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field
            id="settings-new"
            label="New password"
            hint="At least 8 characters"
          >
            <input
              id="settings-new"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={next}
              required
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field id="settings-confirm" label="Confirm new password">
            <input
              id="settings-confirm"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={confirmNext}
              required
              onChange={(e) => setConfirmNext(e.target.value)}
            />
          </Field>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryButton}>
              {saving ? 'Changing…' : 'Change password'}
            </button>
          </div>
        </form>
      )}
    </Section>
  );
}

const shortDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString(
    'en-US',
    inSiteZone({ month: 'short', day: 'numeric' })
  );

/** One line on where their plan stands; the Billing page has the details */
function planSummary(
  profile: NonNullable<ReturnType<typeof useAuth>['profile']>
): string {
  if (profile.isAdmin) return 'Admin: full access, no subscription needed';
  const end = profile.currentPeriodEnd;
  switch (profile.subscriptionStatus) {
    case 'ACTIVE':
      if (end && profile.cancelAtPeriodEnd)
        return `Member until ${shortDate(end)}`;
      return end ? `Member · renews ${shortDate(end)}` : 'Member';
    case 'TRIALING':
      return end
        ? `Free trial · billing starts ${shortDate(end)}`
        : 'Free trial';
    case 'PAST_DUE':
      return 'Payment didn’t go through. Update your card.';
    default:
      return isPromoActive()
        ? `Free through ${shortDate(new Date(FREE_UNTIL.getTime() - 1))}`
        : 'Free plan: view and tail';
  }
}

export default function Settings() {
  const { profile, signOut } = useAuth();
  const { openTour } = useLayout();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="pb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your profile, sign-in and plan.
        </p>
      </header>

      {/* One panel for every section, set apart from the page */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 px-5 sm:px-8">
        <ProfileSection />
        <AccountSection />

        <Section title="Appearance">
          <div className="max-w-xs">
            <DarkModeSwitch className="-mx-2 rounded-lg px-2 py-2" />
          </div>
        </Section>

        <ActionRow
          title="Billing"
          status={profile ? planSummary(profile) : '…'}
        >
          <Link to="/billing" className={secondaryButton}>
            Manage billing
          </Link>
        </ActionRow>

        <ActionRow title="Help">
          <button type="button" onClick={openTour} className={secondaryButton}>
            Take the tour
          </button>
        </ActionRow>

        <ActionRow title="Sign out">
          <button
            type="button"
            onClick={signOut}
            className={`${secondaryButton} !text-red-400 hover:!border-red-400/50`}
          >
            Sign out
          </button>
        </ActionRow>
      </div>
    </div>
  );
}
