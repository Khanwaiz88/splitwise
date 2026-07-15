'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { acceptGroupInvite } from '@/utils/invitesApi';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const inviteToken = searchParams.get('invite');
  const prefilledEmail = searchParams.get('email') ?? '';
  const startSignup = searchParams.get('mode') === 'signup';

  const [isLogin, setIsLogin] = useState(!startSignup);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (prefilledEmail) setEmail(prefilledEmail);
    if (startSignup) setIsLogin(false);
  }, [prefilledEmail, startSignup]);

  const afterAuth = async () => {
    if (inviteToken) {
      try {
        const result = await acceptGroupInvite(inviteToken);
        localStorage.setItem('splitwise_active_group', result.groupId);
        toast.success(`Joined "${result.groupName}"!`);
        router.push('/dashboard');
        return;
      } catch {
        router.push(`/join/${inviteToken}`);
        return;
      }
    }
    router.push('/dashboard');
  };

  const handleToggle = () => {
    setIsLogin(!isLogin);
    setPassword('');
    setConfirmPassword('');
    setValidationError('');
  };

  const validate = () => {
    if (isLogin) {
      const emailErr = validateLoginEmail(email);
      if (emailErr) return emailErr;
      if (!password) return 'Password is required.';
      return '';
    }

    const emailErr = validateLoginEmail(email);
    if (emailErr) return emailErr;

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
        else if (data?.session) { toast.success('Account created!'); await afterAuth(); }
        else {
          toast.success('Check your email to verify.', { duration: 6000 });
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

  return (
    <div className="w-full max-w-[420px] widget widget-violet widget-lg shadow-2xl shadow-violet-500/20 relative z-10 animate-scale-in">
      <div className="text-center mb-8 px-1">
        <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/40 mb-5 animate-bounce-in">
          {inviteToken ? <Users className="w-7 h-7 text-white" /> : <Sparkles className="w-7 h-7 text-white" />}
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          {inviteToken ? 'Join Group' : isLogin ? 'Welcome Back' : 'Get Started'}
        </h1>
        <p className="text-white/50 text-sm mt-2 font-medium">
          {inviteToken ? 'Sign in or create an account to join'
            : isLogin ? 'Sign in to your dashboard' : 'Create your free account'}
        </p>
      </div>

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

      {validationError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-200 text-sm mb-6">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <InputField
          icon={Mail}
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          disabled={loading || !!prefilledEmail}
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
          {loading ? 'Processing…' : inviteToken ? (isLogin ? 'Sign In & Join' : 'Create Account & Join') : (isLogin ? 'Sign In' : 'Create Account')}
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
