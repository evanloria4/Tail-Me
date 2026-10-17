import React from 'react';
import Logo from './Logo';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-950 px-4 py-10">
      {/* Links back to the landing page */}
      <Logo />
      <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Field({ label, id, ...props }: FieldProps) {
  return (
    <label htmlFor={id} className="mb-4 block">
      <span className="mb-1 block text-sm font-medium text-gray-300">
        {label}
      </span>
      <input
        id={id}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-emerald-500"
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...props}
      />
    </label>
  );
}

export function SubmitButton({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-lg bg-emerald-500 py-2 font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
      {message}
    </p>
  );
}
