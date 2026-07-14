import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/** POST /api/invites/accept — accept invite by token */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const token = body.token as string;
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('accept_group_invite', { p_token: token });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[POST /api/invites/accept]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** GET /api/invites/accept?token=xxx — preview invite (public info only) */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_invite_preview', { p_token: token });

    if (error || !data) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[GET /api/invites/accept]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
