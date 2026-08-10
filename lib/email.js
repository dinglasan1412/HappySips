// Sends an email to the shop owner whenever someone requests an account.
// Uses Resend (https://resend.com) via a plain fetch call — no SDK needed.
// Requires RESEND_API_KEY to be set; if it's missing, the request is still
// saved (visible in the Account Requests screen), just without the email
// ping — a missing/failed email should never block the request itself.
export async function sendAccountRequestEmail({ name, username, contact, role }) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.NOTIFY_EMAIL || 'lykadinglasan12@gmail.com';

  if (!apiKey) {
    console.error('RESEND_API_KEY not set — account request saved, but no email was sent.');
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pearl & Brew <onboarding@resend.dev>',
        to: notifyEmail,
        subject: `New ${role} account request — ${name}`,
        html: `
          <p><strong>${escapeHtml(name)}</strong> just requested a <strong>${escapeHtml(role)}</strong> account on Pearl &amp; Brew.</p>
          <p>Username requested: ${escapeHtml(username)}<br/>Contact: ${escapeHtml(contact)}</p>
          <p>Log in with your Admin account and open <strong>Account Requests</strong> in the sidebar to approve or deny it.</p>
        `,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Resend API error:', res.status, body);
      return { sent: false, reason: 'send_failed' };
    }
    return { sent: true };
  } catch (e) {
    console.error('Email send failed:', e);
    return { sent: false, reason: 'send_failed' };
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
