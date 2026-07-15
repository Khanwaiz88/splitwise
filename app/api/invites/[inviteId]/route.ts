import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/** PATCH /api/invites/[inviteId] — accept or decline { action: 'accept' | 'decline' } */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  try {
    const { inviteId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action as string;

    if (action === 'accept') {
      const { data, error } = await supabase.rpc('accept_group_invite_by_id', {
        p_invite_id: inviteId,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json(data);
    }

    if (action === 'decline') {
      const { data, error } = await supabase.rpc('decline_group_invite', {
        p_invite_id: inviteId,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'action must be accept or decline' }, { status: 400 });
  } catch (err) {
    console.error('[PATCH /api/invites/[inviteId]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
