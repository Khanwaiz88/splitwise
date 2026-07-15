import { Suspense } from 'react';
import DashboardShell from '@/components/DashboardShell';
import MeshBackground from '@/components/ui/MeshBackground';

function DashboardShellFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <MeshBackground />
      <div
        className="w-10 h-10 border-2 border-violet-400 border-t-transparent rounded-full animate-spin relative z-10"
        aria-label="Loading"
      />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardShellFallback />}>
      <DashboardShell>
        <Suspense fallback={null}>{children}</Suspense>
      </DashboardShell>
    </Suspense>
  );
}
