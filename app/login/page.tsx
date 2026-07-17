'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MeshBackground from '@/components/ui/MeshBackground';
import InputField from '@/components/ui/InputField';
import { Mail, Lock, Sparkles, AlertCircle, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  validateLoginEmail,
  validateSignupPassword,
  SIGNUP_PASSWORD_HINT,
} from '@/utils/authValidation';

function LoginForm() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const inviteToken = searchParams.get('invite');
  const urlEmail = searchParams.get('email') ?? '';
  const startSignup = searchParams.get('mode') === 'signup';

  const [isLogin, setIsLogin] = useState(!startSignup);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState(urlEmail);
  const [inviteGroupName, setInviteGroupName] = useState('');
  const [email, setEmail] = useState(urlEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!inviteToken) return;
    fetch(`/api/invites/accept?token=${encodeURIComponent(inviteToken)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.email) {
          setInviteEmail(data.email);
          setEmail(data.email);
        }
        if (data.groupName) setInviteGroupName(data.groupName);
      })
      .catch(() => { /* URL email used as fallback */ });
  }, [inviteToken]);

  useEffect(() => {
    if (inviteEmail) setEmail(inviteEmail);
    if (startSignup) setIsLogin(false);
  }, [inviteEmail, startSignup]);

  const afterAuth = async () => {
    const nextPath = searchParams.get('next');

    // Group share link — join that group first, don't send to unrelated invites
    if (nextPath?.startsWith('/join/group/') && !nextPath.startsWith('//')) {
      window.location.assign(nextPath);
      return;
    }

    const defaultDest =
      nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')
        ? nextPath
        : '/dashboard';

    try {
      const res = await fetch('/api/invites', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.count > 0 || inviteToken) {
          toast.success('Check your group invites — Accept or Decline.');
          window.location.assign('/dashboard/invites');
          return;
        }
      }
    } catch { /* ignore */ }

    window.location.assign(defaultDest);
  };

  const handleToggle = () => {
    if (inviteToken) return;
    setIsLogin(!isLogin);
    setPassword('');
    setConfirmPassword('');
    setValidationError('');
  };

  const validate = () => {
    const emailErr = validateLoginEmail(email);
    if (emailErr) return emailErr;

    if (inviteToken && inviteEmail && email.trim().toLowerCase() !== inviteEmail.trim().toLowerCase()) {
      return `This invite was sent to ${inviteEmail}. Use that email or ask for a new invite.`;
    }

    if (isLogin) {
      if (!password) return 'Password is required.';
      return '';
    }

    const passwordErr = validateSignupPassword(password);
    if (passwordErr) return passwordErr;
    if (password !== confirmPassword) return 'Passwords do not match.';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    const errMsg = validate();
    if (errMsg) { setValidationError(errMsg); toast.error(errMsg); return; }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) toast.error(error.message);
        else { toast.success('Welcome back!'); await afterAuth(); }
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) toast.error(error.message);
        else if (data?.session) {
          toast.success('Account created!');
          await afterAuth();
        } else {
          toast.success('Check your email to verify, then sign in to see your invites.', { duration: 6000 });
          setIsLogin(true);
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const lockedEmail = !!inviteToken && !!inviteEmail;

  return (
    <div className="w-full max-w-[420px] widget widget-violet widget-lg shadow-2xl shadow-violet-500/20 relative z-10 animate-scale-in">
      <div className="text-center mb-8 px-1">
        <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/40 mb-5 animate-bounce-in">
          {inviteToken ? <Users className="w-7 h-7 text-white" /> : <Sparkles className="w-7 h-7 text-white" />}
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          {inviteToken ? 'Group Invite' : isLogin ? 'Welcome Back' : 'Get Started'}
        </h1>
        <p className="text-white/50 text-sm mt-2 font-medium">
          {inviteToken
            ? inviteGroupName
              ? `You've been invited to "${inviteGroupName}". Sign up or log in, then Accept or Decline.`
              : 'Sign up or log in — then Accept or Decline the invite in the app.'
            : isLogin ? 'Sign in to your dashboard' : 'Create your free account'}
        </p>
      </div>

      {inviteToken && inviteEmail && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100 mb-6">
          Invite sent to <strong className="text-white">{inviteEmail}</strong>
          {lockedEmail && (
            <span className="block text-xs text-cyan-200/70 mt-1">
              Create an account with this email (not someone else&apos;s).
            </span>
          )}
        </div>
      )}

      {!inviteToken && (
        <div className="flex p-1.5 rounded-xl glass-light border border-white/10 mb-7 gap-1">
          <button type="button" onClick={() => !loading && handleToggle()} disabled={loading}
            className={`flex-1 py-3 text-sm font-extrabold rounded-lg transition-all ${isLogin ? 'btn-gradient shadow-md' : 'text-white/45 hover:text-white/70'}`}>
            Log In
          </button>
          <button type="button" onClick={() => !loading && handleToggle()} disabled={loading}
            className={`flex-1 py-3 text-sm font-extrabold rounded-lg transition-all ${!isLogin ? 'btn-gradient shadow-md' : 'text-white/45 hover:text-white/70'}`}>
            Sign Up
          </button>
        </div>
      )}

      {inviteToken && (
        <div className="flex p-1.5 rounded-xl glass-light border border-white/10 mb-7 gap-1">
          <button type="button" onClick={() => !loading && setIsLogin(false)} disabled={loading}
            className={`flex-1 py-3 text-sm font-extrabold rounded-lg transition-all ${!isLogin ? 'btn-gradient shadow-md' : 'text-white/45 hover:text-white/70'}`}>
            Sign Up
          </button>
          <button type="button" onClick={() => !loading && setIsLogin(true)} disabled={loading}
            className={`flex-1 py-3 text-sm font-extrabold rounded-lg transition-all ${isLogin ? 'btn-gradient shadow-md' : 'text-white/45 hover:text-white/70'}`}>
            Log In
          </button>
        </div>
      )}

      {validationError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-200 text-sm mb-6">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
        <InputField
          icon={Mail}
          label={lockedEmail ? 'Invite email (required)' : 'Email'}
          type="email"
          name={lockedEmail ? 'invite-email' : 'email'}
          value={email}
          onChange={lockedEmail ? () => {} : setEmail}
          placeholder="you@example.com"
          disabled={loading}
          readOnly={lockedEmail}
          autoComplete={lockedEmail ? 'off' : 'email'}
          required
        />
        <InputField
          icon={Lock}
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
          disabled={loading}
          required
        />
        {!isLogin && (
          <p className="text-xs text-white/40 -mt-3 px-1">{SIGNUP_PASSWORD_HINT}</p>
        )}
        {!isLogin && (
          <InputField
            icon={Lock}
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Repeat password"
            disabled={loading}
            required
          />
        )}
        <button type="submit" disabled={loading} className="w-full btn-gradient py-3.5 mt-2 rounded-xl font-extrabold text-sm disabled:opacity-50">
          {loading ? 'Processing…' : inviteToken ? (isLogin ? 'Sign In' : 'Create Account') : (isLogin ? 'Sign In' : 'Create Account')}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-shell relative overflow-hidden">
      <MeshBackground />
      <Suspense fallback={<div className="w-full max-w-md h-96 widget animate-shimmer rounded-2xl relative z-10" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
