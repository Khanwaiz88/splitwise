import { randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendInviteEmail } from '@/utils/sendInviteEmail';

export type CreateGroupInviteResult = {
  token: string;
  email: string;
  expiresAt: string;
  joinUrl: string;
  hasAccount: boolean;
  emailSent: boolean;
  emailSkipped: boolean;
  emailError?: string;
  resent: boolean;
};

export async function createGroupInvite(
  supabase: SupabaseClient,
  params: {
    groupId: string;
    email: string;
    inviterId: string;
    origin: string;
    sendEmail?: boolean;
  },
): Promise<CreateGroupInviteResult> {
  const email = params.email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const token = randomBytes(24).toString('hex');

  const { data: groupRow } = await supabase
    .from('groups')
    .select('name')
    .eq('id', params.groupId)
    .single();

  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', params.inviterId)
    .single();

  const inviterName =
    inviterProfile?.display_name?.trim() ||
    inviterProfile?.email?.split('@')[0] ||
    'A group member';

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (existingProfile) {
    const { data: alreadyMember } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', params.groupId)
      .eq('user_id', existingProfile.id)
      .maybeSingle();

    if (alreadyMember) {
      throw new Error('ALREADY_MEMBER');
    }
  }

  const joinUrl = existingProfile
    ? `${params.origin}/dashboard/invites`
    : `${params.origin}/join/${token}`;

  const { data: existingInvite } = await supabase
    .from('group_invites')
    .select('id')
    .eq('group_id', params.groupId)
    .eq('email', email)
    .maybeSingle();

  let inviteError;
  const resent = !!existingInvite;

  if (existingInvite) {
    ({ error: inviteError } = await supabase
      .from('group_invites')
      .update({
        token,
        status: 'pending',
        invited_by: params.inviterId,
        expires_at: expiresAt,
      })
      .eq('id', existingInvite.id));
  } else {
    ({ error: inviteError } = await supabase
      .from('group_invites')
      .insert({
        group_id: params.groupId,
        email,
        invited_by: params.inviterId,
        token,
        status: 'pending',
        expires_at: expiresAt,
      }));
  }

  if (inviteError) {
    throw new Error(inviteError.message);
  }

  const emailResult = params.sendEmail === false
    ? { sent: false, skipped: true }
    : await sendInviteEmail({
        to: email,
        groupName: groupRow?.name ?? 'a group',
        inviterName,
        joinUrl,
        hasAccount: !!existingProfile,
      });

  return {
    token,
    email,
    expiresAt,
    joinUrl,
    hasAccount: !!existingProfile,
    emailSent: emailResult.sent,
    emailSkipped: emailResult.skipped,
    emailError: emailResult.error,
    resent,
  };
}
