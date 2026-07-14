type InviteEmailParams = {
  to: string;
  groupName: string;
  inviterName: string;
  joinUrl: string;
};

/** Send group invite email via Resend. Returns true if sent, false if skipped/failed. */
export async function sendInviteEmail(params: InviteEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[sendInviteEmail] RESEND_API_KEY not set — skipping email');
    return false;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? 'Splitwise <onboarding@resend.dev>';

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#020817;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#020817;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:40px;">
          <tr>
            <td>
              <p style="color:#10b981;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Group Invite</p>
              <h1 style="color:#f8fafc;font-size:24px;font-weight:800;margin:0 0 12px;">
                You're invited to join ${escapeHtml(params.groupName)}
              </h1>
              <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 28px;">
                <strong style="color:#e2e8f0;">${escapeHtml(params.inviterName)}</strong> invited you to split expenses on Splitwise.
                Click the button below to create your account and join the group.
              </p>
              <a href="${params.joinUrl}"
                style="display:inline-block;background:#10b981;color:#020817;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">
                Accept Invite & Join Group
              </a>
              <p style="color:#64748b;font-size:12px;margin:28px 0 0;line-height:1.5;">
                This invite expires in 7 days. Please sign up using <strong style="color:#94a3b8;">${escapeHtml(params.to)}</strong>.
              </p>
              <p style="color:#475569;font-size:11px;margin:16px 0 0;word-break:break-all;">
                Or copy this link: ${params.joinUrl}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: `You're invited to join "${params.groupName}" on Splitwise`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[sendInviteEmail] Resend error:', err);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[sendInviteEmail]', err);
    return false;
  }
}

/** Notify existing user they were added to a group */
export async function sendAddedToGroupEmail(params: InviteEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = process.env.RESEND_FROM_EMAIL ?? 'Splitwise <onboarding@resend.dev>';

  const html = `
<p style="font-family:sans-serif;color:#333;">
  <strong>${escapeHtml(params.inviterName)}</strong> added you to the group
  <strong>${escapeHtml(params.groupName)}</strong> on Splitwise.
</p>
<p style="font-family:sans-serif;">
  <a href="${params.joinUrl}" style="color:#10b981;font-weight:bold;">Open Dashboard →</a>
</p>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: `You were added to "${params.groupName}" on Splitwise`,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
