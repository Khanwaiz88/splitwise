import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { formatMoney, normalizeCurrency } from '@/utils/currency';

/** POST /api/expenses — save expense + log activity */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { group_id, description, amount, paid_by, splits, split_type } = body;

    if (!group_id || !description?.trim() || !amount || !paid_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        group_id,
        description: description.trim(),
        amount,
        paid_by,
        splits: splits ?? {},
        split_type: split_type ?? 'equal',
      })
      .select('id, description, amount, paid_by, splits, split_type')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: groupRow } = await supabase
      .from('groups')
      .select('currency')
      .eq('id', group_id)
      .single();
    const currency = normalizeCurrency(groupRow?.currency);
    const amountLabel = formatMoney(Number(amount), currency);

    // Non-blocking activity log
    supabase
      .from('activity_log')
      .insert({
        group_id,
        user_id: user.id,
        description: `added expense "${description.trim()}" of ${amountLabel}`,
      })
      .then(({ error: logErr }) => {
        if (logErr) console.warn('[POST /api/expenses] activity log:', logErr.message);
      });

    return NextResponse.json({
      expense: {
        id: expense.id,
        description: expense.description,
        amount: Number(expense.amount),
        paid_by: expense.paid_by,
        splits: expense.splits ?? {},
        split_type: expense.split_type ?? 'equal',
      },
    });
  } catch (err) {
    console.error('[POST /api/expenses]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
