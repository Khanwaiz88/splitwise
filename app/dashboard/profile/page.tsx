'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';
import WidgetCard from '@/components/ui/WidgetCard';
import { avatarGradient, avatarShadow } from '@/utils/avatarColor';
import {
  loadProfileCache,
  saveProfileCache,
  resolveOfflineProfile,
  type CachedProfile,
} from '@/utils/profileCache';
import {
  User, Mail, Calendar, LogOut, Save, Shield, Sparkles, WifiOff, Palette,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    const applyProfile = (p: CachedProfile, cached: boolean) => {
      setProfile(p);
      setDisplayName(p.display_name);
      setFromCache(cached);
    };

    const cached = loadProfileCache();
    if (cached) {
      applyProfile(cached, true);
      setLoading(false);
    }

    const load = async () => {
      const online = navigator.onLine;
      setIsOffline(!online);

      if (!online) {
        if (!cached) {
          const fallback = resolveOfflineProfile();
          if (fallback) applyProfile(fallback, true);
        }
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/profile', { cache: 'no-store' });
        const data = await res.json();
        if (data.profile) {
          applyProfile(data.profile, false);
          saveProfileCache(data.profile);
        } else if (!cached) {
          toast.error(data.error ?? 'Failed to load profile');
        }
      } catch {
        if (!cached && !loadProfileCache()) {
          const fallback = resolveOfflineProfile();
          if (fallback) {
            applyProfile(fallback, true);
            setIsOffline(true);
          } else {
            toast.error('Failed to load profile');
          }
        } else {
          setIsOffline(true);
        }
      } finally {
        setLoading(false);
      }
    };

    load();

    const onOnline = () => {
      setIsOffline(false);
      load();
    };
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!navigator.onLine) {
      toast.error('You\'re offline — connect to save profile changes.');
      return;
    }
    const trimmed = displayName.trim();
    if (trimmed === profile.display_name) return;

    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update profile');
      setProfile(data.profile);
      setDisplayName(data.profile.display_name);
      saveProfileCache(data.profile);
      setFromCache(false);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const grad = profile ? avatarGradient(profile.id) : 'from-violet-500 to-fuchsia-500';
  const shadow = profile ? avatarShadow(profile.id) : 'shadow-violet-500/30';
  const changed = profile ? displayName.trim() !== profile.display_name : false;

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Account" title="Profile" icon={User} />

      {isOffline && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5 text-amber-100 text-sm">
          <WifiOff size={16} className="shrink-0" />
          <span>
            Offline{fromCache ? ' — showing saved profile.' : '.'} Edits need internet.
          </span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-40 widget animate-shimmer rounded-2xl" />
          <div className="h-52 widget animate-shimmer rounded-2xl" />
        </div>
      ) : profile ? (
        <>
          <WidgetCard variant="violet" delay={60} hover={false} className="text-center">
            <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-xl ${shadow} mb-4`}>
              <span className="text-2xl font-extrabold text-white">{initials(profile.display_name)}</span>
            </div>
            <h2 className="text-xl font-extrabold text-white">{profile.display_name}</h2>
            <p className="text-sm text-white/45 mt-1 truncate">{profile.email}</p>
            <div className="flex items-center justify-center gap-2 mt-3 text-xs text-violet-300/70">
              <Calendar size={14} />
              <span>Member since {formatDate(profile.created_at)}</span>
            </div>
          </WidgetCard>

          <WidgetCard variant="fuchsia" delay={120} hover={false}>
            <div className="flex items-center gap-3 mb-5">
              <span className="icon-badge bg-fuchsia-500/20 border border-fuchsia-400/30 text-fuchsia-200">
                <Sparkles size={18} />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-white">Edit Profile</h3>
                <p className="text-xs text-white/45 mt-0.5">This name shows in groups & expenses</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="form-field">
                <label className="form-label" htmlFor="display-name">Display name</label>
                <input
                  id="display-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isOffline}
                  className="input-field py-3.5 disabled:opacity-60"
                />
              </div>

              <div className="form-field">
                <label className="form-label">Email</label>
                <div className="input-field py-3.5 flex items-center gap-3 text-white/60 cursor-not-allowed">
                  <Mail size={16} className="text-violet-300 shrink-0" />
                  <span className="truncate">{profile.email}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!changed || saving || displayName.trim().length < 2 || isOffline}
                className="w-full btn-gradient py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? 'Saving...' : isOffline ? 'Offline — cannot save' : 'Save Changes'}
              </button>
            </form>
          </WidgetCard>

          <WidgetCard variant="cyan" delay={180} hover={false}>
            <div className="flex items-center gap-3 mb-4">
              <span className="icon-badge bg-cyan-500/20 border border-cyan-400/30 text-cyan-200">
                <Palette size={18} />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-white">Appearance</h3>
                <p className="text-xs text-white/45 mt-0.5">Switch between light and dark mode</p>
              </div>
            </div>
            <ThemeToggle />
          </WidgetCard>

          <WidgetCard variant="cyan" delay={200} hover={false}>
            <div className="flex items-center gap-3 mb-4">
              <span className="icon-badge bg-cyan-500/20 border border-cyan-400/30 text-cyan-200">
                <Shield size={18} />
              </span>
              <h3 className="text-base font-extrabold text-white">Account</h3>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-rose-300 font-bold border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15 transition-colors"
              >
                <LogOut size={18} /> Sign Out
              </button>
            </form>
          </WidgetCard>
        </>
      ) : (
        <WidgetCard variant="rose" hover={false} className="text-center py-10">
          <p className="text-white font-bold">Could not load profile</p>
          <p className="text-white/45 text-sm mt-2">
            {isOffline
              ? 'Open the app online once to save your profile for offline use.'
              : 'Please refresh the page.'}
          </p>
        </WidgetCard>
      )}
    </div>
  );
}
