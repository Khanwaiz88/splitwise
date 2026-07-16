import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/** GET /api/chat/conversations?type=group&groupId= | ?type=dm&userId= */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'group') {
      const groupId = searchParams.get('groupId');
      if (!groupId) {
        return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
      }

      const { data: group } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .maybeSingle();

      const { data: conversationId, error } = await supabase.rpc(
        'get_or_create_group_conversation',
        { p_group_id: groupId },
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        conversationId,
        type: 'group',
        title: group?.name ?? 'Group Chat',
        groupId,
      });
    }

    if (type === 'dm') {
      const userId = searchParams.get('userId');
      if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', userId)
        .maybeSingle();

      const { data: conversationId, error } = await supabase.rpc(
        'get_or_create_dm_conversation',
        { p_other_user_id: userId },
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      const title =
        profile?.display_name?.trim() ||
        profile?.email?.split('@')[0] ||
        'Direct Message';

      return NextResponse.json({
        conversationId,
        type: 'dm',
        title,
        otherUserId: userId,
      });
    }

    return NextResponse.json({ error: 'type must be group or dm' }, { status: 400 });
  } catch (err) {
    console.error('[GET /api/chat/conversations]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
