import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

function appOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

/** POST /api/invites — create invite link for someone without an account */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const groupId = body.groupId as string;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!groupId || !email) {
      return NextResponse.json({ error: 'groupId and email are required' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (email === user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this group' }, { status: 403 });
    }

    // If account exists, tell user to use Add instead
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (profile) {
      return NextResponse.json(
        { error: 'This email already has an account. Use "Add to Group" instead.' },
        { status: 409 },
      );
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const joinUrl = `${appOrigin(request)}/join/${token}`;

    const { data: existingInvite } = await supabase
      .from('group_invites')
      .select('id')
      .eq('group_id', groupId)
      .eq('email', email)
      .maybeSingle();

    let inviteError;

    if (existingInvite) {
      ({ error: inviteError } = await supabase
        .from('group_invites')
        .update({ token, status: 'pending', invited_by: user.id, expires_at: expiresAt })
        .eq('id', existingInvite.id));
    } else {
      ({ error: inviteError } = await supabase
        .from('group_invites')
        .insert({
          group_id: groupId,
          email,
          invited_by: user.id,
          token,
          status: 'pending',
          expires_at: expiresAt,
        }));
    }

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    return NextResponse.json({ token, email, expiresAt, joinUrl });
  } catch (err) {
    console.error('[POST /api/invites]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
