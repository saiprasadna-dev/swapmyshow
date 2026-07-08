/* SMS delivery for phone verification.

   Cloudflare Workers can't open raw SMS/SMTP connections, so a real deployment
   needs an HTTP SMS API (e.g. MSG91, Twilio, Vonage). None is wired up yet, so
   this logs the code to the worker console and reports `delivered: false` — the
   controller then hands the code back as a `debugCode` in development so the
   flow is testable without a phone. Swap the body of `sendSms` for a real
   provider call when you add one. */

export type SmsMessage = {
  to: string
  text: string
}

export async function sendSms(msg: SmsMessage): Promise<{ delivered: boolean }> {
  console.log(`[sms] to=${msg.to} :: ${msg.text}`)
  return { delivered: false }
}
