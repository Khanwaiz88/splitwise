import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/** GET /api/chat/contacts — people you can DM (from shared groups) */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase.rpc('get_dm_contacts');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contacts: data ?? [] });
  } catch (err) {
    console.error('[GET /api/chat/contacts]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
