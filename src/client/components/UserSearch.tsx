import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import type { PersonRef } from '../../shared/social';
import UserAvatar from './UserAvatar';

// Navbar user search: suggestions drop down as you type (name or
// @username), arrow keys move through them, Enter or a click opens the
// profile. GET /api/users?q=

/** Wait this long after the last keystroke before asking the server */
const DEBOUNCE_MS = 150;

export default function UserSearch({
  onDone,
  className = '',
}: {
  /** After opening a profile, e.g. to close the phone menu */
  onDone?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonRef[] | null>(null);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  // Ask after a short pause; a newer query wins over a slow older one
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return undefined;
    }
    let live = true;
    const id = setTimeout(() => {
      api
        .get<PersonRef[]>('/users', { params: { q } })
        .then(({ data }) => {
          if (!live) return;
          setResults(data);
          setActive(0);
        })
        .catch(() => live && setResults([]));
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [query]);

  // A click anywhere else closes the list
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const go = (person: PersonRef) => {
    navigate(`/u/${person.username}`);
    setQuery('');
    setResults(null);
    setOpen(false);
    onDone?.();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!results?.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    }
  };

  const showList = open && query.trim() !== '' && results !== null;

  return (
    <div ref={box} className={`relative ${className}`}>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <circle cx="9" cy="9" r="5.5" />
        <path d="M13.5 13.5 17 17" />
      </svg>
      <input
        type="search"
        role="combobox"
        aria-label="Search users"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && results?.length ? `${listId}-${active}` : undefined
        }
        placeholder="Search users"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-full border border-gray-800 bg-gray-900 py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 outline-none transition focus:border-emerald-500"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Users"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 py-1 shadow-xl"
        >
          {results.length ? (
            results.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: fires before the input loses focus
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(p);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 ${
                  i === active ? 'bg-gray-800' : ''
                }`}
              >
                <UserAvatar
                  name={p.fullName}
                  url={p.avatarUrl}
                  color={p.avatarColor}
                  className="h-8 w-8 flex-none text-sm"
                />
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold leading-tight">
                    {p.fullName}
                  </span>
                  <span className="block break-all text-xs text-gray-500">
                    @{p.username}
                  </span>
                </span>
              </li>
            ))
          ) : (
            <li className="px-3 py-2.5 text-sm text-gray-500">
              No one matches &ldquo;{query.trim()}&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
