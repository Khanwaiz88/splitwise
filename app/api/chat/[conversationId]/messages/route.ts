import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/** GET /api/chat/[conversationId]/messages — message history */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const { conversationId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const before = searchParams.get('before') ?? undefined;
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);

    const { data, error } = await supabase.rpc('get_chat_messages', {
      p_conversation_id: conversationId,
      p_limit: limit,
      p_before: before ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const messages = [...(data ?? [])].reverse();
    return NextResponse.json({ messages });
  } catch (err) {
    console.error('[GET /api/chat/[conversationId]/messages]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/chat/[conversationId]/messages — send a message */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const { conversationId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ error: 'Message too long (max 4000 chars)' }, { status: 400 });
    }

    const { data: row, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: text,
      })
      .select('id, conversation_id, sender_id, body, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const senderName =
      profile?.display_name?.trim() ||
      profile?.email?.split('@')[0] ||
      user.email?.split('@')[0] ||
      'You';

    return NextResponse.json({
      message: {
        ...row,
        sender_name: senderName,
      },
    });
  } catch (err) {
    console.error('[POST /api/chat/[conversationId]/messages]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
