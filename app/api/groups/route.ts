import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import type { GroupResponse, GroupMember } from '@/utils/groupsApi';
import { mapProfileToMember, PROFILE_FIELDS } from '@/utils/profileMap';

type RpcGroupRow = {
  id: string;
  name: string;
  created_at?: string;
  member_count: number;
};

async function attachMembersToGroups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groups: GroupResponse[],
): Promise<GroupResponse[]> {
  if (groups.length === 0) return groups;

  const groupIds = groups.map((g) => g.id);

  const { data: rpcRows, error: rpcError } = await supabase.rpc('get_groups_members', {
    p_group_ids: groupIds,
  });

  if (!rpcError && rpcRows) {
    const membersByGroup: Record<string, GroupMember[]> = {};
    for (const row of rpcRows as Array<{
      group_id: string;
      user_id: string;
      display_name: string;
      email: string;
    }>) {
      if (!membersByGroup[row.group_id]) membersByGroup[row.group_id] = [];
      membersByGroup[row.group_id].push({
        id: row.user_id,
        display_name: row.display_name,
        email: row.email,
      });
    }

    return groups.map((g) => {
      const members = membersByGroup[g.id] ?? [];
      return {
        ...g,
        memberCount: members.length > 0 ? members.length : g.memberCount,
        members,
      };
    });
  }

  if (rpcError) {
    console.warn('[GET /api/groups] get_groups_members RPC fallback:', rpcError.message);
  }

  const { data: memberRows } = await supabase
    .from('group_members')
    .select('group_id, user_id')
    .in('group_id', groupIds);

  const userIds = [...new Set((memberRows ?? []).map((m) => m.user_id))];
  let profiles: Array<{ id: string; display_name?: string | null; email?: string | null }> = [];

  if (userIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .in('id', userIds);
    profiles = data ?? [];
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const membersByGroup: Record<string, GroupMember[]> = {};

  for (const row of memberRows ?? []) {
    const profile = profileMap.get(row.user_id);
    if (!membersByGroup[row.group_id]) membersByGroup[row.group_id] = [];
    membersByGroup[row.group_id].push(
      profile
        ? mapProfileToMember(profile)
        : { id: row.user_id, display_name: 'Member', email: '' },
    );
  }

  return groups.map((g) => {
    const members = membersByGroup[g.id] ?? [];
    return {
      ...g,
      memberCount: members.length > 0 ? members.length : g.memberCount,
      members,
    };
  });
}

/** GET /api/groups — fetch all groups the logged-in user belongs to */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Primary: use SECURITY DEFINER RPC (avoids RLS recursion)
    const { data: rpcRows, error: rpcError } = await supabase.rpc('get_user_groups');

    if (!rpcError && rpcRows) {
      const groups: GroupResponse[] = (rpcRows as RpcGroupRow[]).map((g) => ({
        id: g.id,
        name: g.name,
        created_at: g.created_at ?? undefined,
        memberCount: Number(g.member_count) || 1,
      }));
      const groupsWithMembers = await attachMembersToGroups(supabase, groups);
      return NextResponse.json({ groups: groupsWithMembers, userId: user.id });
    }

    // Fallback: direct query (works after RLS policies are fixed)
    if (rpcError) {
      console.warn('[GET /api/groups] RPC fallback:', rpcError.message);
    }

    const { data: memberships, error: memError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (memError) {
      console.error('[GET /api/groups] group_members error:', memError.message);
      return NextResponse.json(
        {
          error: memError.message,
          hint: 'Run supabase/fix-rls-policies.sql in your Supabase SQL Editor to fix RLS recursion.',
        },
        { status: 500 },
      );
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ groups: [], userId: user.id });
    }

    const groupIds = memberships.map((m) => m.group_id).filter(Boolean) as string[];

    const { data: groupRows, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, created_at')
      .in('id', groupIds)
      .order('name');

    if (groupsError) {
      console.error('[GET /api/groups] groups error:', groupsError.message);
      return NextResponse.json({ error: groupsError.message }, { status: 500 });
    }

    const { data: countRows } = await supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds);

    const countsMap: Record<string, number> = {};
    (countRows ?? []).forEach((row) => {
      countsMap[row.group_id] = (countsMap[row.group_id] || 0) + 1;
    });

    const groups: GroupResponse[] = (groupRows ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      created_at: g.created_at ?? undefined,
      memberCount: countsMap[g.id] ?? 1,
    }));

    const groupsWithMembers = await attachMembersToGroups(supabase, groups);
    return NextResponse.json({ groups: groupsWithMembers, userId: user.id });
  } catch (err) {
    console.error('[GET /api/groups] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/groups — create a new group and add the creator as a member */
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
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    // Primary: SECURITY DEFINER RPC
    const { data: rpcGroup, error: rpcError } = await supabase.rpc(
      'create_group_with_member',
      { p_name: name },
    );

    if (!rpcError && rpcGroup) {
      const g = rpcGroup as {
        id: string;
        name: string;
        created_at?: string;
        memberCount?: number;
      };
      const group: GroupResponse = {
        id: g.id,
        name: g.name,
        created_at: g.created_at,
        memberCount: g.memberCount ?? 1,
      };
      return NextResponse.json({ group }, { status: 201 });
    }

    if (rpcError) {
      console.warn('[POST /api/groups] RPC fallback:', rpcError.message);
    }

    // Fallback: direct inserts
    const { data: newGroup, error: groupError } = await supabase
      .from('groups')
      .insert({ name })
      .select('id, name, created_at')
      .single();

    if (groupError) {
      console.error('[POST /api/groups] insert group error:', groupError.message);
      return NextResponse.json(
        {
          error: groupError.message,
          hint: 'Run supabase/fix-rls-policies.sql in your Supabase SQL Editor.',
        },
        { status: 500 },
      );
    }

    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: newGroup.id, user_id: user.id });

    if (memberError) {
      console.error('[POST /api/groups] insert member error:', memberError.message);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    supabase
      .from('activity_log')
      .insert({
        group_id: newGroup.id,
        user_id: user.id,
        description: `created the group "${name}"`,
      })
      .then(({ error }) => {
        if (error) console.warn('[POST /api/groups] activity log:', error.message);
      });

    const group: GroupResponse = {
      id: newGroup.id,
      name: newGroup.name,
      created_at: newGroup.created_at,
      memberCount: 1,
    };

    return NextResponse.json({ group }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/groups] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
