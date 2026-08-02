import nodemailer from "nodemailer";
import { config } from "../core/config";
 
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config.gmailUser,
    pass: config.gmailAppPassword,
  },
});
 
export interface EscalationEmailInput {
  toEmail: string;
  toName: string;
  reporterUsername: string;
  urgencyLabel: string;
  riskScore: number;
  latitude: number;
  longitude: number;
}
 
export async function sendEscalationEmail(input: EscalationEmailInput): Promise<void> {
  if (!config.gmailUser || !config.gmailAppPassword) {
    console.warn("Gmail credentials not configured — skipping email send (dev mode).");
    return;
  }
 
  const mapLink = `https://www.openstreetmap.org/?mlat=${input.latitude}&mlon=${input.longitude}#map=17/${input.latitude}/${input.longitude}`;
 
  await transporter.sendMail({
    from: `"W-Saksham Alerts" <${config.gmailUser}>`,
    to: input.toEmail,
    subject: `⚠️ Urgent: ${input.reporterUsername} may need help`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2 style="color:#E8593C;">Safety Alert — ${input.urgencyLabel.toUpperCase()}</h2>
        <p>Hi ${input.toName},</p>
        <p><strong>${input.reporterUsername}</strong> has listed you as a trusted contact and just triggered a safety alert
        assessed as <strong>${input.urgencyLabel}</strong> risk (score ${input.riskScore}/100).</p>
        <p><a href="${mapLink}" style="display:inline-block;padding:10px 16px;background:#2FA98C;color:#fff;
        text-decoration:none;border-radius:6px;">View their location</a></p>
        <p style="color:#888;font-size:12px;">This is an automated message from the W-Saksham safety alert system.</p>
      </div>
    `,
  });
 
  console.log(`Escalation email sent to ${input.toEmail}`);
}