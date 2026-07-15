'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { loadProfileCache, resolveOfflineProfile } from '@/utils/profileCache';
import MeshBackground from '@/components/ui/MeshBackground';
import DashboardNav from '@/components/DashboardNav';

const OFFLINE_KEY = 'splitwise_offline_data_v2';

type ShellUser = {
  id: string;
  displayName: string;
  email: string;
};

function readCachedShellUser(): ShellUser | null {
  try {
    const profile = resolveOfflineProfile();
    const raw = localStorage.getItem(OFFLINE_KEY);
    const offline = raw ? JSON.parse(raw) : null;
    const id = profile?.id ?? offline?.currentUser?.id;
    if (!id) return null;
    const email = profile?.email ?? offline?.currentUser?.email ?? '';
    const displayName =
      profile?.display_name?.trim() ||
      email.split('@')[0] ||
      'User';
    return { id, displayName, email };
  } catch {
    return null;
  }
}

function toShellUser(authUser: User): ShellUser {
  const profile = loadProfileCache();
  return {
    id: authUser.id,
    displayName:
      profile?.display_name?.trim() ||
      authUser.email?.split('@')[0] ||
      'User',
    email: profile?.email ?? authUser.email ?? '',
  };
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<ShellUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const applyUser = (authUser: User) => {
      if (cancelled) return;
      setUser(toShellUser(authUser));
      setReady(true);
    };

    const redirectToLogin = () => {
      if (cancelled) return;
      const qs = searchParams.toString();
      const next = encodeURIComponent(`${pathname}${qs ? `?${qs}` : ''}`);
      router.replace(`/login?next=${next}`);
    };

    async function init() {
      // getSession reads local auth storage first (fast, survives refresh)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        applyUser(session.user);
        return;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        applyUser(authUser);
        return;
      }

      const cached = readCachedShellUser();
      if (cached) {
        if (!cancelled) {
          setUser(cached);
          setReady(true);
        }
        return;
      }

      if (!navigator.onLine) {
        if (!cancelled) {
          setUser({ id: 'offline', displayName: 'Offline', email: '' });
          setReady(true);
        }
        return;
      }

      redirectToLogin();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) applyUser(session.user);
      },
    );

    init();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router, pathname, searchParams]);

  if (!ready || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <MeshBackground />
        <div
          className="w-10 h-10 border-2 border-violet-400 border-t-transparent rounded-full animate-spin relative z-10"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex relative">
      <MeshBackground />
      <Suspense fallback={null}>
        <DashboardNav
          userId={user.id}
          displayName={user.displayName}
          userEmail={user.email}
        />
      </Suspense>
      <main className="page-main relative z-10 flex-1">
        <div className="page-container">{children}</div>
      </main>
    </div>
  );
}
