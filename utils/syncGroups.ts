import { createGroup } from '@/utils/groupsApi';
import { normalizeCurrency, type CurrencyCode } from '@/utils/currency';
import {
  getPendingGroups,
  removePendingGroup,
  remapTempGroupId,
} from '@/utils/offlineQueue';

export async function syncPendingGroups(): Promise<boolean> {
  if (!navigator.onLine) return false;

  const pending = getPendingGroups();
  if (pending.length === 0) return false;

  let syncedAny = false;

  for (const item of pending) {
    try {
      const { group } = await createGroup(
        item.name,
        normalizeCurrency(item.currency) as CurrencyCode,
      );
      remapTempGroupId(item.tempId, group.id, group.name);
      removePendingGroup(item.tempId);
      syncedAny = true;
    } catch (err) {
      console.error('[syncPendingGroups]', err);
    }
  }

  return syncedAny;
}
