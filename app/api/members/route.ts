import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { createGroupInvite } from '@/utils/server/groupInvite';
import { sendAddedToGroupEmail } from '@/utils/sendInviteEmail';

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 ]{1,29}$/;

async function assertGroupMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  userId: string,
) {
  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'You are not a member of this group' }, { status: 403 });
  }
  return null;
}

async function isDisplayNameTaken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  displayName: string,
) {
  const normalized = displayName.trim().toLowerCase();
  const { data: rows } = await supabase.rpc('get_groups_members', {
    p_group_ids: [groupId],
  });
  return (rows ?? []).some(
    (row: { display_name?: string }) =>
      (row.display_name ?? '').trim().toLowerCase() === normalized,
  );
}

/** POST /api/members — add by email (registered user) or displayName (guest) */
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
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';

    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
    }

    const membershipErr = await assertGroupMembership(supabase, groupId, user.id);
    if (membershipErr) return membershipErr;

    // ── Guest member by name only ─────────────────────────────────────────
    if (displayName && !email) {
      if (!NAME_PATTERN.test(displayName)) {
        return NextResponse.json(
          { error: 'Name must start with a letter, be 2–30 characters, and use letters/numbers/spaces only.' },
          { status: 400 },
        );
      }

      if (await isDisplayNameTaken(supabase, groupId, displayName)) {
        return NextResponse.json(
          { error: 'A member with this name already exists in the group.' },
          { status: 409 },
        );
      }

      const { data: guest, error: guestErr } = await supabase
        .from('group_guest_members')
        .insert({ group_id: groupId, display_name: displayName })
        .select('id, display_name')
        .single();

      if (guestErr) {
        if (guestErr.code === '23505') {
          return NextResponse.json(
            { error: 'A member with this name already exists in the group.' },
            { status: 409 },
          );
        }
        return NextResponse.json({ error: guestErr.message }, { status: 500 });
      }

      supabase
        .from('activity_log')
        .insert({
          group_id: groupId,
          user_id: user.id,
          description: `added guest member "${guest.display_name}"`,
        })
        .then(({ error }) => { if (error) console.warn('[activity_log]', error.message); });

      return NextResponse.json({
        id: guest.id,
        email: '',
        display_name: guest.display_name,
        is_guest: true,
      });
    }

    // ── Registered user by email ────────────────────────────────────────────
    if (!email) {
      return NextResponse.json({ error: 'email or displayName is required' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (email === user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 });
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
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
      try {
        const invite = await createGroupInvite(supabase, {
          groupId,
          email,
          inviterId: user.id,
          origin,
          sendEmail: true,
        });

        return NextResponse.json({
          invited: true,
          email,
          joinUrl: invite.joinUrl,
          emailSent: invite.emailSent,
          emailSkipped: invite.emailSkipped,
          emailError: invite.emailError,
          hasAccount: false,
        });
      } catch (err) {
        if (err instanceof Error && err.message === 'ALREADY_MEMBER') {
          return NextResponse.json(
            { error: 'This person is already in the group.' },
            { status: 409 },
          );
        }
        throw err;
      }
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

    const { error: insertErr } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: profile.id });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

    const [{ data: groupRow }, { data: inviterProfile }] = await Promise.all([
      supabase.from('groups').select('name').eq('id', groupId).single(),
      supabase.from('profiles').select('display_name, email').eq('id', user.id).single(),
    ]);

    const inviterName =
      inviterProfile?.display_name?.trim() ||
      inviterProfile?.email?.split('@')[0] ||
      'A group member';

    const emailResult = await sendAddedToGroupEmail({
      to: profile.email,
      groupName: groupRow?.name ?? 'your group',
      inviterName,
      groupUrl: `${origin}/dashboard/groups`,
    });

    supabase
      .from('activity_log')
      .insert({
        group_id: groupId,
        user_id: user.id,
        description: `added ${profile.display_name ?? profile.email} to the group`,
      })
      .then(({ error: logErr }) => { if (logErr) console.warn('[activity_log]', logErr.message); });

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name ?? profile.email,
      is_guest: false,
      added: true,
      emailSent: emailResult.sent,
      emailSkipped: emailResult.skipped,
      emailError: emailResult.error,
    });
  } catch (err) {
    console.error('[POST /api/members]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/members — remove a registered or guest member */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const groupId = body.groupId as string;
    const userId = body.userId as string;

    if (!groupId || !userId) {
      return NextResponse.json({ error: 'groupId and userId are required' }, { status: 400 });
    }

    const membershipErr = await assertGroupMembership(supabase, groupId, user.id);
    if (membershipErr) return membershipErr;

    const { data: guest } = await supabase
      .from('group_guest_members')
      .select('id, display_name')
      .eq('group_id', groupId)
      .eq('id', userId)
      .maybeSingle();

    if (guest) {
      const { error: deleteGuestErr } = await supabase
        .from('group_guest_members')
        .delete()
        .eq('group_id', groupId)
        .eq('id', userId);

      if (deleteGuestErr) {
        return NextResponse.json({ error: deleteGuestErr.message }, { status: 500 });
      }

      supabase
        .from('activity_log')
        .insert({
          group_id: groupId,
          user_id: user.id,
          description: `removed guest member "${guest.display_name}"`,
        })
        .then(({ error }) => { if (error) console.warn('[activity_log]', error.message); });

      return NextResponse.json({ success: true });
    }

    const { data: targetMembership } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!targetMembership) {
      return NextResponse.json({ error: 'Member not found in this group' }, { status: 404 });
    }

    const { count, error: countErr } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last registered member from the group.' },
        { status: 400 },
      );
    }

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', userId)
      .maybeSingle();

    const { error: deleteErr } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    const removedName = targetProfile?.display_name ?? targetProfile?.email ?? 'a member';
    supabase
      .from('activity_log')
      .insert({
        group_id: groupId,
        user_id: user.id,
        description: `removed ${removedName} from the group`,
      })
      .then(({ error }) => { if (error) console.warn('[activity_log]', error.message); });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/members]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
