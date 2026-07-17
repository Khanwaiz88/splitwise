'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import MeshBackground from '@/components/ui/MeshBackground';
import { Users, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function JoinGroupPage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const joinedRef = useRef(false);

  useEffect(() => { params.then(({ code: c }) => setCode(c)); }, [params]);

  useEffect(() => {
    if (!code) return;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      setLoggedIn(!!auth.user);
    })();
    fetch(`/api/groups/join?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setGroupName(data.groupName);
      })
      .catch(() => setError('Could not load group link'))
      .finally(() => setLoading(false));
  }, [code, supabase]);

  const handleJoin = async (auto = false) => {
    if (joinedRef.current) return;
    setJoining(true);
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to join group');

      joinedRef.current = true;
      toast.success(
        data.alreadyMember
          ? `You're already in ${data.groupName}`
          : `Joined ${data.groupName}!`,
      );
      router.replace('/dashboard/groups');
    } catch (err) {
      if (!auto) {
        toast.error(err instanceof Error ? err.message : 'Failed to join group');
      }
    } finally {
      setJoining(false);
    }
  };

  // After sign-in from this link, join exactly this one group automatically
  useEffect(() => {
    if (!loggedIn || !code || loading || !groupName || joinedRef.current) return;
    void handleJoin(true);
  }, [loggedIn, code, loading, groupName]);

  if (loading || (loggedIn && joining)) {
    return (
      <div className="auth-shell relative">
        <MeshBackground />
        <Loader2 className="animate-spin text-violet-400 relative z-10" size={36} />
      </div>
    );
  }

  if (error && !groupName) {
    return (
      <div className="auth-shell relative">
        <MeshBackground />
        <div className="max-w-md w-full widget widget-rose widget-lg text-center relative z-10 animate-scale-in">
          <AlertCircle className="text-rose-300 mx-auto mb-4" size={44} />
          <h1 className="text-xl font-extrabold text-white mb-2">Invalid Link</h1>
          <p className="text-white/50 text-sm mb-6">{error}</p>
          <Link href="/login" className="text-violet-300 hover:text-violet-200 text-sm font-bold">Go to Login →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell relative">
      <MeshBackground />
      <div className="max-w-md w-full widget widget-violet widget-lg shadow-2xl shadow-violet-500/20 relative z-10 animate-scale-in">
        <div className="text-center mb-6">
          <span className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/40 mb-4">
            <Sparkles size={24} className="text-white" />
          </span>
          <h1 className="text-2xl font-extrabold text-white">Join Group</h1>
          <p className="text-white/50 text-sm mt-2">You&apos;ve been invited to join</p>
          <p className="gradient-text font-extrabold text-xl mt-2 flex items-center justify-center gap-2">
            <Users size={20} /> {groupName}
          </p>
        </div>

        {loggedIn ? (
          <button
            type="button"
            onClick={() => void handleJoin(false)}
            disabled={joining}
            className="w-full py-3.5 btn-gradient rounded-xl font-extrabold flex items-center justify-center gap-2"
          >
            {joining ? <Loader2 size={18} className="animate-spin" /> : null}
            Join Group
          </button>
        ) : (
          <div className="card-list">
            <p className="text-sm text-white/50 text-center">Sign in or create an account to join this group.</p>
            <Link
              href={`/login?next=${encodeURIComponent(`/join/group/${code}`)}`}
              className="block w-full py-3.5 btn-gradient rounded-xl font-extrabold text-center"
            >
              Sign In to Join
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
