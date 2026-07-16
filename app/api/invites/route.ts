import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { createGroupInvite } from '@/utils/server/groupInvite';

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

    await supabase.rpc('ensure_user_profile');

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
    const sendEmail = body.sendEmail !== false;

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

    const result = await createGroupInvite(supabase, {
      groupId,
      email,
      inviterId: user.id,
      origin: appOrigin(request),
      sendEmail,
    });

    return NextResponse.json({
      token: result.token,
      email: result.email,
      expiresAt: result.expiresAt,
      joinUrl: result.joinUrl,
      hasAccount: result.hasAccount,
      emailSent: result.emailSent,
      emailSkipped: result.emailSkipped,
      resent: result.resent,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_MEMBER') {
      return NextResponse.json(
        { error: 'This person is already in the group.' },
        { status: 409 },
      );
    }
    console.error('[POST /api/invites]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
