import type { MailerConfig } from '../config/env'

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

export type MailMessage = {
  to: string
  subject: string
  html: string
  text: string
}

/** Raised when a configured provider fails to accept the message. Maps to a
    502 — the caller couldn't deliver the email even though it was well-formed. */
export class MailError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MailError'
  }
}

/**
 * Send an email via Brevo's HTTP API.
 *
 * When the mailer isn't configured (no API key / sender) we fall back to
 * logging the message so local development works with zero setup. In that mode
 * the code is visible in the worker console, never delivered.
 *
 * Returns whether the message was actually handed to a provider.
 */
export async function sendEmail(
  cfg: MailerConfig,
  msg: MailMessage
): Promise<{ delivered: boolean }> {
  if (!cfg.configured || !cfg.brevoApiKey) {
    console.info(
      `[mailer:dev] would send to ${msg.to} — "${msg.subject}"\n${msg.text}`
    )
    return { delivered: false }
  }

  let res: Response
  try {
    res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': cfg.brevoApiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: cfg.fromEmail, name: cfg.fromName },
        to: [{ email: msg.to }],
        subject: msg.subject,
        htmlContent: msg.html,
        textContent: msg.text,
      }),
    })
  } catch (err) {
    throw new MailError(
      `Brevo request failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new MailError(`Brevo responded ${res.status}: ${detail.slice(0, 300)}`)
  }
  return { delivered: true }
}

/** Build a code email for a given purpose (sign-in vs password reset). */
function buildCodeEmail(
  appName: string,
  code: string,
  ttlMinutes: number,
  opts: { subject: string; heading: string; lead: string }
): { subject: string; html: string; text: string } {
  const text =
    `${opts.lead} Your ${appName} code is ${code}.\n` +
    `It expires in ${ttlMinutes} minute${ttlMinutes === 1 ? '' : 's'}.\n\n` +
    `If you didn't request this, you can ignore this email.`
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
    <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;text-align:center">
      <h1 style="margin:0 0 8px;font-size:18px">${opts.heading}</h1>
      <p style="margin:0 0 24px;color:#555;font-size:14px">${opts.lead}</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:8px;padding:16px 0">${code}</div>
      <p style="margin:24px 0 0;color:#888;font-size:12px">
        This code expires in ${ttlMinutes} minute${ttlMinutes === 1 ? '' : 's'}.
        If you didn't request it, you can safely ignore this email.
      </p>
    </div>
  </body>
</html>`
  return { subject: opts.subject, html, text }
}

/** Build the password-reset code email. */
export function buildResetEmail(
  appName: string,
  code: string,
  ttlMinutes: number
): { subject: string; html: string; text: string } {
  return buildCodeEmail(appName, code, ttlMinutes, {
    subject: `${code} is your ${appName} password reset code`,
    heading: `${appName} password reset`,
    lead: 'Enter this code to reset your password:',
  })
}

/** Build the sign-in code email (both HTML and plain-text parts). */
export function buildOtpEmail(
  appName: string,
  code: string,
  ttlMinutes: number
): { subject: string; html: string; text: string } {
  const subject = `${code} is your ${appName} sign-in code`
  const text =
    `Your ${appName} sign-in code is ${code}.\n` +
    `It expires in ${ttlMinutes} minute${ttlMinutes === 1 ? '' : 's'}.\n\n` +
    `If you didn't request this, you can ignore this email.`
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
    <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;text-align:center">
      <h1 style="margin:0 0 8px;font-size:18px">${appName} sign-in</h1>
      <p style="margin:0 0 24px;color:#555;font-size:14px">Enter this code to finish signing in:</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:8px;padding:16px 0">${code}</div>
      <p style="margin:24px 0 0;color:#888;font-size:12px">
        This code expires in ${ttlMinutes} minute${ttlMinutes === 1 ? '' : 's'}.
        If you didn't request it, you can safely ignore this email.
      </p>
    </div>
  </body>
</html>`
  return { subject, html, text }
}
