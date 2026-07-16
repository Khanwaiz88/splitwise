import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/** POST /api/presence — heartbeat (user is active in app) */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase.rpc('heartbeat_presence');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ lastSeenAt: data });
  } catch (err) {
    console.error('[POST /api/presence]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** GET /api/presence?ids=uuid,uuid — fetch last seen for users */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('ids') ?? '';
    const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ presence: {} });
    }

    const { data, error } = await supabase.rpc('get_users_presence', {
      p_user_ids: ids.slice(0, 50),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const presence: Record<string, string> = {};
    for (const row of data ?? []) {
      presence[row.user_id as string] = row.last_seen_at as string;
    }

    return NextResponse.json({ presence });
  } catch (err) {
    console.error('[GET /api/presence]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
