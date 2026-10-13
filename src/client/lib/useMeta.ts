import { useEffect, useState } from 'react';
import api from './api';

export type Meta = {
  sports: { key: string; title: string }[];
  sportsbooks: { key: string; name: string; supportsDeepLink: boolean }[];
};

let cached: Meta | null = null;

/** Sports + sportsbooks for pickers (fetched once per page load) */
export default function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(cached);

  useEffect(() => {
    if (cached) return;
    api.get<Meta>('/meta').then(({ data }) => {
      cached = data;
      setMeta(data);
    });
  }, []);

  return meta;
}
