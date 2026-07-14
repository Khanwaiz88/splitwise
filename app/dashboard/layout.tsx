import { Suspense } from 'react';
import DashboardShell from '@/components/DashboardShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell>
      <Suspense fallback={null}>{children}</Suspense>
    </DashboardShell>
  );
}
