'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MeshBackground from '@/components/ui/MeshBackground';
import InputField from '@/components/ui/InputField';
import { Mail, Lock, Sparkles, AlertCircle, Users, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  validateLoginEmail,
  validateSignupPassword,
  SIGNUP_PASSWORD_HINT,
} from '@/utils/authValidation';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const inviteToken = searchParams.get('invite');
  const urlEmail = searchParams.get('email') ?? '';
  const startSignup = searchParams.get('mode') === 'signup';

  const [isLogin, setIsLogin] = useState(!startSignup);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  useEffect(() => {
    const authError = searchParams.get('error');
    if (authError === 'auth_callback_failed') {
      toast.error('Google sign-in failed. Please try again.');
    } else if (authError === 'missing_code') {
      toast.error('Sign-in was cancelled or incomplete.');
    }
  }, [searchParams]);

  const buildCallbackUrl = () => {
    const nextPath = searchParams.get('next');
    const params = new URLSearchParams();
    if (nextPath) params.set('next', nextPath);
    const qs = params.toString();
    return `${window.location.origin}/auth/callback${qs ? `?${qs}` : ''}`;
  };

  const handleGoogleSignIn = async () => {
    if (inviteToken && inviteEmail) {
      toast(
        `Use the Google account for ${inviteEmail}, or sign up with email/password.`,
        { icon: 'ℹ️' },
      );
    }

    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: buildCallbackUrl(),
        },
      });
      if (error) toast.error(error.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed');
      setGoogleLoading(false);
    }
  };

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
  const busy = loading || googleLoading;

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
          <button type="button" onClick={() => !busy && handleToggle()} disabled={busy}
            className={`flex-1 py-3 text-sm font-extrabold rounded-lg transition-all ${isLogin ? 'btn-gradient shadow-md' : 'text-white/45 hover:text-white/70'}`}>
            Log In
          </button>
          <button type="button" onClick={() => !busy && handleToggle()} disabled={busy}
            className={`flex-1 py-3 text-sm font-extrabold rounded-lg transition-all ${!isLogin ? 'btn-gradient shadow-md' : 'text-white/45 hover:text-white/70'}`}>
            Sign Up
          </button>
        </div>
      )}

      {inviteToken && (
        <div className="flex p-1.5 rounded-xl glass-light border border-white/10 mb-7 gap-1">
          <button type="button" onClick={() => !busy && setIsLogin(false)} disabled={busy}
            className={`flex-1 py-3 text-sm font-extrabold rounded-lg transition-all ${!isLogin ? 'btn-gradient shadow-md' : 'text-white/45 hover:text-white/70'}`}>
            Sign Up
          </button>
          <button type="button" onClick={() => !busy && setIsLogin(true)} disabled={busy}
            className={`flex-1 py-3 text-sm font-extrabold rounded-lg transition-all ${isLogin ? 'btn-gradient shadow-md' : 'text-white/45 hover:text-white/70'}`}>
            Log In
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={busy}
        className="w-full flex items-center justify-center gap-3 py-3.5 mb-6 rounded-xl border border-white/12 bg-white/[0.06] hover:bg-white/[0.1] hover:border-white/20 text-white font-bold text-sm transition-all disabled:opacity-50"
      >
        {googleLoading ? (
          <Loader2 size={20} className="animate-spin text-white/70" />
        ) : (
          <GoogleIcon className="w-5 h-5" />
        )}
        Continue with Google
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[11px] font-bold text-white/35 uppercase tracking-wider">or email</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

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
          disabled={busy}
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
          disabled={busy}
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
            disabled={busy}
            required
          />
        )}
        <button type="submit" disabled={busy} className="w-full btn-gradient py-3.5 mt-2 rounded-xl font-extrabold text-sm disabled:opacity-50">
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
