import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { PROFILE_FIELDS } from '@/utils/profileMap';

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
};

function formatProfile(profile: ProfileRow, user: User) {
  return {
    id: profile.id,
    email: profile.email ?? user.email ?? '',
    display_name:
      profile.display_name?.trim() ||
      profile.email?.split('@')[0] ||
      user.email?.split('@')[0] ||
      'User',
    created_at: profile.created_at,
  };
}

async function getOrCreateProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
): Promise<ProfileRow> {
  const { data: rpcProfile, error: rpcError } = await supabase.rpc('ensure_user_profile');

  if (!rpcError && rpcProfile) {
    return rpcProfile as ProfileRow;
  }

  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select(`id, email, display_name, created_at`)
    .eq('id', user.id)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ?? null,
      display_name: user.email?.split('@')[0] ?? 'User',
    })
    .select(`id, email, display_name, created_at`)
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return created;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getOrCreateProfile(supabase, user);
    return NextResponse.json({ profile: formatProfile(profile, user) });
  } catch (err) {
    console.error('[GET /api/profile]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';

    if (!displayName || displayName.length < 2) {
      return NextResponse.json({ error: 'Display name must be at least 2 characters' }, { status: 400 });
    }
    if (displayName.length > 50) {
      return NextResponse.json({ error: 'Display name must be 50 characters or less' }, { status: 400 });
    }

    await getOrCreateProfile(supabase, user);

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id)
      .select(`id, email, display_name, created_at`)
      .single();

    if (error) {
      console.error('[PATCH /api/profile] update error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: formatProfile(profile, user) });
  } catch (err) {
    console.error('[PATCH /api/profile]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
