import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/** GET /api/chat/unread — unread message counts per conversation */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase.rpc('get_chat_unread_summary');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const items = (data ?? []) as {
      conversation_id: string;
      unread_count: number;
      conv_type: 'group' | 'dm';
      title: string;
      group_id: string | null;
      other_user_id: string | null;
    }[];

    const total = items.reduce((sum, row) => sum + Number(row.unread_count), 0);

    return NextResponse.json({
      total,
      items: items.map((row) => ({
        conversationId: row.conversation_id,
        unreadCount: Number(row.unread_count),
        type: row.conv_type,
        title: row.title,
        groupId: row.group_id ?? undefined,
        otherUserId: row.other_user_id ?? undefined,
      })),
    });
  } catch (err) {
    console.error('[GET /api/chat/unread]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
