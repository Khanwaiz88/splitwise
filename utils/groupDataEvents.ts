export type GroupDataTable =
  | 'expenses'
  | 'settlements'
  | 'group_members'
  | 'group_guest_members'
  | 'groups'
  | 'activity_log';

export type GroupDataChangedDetail = {
  groupId: string | null;
  table: GroupDataTable;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  at: number;
};

export const GROUP_DATA_CHANGED = 'groupDataChanged';

export function dispatchGroupDataChanged(detail: Omit<GroupDataChangedDetail, 'at'>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(GROUP_DATA_CHANGED, {
      detail: { ...detail, at: Date.now() } satisfies GroupDataChangedDetail,
    }),
  );
}

export function extractGroupIdFromPayload(
  table: GroupDataTable,
  payload: { new: Record<string, unknown>; old: Record<string, unknown> },
): string | null {
  if (table === 'groups') {
    const id = payload.new?.id ?? payload.old?.id;
    return typeof id === 'string' ? id : null;
  }

  const row = payload.new?.group_id != null ? payload.new : payload.old;
  const groupId = row?.group_id;
  return typeof groupId === 'string' ? groupId : null;
}
