import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { sendInviteEmail } from '@/utils/sendInviteEmail';

function appOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

export type PendingInviteRow = {
  id: string;
  group_id: string;
  group_name: string;
  invited_by: string;
  inviter_name: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
};

/** GET /api/invites — pending invites for the logged-in user */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase.rpc('get_my_pending_invites');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const invites = (data ?? []) as PendingInviteRow[];
    return NextResponse.json({ invites, count: invites.length });
  } catch (err) {
    console.error('[GET /api/invites]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/invites — send invite (email + in-app inbox). Works for new and existing users. */
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

    const { data: groupRow } = await supabase
      .from('groups')
      .select('name')
      .eq('id', groupId)
      .single();

    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .single();

    const inviterName =
      inviterProfile?.display_name?.trim() ||
      inviterProfile?.email?.split('@')[0] ||
      'A group member';

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (existingProfile) {
      const { data: alreadyMember } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('user_id', existingProfile.id)
        .maybeSingle();

      if (alreadyMember) {
        return NextResponse.json(
          { error: 'This person is already in the group.' },
          { status: 409 },
        );
      }
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const origin = appOrigin(request);
    const joinUrl = existingProfile
      ? `${origin}/dashboard/invites`
      : `${origin}/join/${token}`;

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
        .update({
          token,
          status: 'pending',
          invited_by: user.id,
          expires_at: expiresAt,
        })
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

    const emailResult = await sendInviteEmail({
      to: email,
      groupName: groupRow?.name ?? 'a group',
      inviterName,
      joinUrl,
      hasAccount: !!existingProfile,
    });

    return NextResponse.json({
      token,
      email,
      expiresAt,
      joinUrl,
      hasAccount: !!existingProfile,
      emailSent: emailResult.sent,
      emailSkipped: emailResult.skipped,
    });
  } catch (err) {
    console.error('[POST /api/invites]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
