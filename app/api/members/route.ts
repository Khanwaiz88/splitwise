import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/** POST /api/members — add existing user to group by email */
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
      return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 });
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

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .ilike('email', email)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'No account found with this email. Use "Send Invite Link" instead.' },
        { status: 404 },
      );
    }

    const { data: alreadyMember } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', profile.id)
      .maybeSingle();

    if (alreadyMember) {
      return NextResponse.json(
        { error: 'This person is already in the group.', alreadyMember: true, userId: profile.id },
        { status: 409 },
      );
    }

    const { error: addErr } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: profile.id });

    if (addErr) {
      return NextResponse.json({ error: addErr.message }, { status: 500 });
    }

    supabase
      .from('activity_log')
      .insert({
        group_id: groupId,
        user_id: user.id,
        description: `added ${profile.display_name ?? profile.email} to the group`,
      })
      .then(({ error }) => { if (error) console.warn('[activity_log]', error.message); });

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name ?? profile.email,
    });
  } catch (err) {
    console.error('[POST /api/members]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
