import { Suspense } from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import MeshBackground from '@/components/ui/MeshBackground';
import DashboardNav from '@/components/DashboardNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name?.trim() ||
    profile?.email?.split('@')[0] ||
    user.email?.split('@')[0] ||
    'User';

  const userEmail = profile?.email ?? user.email ?? '';

  return (
    <div className="min-h-screen text-white flex relative">
      <MeshBackground />
      <Suspense fallback={null}>
        <DashboardNav userId={user.id} displayName={displayName} userEmail={userEmail} />
      </Suspense>
      <main className="page-main relative z-10 flex-1">
        <div className="page-container">
          {children}
        </div>
      </main>
    </div>
  );
}
