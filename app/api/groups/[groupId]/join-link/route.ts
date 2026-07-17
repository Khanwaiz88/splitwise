import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

function appOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

/** GET /api/groups/[groupId]/join-link — fixed share link for the group */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .select('name, join_code')
      .eq('id', groupId)
      .single();

    if (groupErr || !group?.join_code) {
      return NextResponse.json({ error: groupErr?.message ?? 'Group not found' }, { status: 404 });
    }

    const origin = appOrigin(request);
    return NextResponse.json({
      groupId,
      groupName: group.name,
      joinCode: group.join_code,
      joinUrl: `${origin}/join/group/${group.join_code}`,
    });
  } catch (err) {
    console.error('[GET /api/groups/[groupId]/join-link]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
