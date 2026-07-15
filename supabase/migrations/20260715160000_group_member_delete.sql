-- Allow group members to remove other members from a group
CREATE POLICY "gm_delete_member"
  ON public.group_members FOR DELETE TO authenticated
  USING (public.is_group_member(group_id));
