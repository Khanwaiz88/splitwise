export type CachedProfile = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
};

const PROFILE_CACHE_KEY = 'splitwise_profile_cache';
const DASHBOARD_OFFLINE_KEY = 'splitwise_offline_data_v2';

export function loadProfileCache(): CachedProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfileCache(profile: CachedProfile): void {
  localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
}

/** Fallback when profile cache missing but dashboard was loaded before */
export function loadProfileFromDashboardCache(): CachedProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DASHBOARD_OFFLINE_KEY);
    if (!raw) return null;
    const dash = JSON.parse(raw) as {
      currentUser?: { id: string; email?: string | null };
    };
    const user = dash.currentUser;
    if (!user?.id) return null;
    const email = user.email ?? '';
    return {
      id: user.id,
      email,
      display_name: email.split('@')[0] || 'User',
      created_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function resolveOfflineProfile(): CachedProfile | null {
  return loadProfileCache() ?? loadProfileFromDashboardCache();
}
