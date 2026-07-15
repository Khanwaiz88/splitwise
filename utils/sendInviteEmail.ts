import nodemailer from 'nodemailer';

type InviteEmailParams = {
  to: string;
  groupName: string;
  inviterName: string;
  joinUrl: string;
  hasAccount?: boolean;
};

export function isSmtpConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildInviteHtml(params: InviteEmailParams): string {
  const cta = params.hasAccount
    ? 'Open Splitwise and go to Invites to Accept or Decline.'
    : 'Create your account with the email below, then Accept or Decline the invite in the app.';

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0c0a14;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0a14;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#141020;border:1px solid #2e2640;border-radius:16px;padding:40px;">
        <tr><td>
          <p style="color:#a78bfa;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Group Invite</p>
          <h1 style="color:#f8fafc;font-size:24px;font-weight:800;margin:0 0 12px;">
            Join ${escapeHtml(params.groupName)}
          </h1>
          <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 28px;">
            <strong style="color:#e2e8f0;">${escapeHtml(params.inviterName)}</strong> invited you to split expenses on Splitwise.
            ${cta}
          </p>
          <a href="${params.joinUrl}"
            style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#d946ef);color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">
            ${params.hasAccount ? 'Open Invites' : 'Create Account & View Invite'}
          </a>
          <p style="color:#64748b;font-size:12px;margin:28px 0 0;line-height:1.5;">
            Expires in 7 days. Use <strong style="color:#94a3b8;">${escapeHtml(params.to)}</strong> to sign in.
          </p>
          <p style="color:#475569;font-size:11px;margin:16px 0 0;word-break:break-all;">${params.joinUrl}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Send group invite email via SMTP (Gmail, Brevo, etc.). No Resend required. */
export async function sendInviteEmail(
  params: InviteEmailParams,
): Promise<{ sent: boolean; skipped: boolean }> {
  if (!isSmtpConfigured()) {
    console.warn('[sendInviteEmail] SMTP not configured — skipping email');
    return { sent: false, skipped: true };
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from,
      to: params.to,
      subject: `You're invited to join "${params.groupName}" on Splitwise`,
      html: buildInviteHtml(params),
    });
    return { sent: true, skipped: false };
  } catch (err) {
    console.error('[sendInviteEmail] SMTP error:', err);
    return { sent: false, skipped: false };
  }
}

/** Notify existing user they were added directly to a group */
export async function sendAddedToGroupEmail(params: InviteEmailParams): Promise<boolean> {
  const result = await sendInviteEmail({
    ...params,
    hasAccount: true,
    joinUrl: params.joinUrl.replace(/\/join\/.*$/, '/dashboard'),
  });
  return result.sent;
}
