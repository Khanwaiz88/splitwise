import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

function mapExpense(row: {
  id: string;
  description: string;
  amount: number | string;
  paid_by: string;
  splits: Record<string, number> | null;
  split_type: string;
}) {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    paid_by: row.paid_by,
    splits: row.splits ?? {},
    split_type: row.split_type ?? 'equal',
  };
}

/** PATCH /api/expenses/[expenseId] — update expense */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ expenseId: string }> },
) {
  try {
    const { expenseId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { description, amount, paid_by, splits, split_type } = body;

    if (!description?.trim() || !amount || !paid_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('expenses')
      .select('id, group_id, description')
      .eq('id', expenseId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const { data: expense, error } = await supabase
      .from('expenses')
      .update({
        description: description.trim(),
        amount,
        paid_by,
        splits: splits ?? {},
        split_type: split_type ?? 'equal',
      })
      .eq('id', expenseId)
      .select('id, description, amount, paid_by, splits, split_type')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    supabase
      .from('activity_log')
      .insert({
        group_id: existing.group_id,
        user_id: user.id,
        description: `updated expense "${description.trim()}" to $${Number(amount).toFixed(2)}`,
      })
      .then(({ error: logErr }) => {
        if (logErr) console.warn('[PATCH /api/expenses] activity log:', logErr.message);
      });

    return NextResponse.json({ expense: mapExpense(expense) });
  } catch (err) {
    console.error('[PATCH /api/expenses/[expenseId]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/expenses/[expenseId] — remove expense */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ expenseId: string }> },
) {
  try {
    const { expenseId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('expenses')
      .select('id, group_id, description, amount')
      .eq('id', expenseId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    supabase
      .from('activity_log')
      .insert({
        group_id: existing.group_id,
        user_id: user.id,
        description: `deleted expense "${existing.description}" ($${Number(existing.amount).toFixed(2)})`,
      })
      .then(({ error: logErr }) => {
        if (logErr) console.warn('[DELETE /api/expenses] activity log:', logErr.message);
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/expenses/[expenseId]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
