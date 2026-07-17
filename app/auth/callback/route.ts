import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/dashboard';
  }
  return raw;
}

/** OAuth callback — exchanges Supabase auth code for a session cookie */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'));
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback]', error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.rpc('ensure_user_profile');

    const googleName =
      (user.user_metadata?.full_name as string | undefined)?.trim() ||
      (user.user_metadata?.name as string | undefined)?.trim();
    if (googleName) {
      await supabase
        .from('profiles')
        .update({ display_name: googleName })
        .eq('id', user.id);
    }
  }

  // Group share links take priority over unrelated pending invites
  if (next.startsWith('/join/group/')) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (next === '/dashboard' || next.startsWith('/dashboard')) {
    const { data: invites } = await supabase.rpc('get_my_pending_invites');
    if (Array.isArray(invites) && invites.length > 0) {
      return NextResponse.redirect(`${origin}/dashboard/invites`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
