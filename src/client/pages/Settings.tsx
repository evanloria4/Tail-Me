import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import supabase from '../lib/supabase';
import { DarkModeSwitch, useLayout } from '../components/AppLayout';
import { useToast } from '../components/Toast';
import AvatarPicker from '../components/AvatarPicker';
import { removeAvatar, uploadAvatar } from '../lib/avatar';
import {
  canPromptInstall,
  currentSubscription,
  disablePush,
  enablePush,
  isIOS,
  isStandalone,
  promptInstall,
  PushDenied,
  pushSupport,
} from '../lib/push';
import type { NotificationSettings } from '../lib/push';
import { NOTIFY_LABELS, NOTIFY_TYPES } from '../../shared/notifications';
import type { NotifyPrefs, NotifyType } from '../../shared/notifications';
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
          color={profile?.avatarColor}
          busy={photoBusy}
          onPick={(file) =>
            savePhoto(() => uploadAvatar(file), 'Photo updated')
          }
          onRemove={() => savePhoto(removeAvatar, 'Photo removed')}
          onColor={(avatarColor) =>
            savePhoto(() => api.patch('/me', { avatarColor }), 'Color updated')
          }
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
/** An on/off row, styled like the dark mode switch */
function SwitchRow({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-4 rounded-lg px-2 py-2 text-left transition hover:bg-gray-800"
    >
      <span className="min-w-0">
        <span className="block text-sm text-gray-300">{label}</span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 flex-none rounded-full transition ${
          on ? 'bg-emerald-500' : 'bg-gray-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#fff] shadow transition-all ${
            on ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

/** iPhone: Share → Add to Home Screen; push only works from there */
function IosInstallSteps() {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-300">
      <li>
        In Safari, tap <span className="font-semibold">Share</span> (the square
        with the arrow)
      </li>
      <li>
        Tap <span className="font-semibold">Add to Home Screen</span>, then{' '}
        <span className="font-semibold">Add</span>
      </li>
      <li>Open TailMe from your home screen and sign in</li>
    </ol>
  );
}

function NotificationsSection() {
  const toast = useToast();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  // Whether this device is subscribed; null while checking
  const [deviceOn, setDeviceOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const support = pushSupport();
  const blocked =
    support === 'supported' && Notification.permission === 'denied';

  useEffect(() => {
    let live = true;
    api
      .get<NotificationSettings>('/me/notifications')
      .then(({ data }) => live && setSettings(data))
      .catch((err) => {
        if (live)
          setError(apiErrorMessage(err, 'Could not load notifications'));
      });
    currentSubscription()
      .then((sub) => live && setDeviceOn(!!sub))
      .catch(() => live && setDeviceOn(false));
    return () => {
      live = false;
    };
  }, []);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      if (err instanceof PushDenied) {
        setError(
          'Notifications are blocked. Allow them for TailMe in your device or browser settings, then try again.'
        );
      } else {
        setError(
          isAxiosError(err)
            ? apiErrorMessage(err, 'Something went wrong')
            : 'Could not turn notifications on. Try again.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const turnOn = () =>
    run(async () => {
      await enablePush(settings!.publicKey!);
      setDeviceOn(true);
      toast('Notifications on for this device');
    });
  const turnOff = () =>
    run(async () => {
      await disablePush();
      setDeviceOn(false);
      toast('Notifications off for this device');
    });
  const sendTest = () =>
    run(async () => {
      await api.post('/me/push/test');
      toast('Sent. It should pop up in a few seconds');
    });

  const setPref = async (type: NotifyType, on: boolean) => {
    if (!settings) return;
    const before = settings.prefs;
    setSettings({ ...settings, prefs: { ...before, [type]: on } });
    try {
      const { data } = await api.patch<{ prefs: NotifyPrefs }>(
        '/me/notifications',
        { [type]: on }
      );
      setSettings((s) => s && { ...s, prefs: data.prefs });
    } catch (err) {
      setSettings((s) => s && { ...s, prefs: before });
      toast(apiErrorMessage(err, 'Could not save that'));
    }
  };

  let device: React.ReactNode;
  if (settings && !settings.publicKey) {
    device = (
      <p className="text-sm text-gray-400">
        Notifications aren’t switched on for TailMe yet.
      </p>
    );
  } else if (support === 'needs-install') {
    device = (
      // The steps themselves are under Get the app, right below
      <p className="text-sm text-gray-300">
        On iPhone, notifications come through the TailMe app. Add it to your
        home screen (see Get the app below), then turn them on here. Needs iOS
        16.4 or later.
      </p>
    );
  } else if (support === 'unsupported') {
    device = (
      <p className="text-sm text-gray-400">
        This browser can’t show notifications. Try Chrome, Safari or the TailMe
        app on your phone.
      </p>
    );
  } else if (blocked) {
    device = (
      <p className="text-sm text-gray-400">
        Notifications are blocked for TailMe on this device. Allow them in your
        settings (on iPhone: Settings → Notifications → TailMe), then reload.
      </p>
    );
  } else {
    device = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-300">
          {deviceOn === null && '…'}
          {deviceOn === true && 'On for this device'}
          {deviceOn === false && 'Off for this device'}
        </p>
        <div className="flex flex-wrap gap-2">
          {deviceOn && (
            <button
              type="button"
              onClick={sendTest}
              disabled={busy}
              className={secondaryButton}
            >
              Send a test
            </button>
          )}
          {deviceOn ? (
            <button
              type="button"
              onClick={turnOff}
              disabled={busy}
              className={secondaryButton}
            >
              Turn off
            </button>
          ) : (
            <button
              type="button"
              onClick={turnOn}
              disabled={busy || deviceOn === null || !settings}
              className={`${primaryButton} w-40`}
            >
              Turn on
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Section title="Notifications">
      <div className="space-y-5">
        {device}
        <FormError message={error} />
        {settings && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Notify me about
            </p>
            {NOTIFY_TYPES.map((type) => (
              <SwitchRow
                key={type}
                label={NOTIFY_LABELS[type].label}
                hint={NOTIFY_LABELS[type].hint}
                on={settings.prefs[type]}
                onChange={(on) => setPref(type, on)}
              />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

/** Get the home-screen app; hidden once you're in it */
function AppSection() {
  const toast = useToast();
  const [canInstall, setCanInstall] = useState(canPromptInstall);
  if (isStandalone()) return null;

  if (isIOS()) {
    return (
      <Section title="Get the app">
        <div className="space-y-3">
          <p className="text-sm text-gray-300">
            Put TailMe on your home screen: full screen, its own icon, and
            notifications.
          </p>
          <IosInstallSteps />
        </div>
      </Section>
    );
  }
  if (!canInstall) return null;
  return (
    <ActionRow
      title="Get the app"
      status="Install TailMe: its own icon and window, plus notifications"
    >
      <button
        type="button"
        onClick={async () => {
          const installed = await promptInstall();
          setCanInstall(false);
          if (installed) toast('Installed. Find TailMe with your apps');
        }}
        className={secondaryButton}
      >
        Install
      </button>
    </ActionRow>
  );
}

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
          Your profile, sign-in, notifications and plan.
        </p>
      </header>

      {/* One panel for every section, set apart from the page */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 px-5 sm:px-8">
        <ProfileSection />
        <AccountSection />

        <NotificationsSection />
        <AppSection />

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
