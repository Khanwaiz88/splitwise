import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/** POST /api/groups/join — join a group using its fixed share code */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('join_group_by_code', { p_code: code });
    if (error) {
      const msg = error.message;
      if (msg.includes('NOT_AUTHENTICATED')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (msg.includes('INVALID_CODE')) {
        return NextResponse.json({ error: 'Invalid or expired group link' }, { status: 404 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[POST /api/groups/join]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** GET /api/groups/join?code= — preview group name from share link */
export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get('code')?.trim() ?? '';
    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('preview_group_by_join_code', { p_code: code });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Invalid group link' }, { status: 404 });
    }

    return NextResponse.json({
      groupId: data.groupId,
      groupName: data.groupName,
    });
  } catch (err) {
    console.error('[GET /api/groups/join]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
