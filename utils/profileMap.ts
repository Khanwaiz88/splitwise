import type { Member } from '@/utils/splitMath';

type ProfileRow = {
  id: string;
  display_name?: string | null;
  email?: string | null;
};

export function mapProfileToMember(p: ProfileRow): Member {
  const email = p.email ?? '';
  const displayName =
    p.display_name?.trim() ||
    email.split('@')[0] ||
    'User';
  return {
    id: p.id,
    display_name: displayName,
    email,
  };
}

export const PROFILE_FIELDS = 'id, display_name, email' as const;
