'use client';

import { useEffect } from 'react';
import { applyTheme, getStoredTheme } from '@/utils/theme';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  return children;
}
