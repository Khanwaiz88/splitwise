import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { PROFILE_FIELDS } from '@/utils/profileMap';

/** POST /api/settlements — record a settle-up payment */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const groupId = body.group_id as string | undefined;
    const fromUser = body.from_user as string | undefined;
    const toUser = body.to_user as string | undefined;
    const amount = Number(body.amount);

    if (!groupId || !fromUser || !toUser || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    if (fromUser === toUser) {
      return NextResponse.json({ error: 'Payer and receiver must be different' }, { status: 400 });
    }

    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);

    const memberIds = new Set((members ?? []).map((m) => m.user_id));
    if (!memberIds.has(fromUser) || !memberIds.has(toUser)) {
      return NextResponse.json({ error: 'Both users must be group members' }, { status: 400 });
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .in('id', [fromUser, toUser]);

    const nameOf = (id: string) => {
      const p = profiles?.find((x) => x.id === id);
      return p?.display_name?.trim() || p?.email?.split('@')[0] || 'Member';
    };

    const { data: settlement, error } = await supabase
      .from('settlements')
      .insert({
        group_id: groupId,
        from_user: fromUser,
        to_user: toUser,
        amount,
        recorded_by: user.id,
      })
      .select('id, from_user, to_user, amount, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const fromName = nameOf(fromUser);
    const toName = nameOf(toUser);
    const desc = `${fromName} paid ${toName} $${amount.toFixed(2)}`;

    supabase
      .from('activity_log')
      .insert({
        group_id: groupId,
        user_id: user.id,
        description: desc,
      })
      .then(({ error: logErr }) => {
        if (logErr) console.warn('[POST /api/settlements] activity log:', logErr.message);
      });

    return NextResponse.json({
      settlement: {
        id: settlement.id,
        from: settlement.from_user,
        to: settlement.to_user,
        amount: Number(settlement.amount),
        created_at: settlement.created_at,
      },
    });
  } catch (err) {
    console.error('[POST /api/settlements]', err);
    const cause = err instanceof Error ? String((err as Error & { cause?: unknown }).cause ?? '') : '';
    const msg = err instanceof Error ? err.message : '';
    if (
      msg.includes('fetch failed') ||
      cause.includes('ENOTFOUND') ||
      cause.includes('ECONNREFUSED') ||
      cause.includes('ETIMEDOUT')
    ) {
      return NextResponse.json(
        { error: 'Cannot reach database — check your internet connection.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
