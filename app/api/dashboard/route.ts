import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { mapProfileToMember, PROFILE_FIELDS } from '@/utils/profileMap';
import type { Member } from '@/utils/splitMath';

/** GET /api/dashboard?groupId=xxx — single fast fetch for dashboard data */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const requestedGroupId = searchParams.get('groupId');

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let groupId = requestedGroupId;

    if (!groupId) {
      const { data: membership } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      groupId = membership?.group_id ?? null;
    }

    if (!groupId) {
      return NextResponse.json({
        user: { id: user.id, email: user.email },
        groupId: null,
        groupName: null,
        members: [],
        expenses: [],
        settlements: [],
      });
    }

    const [groupRes, expensesRes, settlementsRes, rpcMembersRes] = await Promise.all([
      supabase.from('groups').select('name').eq('id', groupId).single(),
      supabase
        .from('expenses')
        .select('id, description, amount, paid_by, splits, split_type, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false }),
      supabase
        .from('settlements')
        .select('id, from_user, to_user, amount, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false }),
      supabase.rpc('get_groups_members', { p_group_ids: [groupId] }),
    ]);

    let members: Member[] = [];

    if (!rpcMembersRes.error && rpcMembersRes.data) {
      members = (rpcMembersRes.data as Array<{
        user_id: string;
        display_name: string;
        email: string;
      }>).map((r) => ({
        id: r.user_id,
        display_name: r.display_name,
        email: r.email,
      }));
    } else {
      const { data: membershipsRes } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      const memberIds = (membershipsRes ?? []).map((m) => m.user_id);
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select(PROFILE_FIELDS)
          .in('id', memberIds);
        members = (profiles ?? []).map(mapProfileToMember);
      }
    }

    const expenses = (expensesRes.data ?? []).map((e) => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      paid_by: e.paid_by,
      splits: e.splits ?? {},
      split_type: e.split_type ?? 'equal',
    }));

    const settlements = (settlementsRes.data ?? []).map((s) => ({
      id: s.id,
      from: s.from_user,
      to: s.to_user,
      amount: Number(s.amount),
      created_at: s.created_at,
    }));

    // Include names for anyone referenced in expenses but missing from members list
    const knownIds = new Set(members.map((m) => m.id));
    const extraIds = new Set<string>();
    for (const exp of expenses) {
      if (exp.paid_by) extraIds.add(exp.paid_by);
      Object.keys(exp.splits ?? {}).forEach((id) => extraIds.add(id));
    }
    for (const s of settlements) {
      extraIds.add(s.from);
      extraIds.add(s.to);
    }
    const missingIds = [...extraIds].filter((id) => !knownIds.has(id));
    if (missingIds.length > 0) {
      const { data: extraProfiles } = await supabase
        .from('profiles')
        .select(PROFILE_FIELDS)
        .in('id', missingIds);
      for (const p of extraProfiles ?? []) {
        members.push(mapProfileToMember(p));
      }
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      groupId,
      groupName: groupRes.data?.name ?? 'Your Group',
      members,
      expenses,
      settlements,
    });
  } catch (err) {
    console.error('[GET /api/dashboard]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
