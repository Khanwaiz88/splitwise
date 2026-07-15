import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import type { GroupMember } from '@/utils/groupsApi';
import { mapProfileToMember, PROFILE_FIELDS } from '@/utils/profileMap';

type MemberRow = {
  group_id: string;
  user_id: string;
  display_name: string;
  email: string;
  is_guest?: boolean;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: rpcRows, error: rpcError } = await supabase.rpc('get_groups_members', {
      p_group_ids: [groupId],
    });

    if (!rpcError && rpcRows) {
      const members: GroupMember[] = (rpcRows as MemberRow[]).map((r) => ({
        id: r.user_id,
        display_name: r.display_name,
        email: r.email,
        is_guest: r.is_guest ?? false,
      }));
      return NextResponse.json({ members });
    }

    const { data: memberRows, error: memError } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);

    if (memError) {
      return NextResponse.json({ error: memError.message }, { status: 500 });
    }

    const userIds = (memberRows ?? []).map((m) => m.user_id);
    if (userIds.length === 0) {
      return NextResponse.json({ members: [] });
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .in('id', userIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const members: GroupMember[] = userIds.map((id) => {
      const p = profileMap.get(id);
      return p ? mapProfileToMember(p) : { id, display_name: 'Member', email: '' };
    });

    return NextResponse.json({ members });
  } catch (err) {
    console.error('[GET /api/groups/[groupId]/members]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
