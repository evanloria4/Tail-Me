import { useEffect, useState } from 'react';

/** The current time, refreshed every `everyMs`, so time-based UI (LIVE tags) updates itself */
export default function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
