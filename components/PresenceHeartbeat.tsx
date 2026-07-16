'use client';

import { useEffect } from 'react';
import { sendPresenceHeartbeat } from '@/utils/presenceApi';

const HEARTBEAT_MS = 30_000;

/** Keep user marked online while dashboard is open */
export default function PresenceHeartbeat({ userId }: { userId: string }) {
  useEffect(() => {
    if (!userId || userId === 'offline') return;

    const beat = () => {
      void sendPresenceHeartbeat();
    };

    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  return null;
}
