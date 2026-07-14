-- Allow group members to update and delete expenses

CREATE POLICY "expenses_update_member"
  ON public.expenses FOR UPDATE TO authenticated
  USING (public.is_group_member(group_id))
  WITH CHECK (public.is_group_member(group_id));

CREATE POLICY "expenses_delete_member"
  ON public.expenses FOR DELETE TO authenticated
  USING (public.is_group_member(group_id));
