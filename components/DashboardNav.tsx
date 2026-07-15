'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, PlusCircle, Activity, Users, Sparkles, User } from 'lucide-react';
import GroupSwitcher from '@/components/GroupSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import { avatarGradient } from '@/utils/avatarColor';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home, match: (p: string, q: string) => p === '/dashboard' && q !== 'add' },
  { href: '/dashboard/groups', label: 'Groups', icon: Users, match: (p: string) => p === '/dashboard/groups' },
  { href: '/dashboard/activity', label: 'Activity', icon: Activity, match: (p: string) => p === '/dashboard/activity' },
  { href: '/dashboard/profile', label: 'Profile', icon: User, match: (p: string) => p === '/dashboard/profile' },
];

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Home; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-violet-500/25 to-fuchsia-500/20 text-white border border-violet-500/30 shadow-lg shadow-violet-500/10'
          : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      <Icon size={18} className={active ? 'text-violet-300' : ''} />
      {label}
    </Link>
  );
}

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DashboardNav({
  userId,
  displayName,
  userEmail,
}: {
  userId: string;
  displayName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  const isAddActive = pathname === '/dashboard' && action === 'add';
  const isProfileActive = pathname === '/dashboard/profile';
  const grad = avatarGradient(userId);

  return (
    <>
      {/* Mobile top bar — group switcher (sidebar is desktop-only) */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 nav-bar-solid border-b pt-safe">
        <div className="px-4 pb-3 pt-1 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-violet-400/80 uppercase tracking-widest mb-1.5 px-0.5">
              Active Group
            </p>
            <GroupSwitcher userId={userId} />
          </div>
          <ThemeToggle compact />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 nav-bar-solid border-r h-screen sticky top-0 p-6 gap-5 overflow-y-auto z-40">
        <div className="mb-2 px-1 animate-fade-in-up">
          <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity group">
            <span className="icon-badge bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/40 group-hover:scale-105 transition-transform">
              <Sparkles size={18} className="text-white" />
            </span>
            <span className="text-xl font-extrabold gradient-text tracking-tight">Splitwise</span>
          </Link>
        </div>

        <div className="animate-fade-in-up delay-1 shrink-0 space-y-3">
          <p className="text-[10px] font-bold text-violet-400/80 uppercase tracking-widest px-1">Active Group</p>
          <GroupSwitcher userId={userId} />
        </div>

        <nav className="flex-1 flex flex-col gap-1.5 animate-fade-in-up delay-2 min-h-0">
          {NAV_ITEMS.map(({ href, label, icon, match }) => (
            <NavLink key={href} href={href} label={label} icon={icon} active={match(pathname, action ?? '')} />
          ))}
          <Link
            href="/dashboard?action=add"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold mt-2 transition-all duration-200 ${
              isAddActive
                ? 'btn-gradient'
                : 'bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 text-violet-200 border border-violet-500/25 hover:border-violet-400/40 hover:shadow-lg hover:shadow-violet-500/15'
            }`}
          >
            <PlusCircle size={18} /> Add Expense
          </Link>
        </nav>

        <div className="animate-fade-in-up delay-3 space-y-3 pt-4 border-t border-[var(--border-subtle)]">
          <ThemeToggle />
          <Link
            href="/dashboard/profile"
            className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
              isProfileActive
                ? 'bg-violet-500/15 border border-violet-500/25'
                : 'hover:bg-white/5 border border-transparent'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 shadow-lg`}>
              <span className="text-xs font-extrabold text-white">{profileInitials(displayName)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{displayName}</p>
              <p className="text-xs text-white/40 truncate">{userEmail}</p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 nav-bar-solid border-t pb-safe">
        <div className="flex items-end justify-around px-2 pt-2.5 pb-2">
          {NAV_ITEMS.filter((item) => item.href !== '/dashboard/profile').map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname, action ?? '');
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all ${
                  active ? 'text-violet-300' : 'text-white/40'
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            );
          })}

          <Link href="/dashboard?action=add" className="flex flex-col items-center gap-0.5 px-1 -mt-5">
            <span className="w-14 h-14 rounded-2xl btn-gradient flex items-center justify-center shadow-xl shadow-violet-500/40 ring-4 ring-[var(--bg-base)]">
              <PlusCircle size={26} className="text-white" />
            </span>
            <span className="text-[10px] font-bold text-violet-300 mt-1">Add</span>
          </Link>

          <Link
            href="/dashboard/profile"
            className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all ${
              isProfileActive ? 'text-violet-300' : 'text-white/40'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center ${isProfileActive ? 'ring-2 ring-violet-400/50' : ''}`}>
              <span className="text-[9px] font-extrabold text-white">{profileInitials(displayName)}</span>
            </div>
            <span className="text-[10px] font-semibold">Profile</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
