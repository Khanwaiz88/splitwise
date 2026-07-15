'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, getStoredTheme, type Theme } from '@/utils/theme';

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const switchTheme = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => switchTheme(theme === 'light' ? 'dark' : 'light')}
        className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        title={theme === 'light' ? 'Dark mode' : 'Light mode'}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    );
  }

  return (
    <div className="flex w-full gap-2 p-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]">
      <button
        type="button"
        onClick={() => switchTheme('light')}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
          theme === 'light'
            ? 'bg-[var(--surface)] text-[var(--fg)] shadow-sm border border-[var(--border)]'
            : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
        }`}
      >
        <Sun size={16} /> Light
      </button>
      <button
        type="button"
        onClick={() => switchTheme('dark')}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
          theme === 'dark'
            ? 'bg-[var(--surface)] text-[var(--fg)] shadow-sm border border-[var(--border)]'
            : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
        }`}
      >
        <Moon size={16} /> Dark
      </button>
    </div>
  );
}
