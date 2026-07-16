'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Home, PlusCircle, Activity, Users, Sparkles, User, Inbox, MessageSquare, Menu, X,
} from 'lucide-react';
import GroupSwitcher from '@/components/GroupSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import PendingInvitesBadge from '@/components/PendingInvitesBadge';
import { usePendingInviteCount } from '@/utils/usePendingInviteCount';
import { avatarGradient } from '@/utils/avatarColor';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home, match: (p: string, q: string) => p === '/dashboard' && q !== 'add' },
  { href: '/dashboard/groups', label: 'Groups', icon: Users, match: (p: string) => p === '/dashboard/groups' },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageSquare, match: (p: string) => p === '/dashboard/chat' },
  { href: '/dashboard/invites', label: 'Invites', icon: Inbox, match: (p: string) => p === '/dashboard/invites' },
  { href: '/dashboard/activity', label: 'Activity', icon: Activity, match: (p: string) => p === '/dashboard/activity' },
  { href: '/dashboard/profile', label: 'Profile', icon: User, match: (p: string) => p === '/dashboard/profile' },
];

const MOBILE_DRAWER = NAV_ITEMS.filter((item) =>
  item.href === '/dashboard/chat' ||
  item.href === '/dashboard/invites' ||
  item.href === '/dashboard/profile' ||
  item.href === '/dashboard/activity',
);

function NavLink({ href, label, icon: Icon, active, onClick }: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
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
  const pendingInviteCount = usePendingInviteCount();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, action]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 nav-bar-solid border-b pt-safe">
        <div className="px-3 pb-3 pt-1 flex items-start gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative shrink-0 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors mt-5"
            aria-label="Open menu"
          >
            <Menu size={20} />
            {pendingInviteCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-extrabold border-2 border-[var(--nav-bg)]">
                {pendingInviteCount > 9 ? '9+' : pendingInviteCount}
              </span>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-violet-400/80 uppercase tracking-widest mb-1.5 px-0.5">
              Active Group
            </p>
            <GroupSwitcher userId={userId} />
          </div>
          <div className="shrink-0 mt-5">
            <ThemeToggle compact />
          </div>
        </div>
      </div>

      {/* Mobile slide-out sidebar */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={closeDrawer}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(280px,85vw)] nav-bar-solid border-r shadow-2xl flex flex-col pt-safe pb-safe animate-fade-in-up">
            <div className="shrink-0 p-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
              <Link href="/dashboard" onClick={closeDrawer} className="flex items-center gap-2">
                <span className="icon-badge bg-gradient-to-br from-violet-500 to-fuchsia-500">
                  <Sparkles size={16} className="text-white" />
                </span>
                <span className="text-lg font-extrabold gradient-text">Splitwise</span>
              </Link>
              <button
                type="button"
                onClick={closeDrawer}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5">
              <p className="text-[10px] font-bold text-violet-400/80 uppercase tracking-widest px-1 mb-1">More</p>
              {MOBILE_DRAWER.map(({ href, label, icon, match }) => (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  active={match(pathname, action ?? '')}
                  onClick={closeDrawer}
                />
              ))}
            </nav>

            <div className="shrink-0 p-4 border-t border-[var(--border-subtle)] space-y-3">
              <ThemeToggle />
              <Link
                href="/dashboard/profile"
                onClick={closeDrawer}
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
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 nav-bar-solid border-r h-dvh max-h-dvh sticky top-0 z-40 overflow-hidden">
        <div className="shrink-0 p-6 pb-0 animate-fade-in-up">
          <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity group">
            <span className="icon-badge bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/40 group-hover:scale-105 transition-transform">
              <Sparkles size={18} className="text-white" />
            </span>
            <span className="text-xl font-extrabold gradient-text tracking-tight">Splitwise</span>
          </Link>
        </div>

        <div className="shrink-0 px-6 pt-5 animate-fade-in-up delay-1">
          <p className="text-[10px] font-bold text-violet-400/80 uppercase tracking-widest px-1 mb-3">Active Group</p>
          <GroupSwitcher userId={userId} />
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4 flex flex-col gap-1.5 animate-fade-in-up delay-2">
          {NAV_ITEMS.filter((item) => item.href !== '/dashboard/invites').map(({ href, label, icon, match }) => (
            <NavLink key={href} href={href} label={label} icon={icon} active={match(pathname, action ?? '')} />
          ))}
          <PendingInvitesBadge />
        </nav>

        <div className="shrink-0 px-6 pb-6 pt-4 border-t border-[var(--border-subtle)] animate-fade-in-up delay-3 space-y-3 bg-[var(--nav-bg)]">
          <Link
            href="/dashboard?action=add"
            className={`flex items-center justify-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-all duration-200 w-full ${
              isAddActive
                ? 'btn-gradient'
                : 'bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 text-violet-200 border border-violet-500/25 hover:border-violet-400/40 hover:shadow-lg hover:shadow-violet-500/15'
            }`}
          >
            <PlusCircle size={18} /> Add Expense
          </Link>
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

      {/* Mobile Bottom Nav — Home | Add (center) | Groups */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 nav-bar-solid border-t pb-safe">
        <div className="grid grid-cols-3 items-end px-6 pt-2 pb-2 max-w-sm mx-auto">
          <Link
            href="/dashboard"
            className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all justify-self-start ${
              pathname === '/dashboard' && action !== 'add' ? 'text-violet-300' : 'text-white/40'
            }`}
          >
            <Home size={22} strokeWidth={pathname === '/dashboard' && action !== 'add' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Home</span>
          </Link>

          <Link href="/dashboard?action=add" className="flex flex-col items-center gap-0.5 -mt-5 justify-self-center">
            <span className={`w-14 h-14 rounded-2xl btn-gradient flex items-center justify-center shadow-xl shadow-violet-500/40 ring-4 ring-[var(--bg-base)] ${isAddActive ? 'scale-105' : ''}`}>
              <PlusCircle size={26} className="text-white" />
            </span>
            <span className="text-[10px] font-bold text-violet-300 mt-1">Add</span>
          </Link>

          <Link
            href="/dashboard/groups"
            className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all justify-self-end ${
              pathname === '/dashboard/groups' ? 'text-violet-300' : 'text-white/40'
            }`}
          >
            <Users size={22} strokeWidth={pathname === '/dashboard/groups' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Groups</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
