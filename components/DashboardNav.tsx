'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, PlusCircle, Activity, Users, Sparkles, User, Inbox, MessageSquare } from 'lucide-react';
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
  const pendingInviteCount = usePendingInviteCount();

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
          <PendingInvitesBadge compact />
        </div>
      </div>

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

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 nav-bar-solid border-t pb-safe">
        <div className="flex items-end justify-around px-1 pt-2.5 pb-2">
          {NAV_ITEMS.filter((item) =>
            item.href !== '/dashboard/profile' &&
            item.href !== '/dashboard/activity' &&
            item.href !== '/dashboard/invites' &&
            item.href !== '/dashboard/chat',
          ).map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname, action ?? '');
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[52px] ${
                  active ? 'text-violet-300' : 'text-white/40'
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            );
          })}

          <Link
            href="/dashboard/chat"
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[52px] ${
              pathname === '/dashboard/chat' ? 'text-violet-300' : 'text-white/40'
            }`}
          >
            <MessageSquare size={21} strokeWidth={pathname === '/dashboard/chat' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Chat</span>
          </Link>

          <Link
            href="/dashboard/invites"
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[52px] ${
              pathname === '/dashboard/invites' ? 'text-violet-300' : 'text-white/40'
            }`}
          >
            <span className="relative">
              <Inbox size={21} strokeWidth={pathname === '/dashboard/invites' ? 2.5 : 2} />
              {pendingInviteCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[8px] font-extrabold">
                  {pendingInviteCount > 9 ? '9+' : pendingInviteCount}
                </span>
              )}
            </span>
            <span className="text-[10px] font-semibold">Invites</span>
          </Link>

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
