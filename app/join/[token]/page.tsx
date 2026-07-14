'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { acceptGroupInvite } from '@/utils/invitesApi';
import MeshBackground from '@/components/ui/MeshBackground';
import { Users, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

type Preview = {
  email: string;
  groupName: string;
  status: string;
  expired: boolean;
};

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { params.then(({ token: t }) => setToken(t)); }, [params]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invites/accept?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => { if (data.error) setError(data.error); else setPreview(data); })
      .catch(() => setError('Could not load invite'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !preview || preview.expired || preview.status === 'accepted') return;
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string; email?: string | null } | null } }) => {
      const user = data.user;
      if (!user || user.email?.toLowerCase() !== preview.email.toLowerCase()) return;
      setJoining(true);
      acceptGroupInvite(token)
        .then((result) => {
          setDone(true);
          localStorage.setItem('splitwise_active_group', result.groupId);
          toast.success(`Joined "${result.groupName}"!`);
          setTimeout(() => router.push('/dashboard'), 1500);
        })
        .catch((err) => setError(err.message))
        .finally(() => setJoining(false));
    });
  }, [token, preview, supabase, router]);

  if (loading) {
    return (
      <div className="auth-shell relative">
        <MeshBackground />
        <Loader2 className="animate-spin text-violet-400 relative z-10" size={36} />
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div className="auth-shell relative">
        <MeshBackground />
        <div className="max-w-md w-full widget widget-rose widget-lg text-center relative z-10 animate-scale-in">
          <AlertCircle className="text-rose-300 mx-auto mb-4" size={44} />
          <h1 className="text-xl font-extrabold text-white mb-2">Invalid Invite</h1>
          <p className="text-white/50 text-sm mb-6">{error}</p>
          <Link href="/login" className="text-violet-300 hover:text-violet-200 text-sm font-bold">Go to Login →</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-shell relative">
        <MeshBackground />
        <div className="max-w-md w-full widget widget-lime widget-lg text-center relative z-10 animate-bounce-in">
          <CheckCircle2 className="text-lime-300 mx-auto mb-4" size={52} />
          <h1 className="text-xl font-extrabold text-white mb-2">You&apos;re in!</h1>
          <p className="text-white/50 text-sm">Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  const expired = preview?.expired || preview?.status === 'accepted';

  return (
    <div className="auth-shell relative">
      <MeshBackground />
      <div className="max-w-md w-full widget widget-violet widget-lg shadow-2xl shadow-violet-500/20 relative z-10 animate-scale-in">
        <div className="text-center mb-6">
          <span className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/40 mb-4">
            <Sparkles size={24} className="text-white" />
          </span>
          <h1 className="text-2xl font-extrabold text-white">Group Invite</h1>
          <p className="text-white/50 text-sm mt-2">You&apos;ve been invited to join</p>
          <p className="gradient-text font-extrabold text-xl mt-2 flex items-center justify-center gap-2">
            <Users size={20} /> {preview?.groupName}
          </p>
        </div>

        {expired ? (
          <div className="widget widget-amber p-4 text-amber-200 text-sm text-center font-semibold">
            This invite has expired or was already used.
          </div>
        ) : joining ? (
          <div className="flex items-center justify-center gap-2 text-white/50 py-4">
            <Loader2 size={18} className="animate-spin text-violet-400" /> Joining group…
          </div>
        ) : (
          <div className="card-list">
            <p className="text-sm text-white/50 text-center font-medium">
              Sign up or log in with <span className="text-white font-bold">{preview?.email}</span>
            </p>
            <Link href={`/login?invite=${token}&email=${encodeURIComponent(preview?.email ?? '')}&mode=signup`}
              className="block w-full py-3.5 btn-gradient rounded-xl font-extrabold text-center">
              Create Account & Join
            </Link>
            <Link href={`/login?invite=${token}&email=${encodeURIComponent(preview?.email ?? '')}`}
              className="block w-full py-3.5 glass-light border border-white/10 hover:border-violet-500/40 text-white font-bold rounded-xl text-center transition-all">
              I Already Have an Account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
