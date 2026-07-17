import nodemailer from 'nodemailer';

export type InviteEmailParams = {
  to: string;
  groupName: string;
  inviterName: string;
  joinUrl: string;
  hasAccount?: boolean;
};

export type EmailSendResult = {
  sent: boolean;
  skipped: boolean;
  provider?: 'resend' | 'smtp';
  error?: string;
};

export function isEmailConfigured(): boolean {
  return isResendConfigured() || isSmtpConfigured();
}

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

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

export function buildInviteHtml(params: InviteEmailParams): string {
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

function inviteSubject(groupName: string): string {
  return `You're invited to join "${groupName}" on Splitwise`;
}

function addedSubject(groupName: string): string {
  return `You were added to "${groupName}" on Splitwise`;
}

export function buildAddedToGroupHtml(params: InviteEmailParams): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0c0a14;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0a14;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#141020;border:1px solid #2e2640;border-radius:16px;padding:40px;">
        <tr><td>
          <p style="color:#a78bfa;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Added to group</p>
          <h1 style="color:#f8fafc;font-size:24px;font-weight:800;margin:0 0 12px;">
            ${escapeHtml(params.groupName)}
          </h1>
          <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 28px;">
            <strong style="color:#e2e8f0;">${escapeHtml(params.inviterName)}</strong> added you to this group on Splitwise.
            Open the app to view expenses and chat with the group.
          </p>
          <a href="${params.joinUrl}"
            style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#d946ef);color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">
            Open Group
          </a>
          <p style="color:#64748b;font-size:12px;margin:28px 0 0;line-height:1.5;">
            Signed in as <strong style="color:#94a3b8;">${escapeHtml(params.to)}</strong>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendHtmlEmail(
  to: string,
  subject: string,
  html: string,
): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    console.warn('[sendEmail] No email provider configured — skipping email');
    return { sent: false, skipped: true };
  }

  try {
    if (isResendConfigured()) {
      const apiKey = process.env.RESEND_API_KEY!;
      const from = process.env.RESEND_FROM ?? 'Splitwise <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });
      if (res.ok) return { sent: true, skipped: false, provider: 'resend' };
      if (!isSmtpConfigured()) {
        const body = await res.text().catch(() => '');
        return { sent: false, skipped: false, error: body.slice(0, 200) || 'Resend failed' };
      }
    }

    if (isSmtpConfigured()) {
      const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
      const port = Number(process.env.SMTP_PORT ?? 587);
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({ from, to, subject, html });
      return { sent: true, skipped: false, provider: 'smtp' };
    }

    return { sent: false, skipped: false, error: 'Email send failed' };
  } catch (err) {
    console.error('[sendEmail] Error:', err);
    return {
      sent: false,
      skipped: false,
      error: err instanceof Error ? err.message : 'Email send failed',
    };
  }
}

/** Resend free tier: 100 emails/day — https://resend.com */
async function sendViaResend(params: InviteEmailParams): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false };

  const from = process.env.RESEND_FROM ?? 'Splitwise <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: inviteSubject(params.groupName),
      html: buildInviteHtml(params),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[sendInviteEmail] Resend error:', res.status, body);
    let message = 'Email provider rejected the send request.';
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      if (body) message = body.slice(0, 200);
    }
    if (message.includes('only send testing emails')) {
      message = 'Resend test mode: can only email your Resend account address. Add Gmail SMTP on Vercel, or verify a domain at resend.com/domains.';
    }
    return { ok: false, error: message };
  }

  return { ok: true };
}

async function sendViaSmtp(params: InviteEmailParams): Promise<boolean> {
  if (!isSmtpConfigured()) return false;

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

  await transporter.sendMail({
    from,
    to: params.to,
    subject: inviteSubject(params.groupName),
    html: buildInviteHtml(params),
  });

  return true;
}

/**
 * Send group invite email.
 * Priority: Resend API (free tier) → SMTP (Gmail/Brevo) → skip (invite still saved in app).
 */
export async function sendInviteEmail(params: InviteEmailParams): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    console.warn('[sendInviteEmail] No email provider configured — skipping email');
    return { sent: false, skipped: true };
  }

  try {
    if (isResendConfigured()) {
      const resend = await sendViaResend(params);
      if (resend.ok) return { sent: true, skipped: false, provider: 'resend' };
      if (!isSmtpConfigured()) {
        return { sent: false, skipped: false, error: resend.error };
      }
    }

    const ok = await sendViaSmtp(params);
    return ok
      ? { sent: true, skipped: false, provider: 'smtp' }
      : { sent: false, skipped: false, error: 'SMTP send failed. Check Gmail App Password on Vercel.' };
  } catch (err) {
    console.error('[sendInviteEmail] Error:', err);
    return {
      sent: false,
      skipped: false,
      error: err instanceof Error ? err.message : 'Email send failed',
    };
  }
}

/** Notify existing user they were added directly to a group */
export async function sendAddedToGroupEmail(params: {
  to: string;
  groupName: string;
  inviterName: string;
  groupUrl: string;
}): Promise<EmailSendResult> {
  return sendHtmlEmail(
    params.to,
    addedSubject(params.groupName),
    buildAddedToGroupHtml({
      to: params.to,
      groupName: params.groupName,
      inviterName: params.inviterName,
      joinUrl: params.groupUrl,
      hasAccount: true,
    }),
  );
}
