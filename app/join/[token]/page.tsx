'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import MeshBackground from '@/components/ui/MeshBackground';
import { Users, Loader2, AlertCircle, Sparkles, LogOut } from 'lucide-react';
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
  const [error, setError] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

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
    void (async () => {
      const { data } = await supabase.auth.getUser();
      setSessionEmail(data.user?.email?.toLowerCase() ?? null);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!preview || preview.expired || preview.status !== 'pending') return;
    if (!sessionEmail) return;
    if (sessionEmail === preview.email.toLowerCase()) {
      toast.success('You have a group invite — Accept or Decline.');
      router.replace('/dashboard/invites');
    }
  }, [preview, sessionEmail, router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSessionEmail(null);
    setSigningOut(false);
    toast.success('Signed out. Now sign up with the invite email.');
  };

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

  const expired = preview?.expired || preview?.status === 'accepted' || preview?.status === 'declined';
  const wrongAccount = sessionEmail && preview && sessionEmail !== preview.email.toLowerCase();

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
        ) : wrongAccount ? (
          <div className="card-list">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              You&apos;re signed in as <strong>{sessionEmail}</strong>, but this invite is for{' '}
              <strong>{preview?.email}</strong>. Sign out first, then create an account with the invite email.
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full py-3.5 flex items-center justify-center gap-2 glass-light border border-white/10 rounded-xl font-bold text-white"
            >
              {signingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
              Sign Out
            </button>
          </div>
        ) : (
          <div className="card-list">
            <p className="text-sm text-white/50 text-center font-medium">
              Invite for <span className="text-white font-bold">{preview?.email}</span>
            </p>
            <p className="text-xs text-white/40 text-center">
              After sign up you&apos;ll see Accept / Decline — you won&apos;t be added until you accept.
            </p>
            <Link
              href={`/login?invite=${token}&email=${encodeURIComponent(preview?.email ?? '')}&mode=signup`}
              className="block w-full py-3.5 btn-gradient rounded-xl font-extrabold text-center"
            >
              Create Account
            </Link>
            <Link
              href={`/login?invite=${token}&email=${encodeURIComponent(preview?.email ?? '')}`}
              className="block w-full py-3.5 glass-light border border-white/10 hover:border-violet-500/40 text-white font-bold rounded-xl text-center transition-all"
            >
              I Already Have an Account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
