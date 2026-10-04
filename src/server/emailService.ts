/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Production SMTP Email Delivery Service (Nodemailer)
 *
 * Strictly reads dedicated SMTP environment variables at runtime:
 *   - EMAIL_HOST
 *   - EMAIL_PORT
 *   - EMAIL_USER
 *   - EMAIL_PASSWORD
 *   - EMAIL_FROM
 */

import 'dotenv/config';
import fs from 'fs';
import nodemailer, { Transporter } from 'nodemailer';

const TEST_EMAIL_OUTBOX_PATH = '/tmp/coop_email_outbox.json';

export interface EmailDeliveryResult {
  sent: boolean;
  provider: 'SMTP' | 'MOCK_TRANSPORT' | 'UNCONFIGURED';
  messageId?: string;
  error?: string;
}

export interface RecordedEmailInvocation {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  provider: 'SMTP' | 'MOCK_TRANSPORT';
  sentAt: string;
  messageId?: string;
}

export interface MemberEmailNotificationParams {
  toEmail: string;
  fullName: string;
  title: string;
  subjectOverride?: string;
  message: string;
  loanNumber?: string;
  referenceNumber?: string;
  amount?: number;
  dueDate?: string;
  actionUrl?: string;
  actionLabel?: string;
  cooperativeName?: string;
  testTransportMode?: 'mock' | 'fail';
}

export interface RecordedNotificationEmail {
  to: string;
  fullName: string;
  title: string;
  message: string;
  loanNumber?: string;
  referenceNumber?: string;
  amount?: number;
  dueDate?: string;
  provider: 'SMTP' | 'MOCK_TRANSPORT';
  sentAt: string;
  subject: string;
  text: string;
  html: string;
  messageId?: string;
}

// Injectable transport override for automated testing (avoids sending real emails in unit/integration tests)
let customTransporterOverride: Transporter | null = null;
const recordedInvocations: RecordedEmailInvocation[] = [];
const recordedNotificationEmails: RecordedNotificationEmail[] = [];

export function setEmailTransporterForTesting(transporter: Transporter | null): void {
  customTransporterOverride = transporter;
}

export function getRecordedEmailInvocationsForTesting(): RecordedEmailInvocation[] {
  return [...recordedInvocations];
}

export function clearRecordedEmailInvocationsForTesting(): void {
  recordedInvocations.length = 0;
}

export function getRecordedNotificationEmails(): RecordedNotificationEmail[] {
  return [...recordedNotificationEmails];
}

export function clearRecordedNotificationEmails(): void {
  recordedNotificationEmails.length = 0;
}

/**
 * Checks whether real SMTP credentials are configured in runtime environment variables.
 * Strictly checks EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, and EMAIL_FROM.
 */
export function getSmtpConfigStatus(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  missingVars: string[];
} {
  const host = (env.EMAIL_HOST || '').trim();
  const portRaw = (env.EMAIL_PORT || '').trim();
  const parsedPort = Number(portRaw);
  const validPort = portRaw.length > 0 && Number.isFinite(parsedPort) && parsedPort > 0;
  const port = validPort ? parsedPort : 0;
  const user = (env.EMAIL_USER || '').trim();
  const password = (env.EMAIL_PASSWORD || '').trim();
  const from = (env.EMAIL_FROM || '').trim();
  const secure = port === 465 || String(env.EMAIL_SECURE || '').toLowerCase() === 'true';

  const missingVars: string[] = [];
  if (!host) missingVars.push('EMAIL_HOST');
  if (!validPort) missingVars.push('EMAIL_PORT');
  if (!user) missingVars.push('EMAIL_USER');
  if (!password) missingVars.push('EMAIL_PASSWORD');
  if (!from) missingVars.push('EMAIL_FROM');

  return {
    configured: missingVars.length === 0,
    host,
    port,
    secure,
    user,
    from,
    missingVars
  };
}

/**
 * Scrubs any sensitive credentials or 6-digit OTPs from technical error messages
 * before server-side logging.
 */
function sanitizeEmailError(err: unknown, secretsToRedact: string[]): string {
  let msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err || 'Unknown SMTP error');
  for (const secret of secretsToRedact) {
    if (secret && secret.length >= 4) {
      msg = msg.split(secret).join('[REDACTED]');
    }
  }
  return msg;
}

function recordDeliveredTestEmailEnvelope(envelope: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  expiresAt: string;
  provider: 'SMTP' | 'MOCK_TRANSPORT';
  messageId?: string;
}): void {
  if (process.env.NODE_ENV === 'production') return;
  try {
    let currentOutbox: Record<string, any> = {};
    if (fs.existsSync(TEST_EMAIL_OUTBOX_PATH)) {
      currentOutbox = JSON.parse(fs.readFileSync(TEST_EMAIL_OUTBOX_PATH, 'utf8') || '{}');
    }
    currentOutbox[envelope.to.toLowerCase()] = {
      to: envelope.to.toLowerCase(),
      from: envelope.from,
      subject: envelope.subject,
      text: envelope.text,
      html: envelope.html,
      provider: envelope.provider,
      messageId: envelope.messageId,
      expiresAt: envelope.expiresAt,
      sentAt: new Date().toISOString()
    };
    fs.writeFileSync(TEST_EMAIL_OUTBOX_PATH, JSON.stringify(currentOutbox, null, 2), { mode: 0o600 });
  } catch {
    // Ignore local spool write errors
  }
}

/**
 * Sends the 6-digit password reset OTP email using Nodemailer SMTP (or an injected/mock test transport).
 * Never logs the OTP or SMTP credentials.
 */
export async function sendPasswordResetOtpEmail(params: {
  toEmail: string;
  fullName: string;
  otp: string;
  expiresAtIso: string;
  testTransportMode?: 'mock' | 'fail';
}): Promise<EmailDeliveryResult> {
  const { toEmail, fullName, otp, expiresAtIso, testTransportMode } = params;
  const smtpStatus = getSmtpConfigStatus();
  const emailPassword = (process.env.EMAIL_PASSWORD || '').trim();

  const fromAddress = smtpStatus.from;
  const subject = 'Cooperative Portal — Password Reset Verification Code';
  const textBody = [
    `Hello ${fullName},`,
    '',
    'We received a request to reset the password for your Cooperative Member account.',
    `Your one-time 6-digit verification code is: ${otp}`,
    '',
    'This verification code expires in 10 minutes and can only be used once.',
    'If you did not request a password reset, please ignore this email and your password will remain unchanged.'
  ].join('\n');

  const htmlBody = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; color: #0f172a;">
      <h2 style="margin: 0 0 12px; color: #059669; font-size: 18px;">Password Reset Verification Code</h2>
      <p style="font-size: 14px; line-height: 1.5; margin: 0 0 16px;">Hello <strong>${fullName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5; margin: 0 0 16px;">
        Use the following single-use 6-digit verification code to reset your Cooperative Member portal password:
      </p>
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #0f172a; margin: 0 0 16px;">
        ${otp}
      </div>
      <p style="font-size: 12px; color: #64748b; margin: 0;">
        This code expires in <strong>10 minutes</strong> and is valid for a single use (maximum 5 verification attempts). If you did not request this reset, you can safely disregard this email.
      </p>
    </div>
  `;

  // Simulated transport failure mode for automated testing of SMTP failure handling
  if (testTransportMode === 'fail') {
    const simulatedErr = 'Error: Simulated SMTP connection failure (ECONNREFUSED)';
    console.error(`[EmailService] Failed to send password reset email to ${toEmail}: ${simulatedErr}`);
    return {
      sent: false,
      provider: 'SMTP',
      error: simulatedErr
    };
  }

  // 1. Use injected test transporter or mock JSON transporter when explicitly requested in tests or when unconfigured in non-prod
  if (
    customTransporterOverride ||
    testTransportMode === 'mock' ||
    process.env.EMAIL_TRANSPORT_MODE === 'mock' ||
    (!smtpStatus.configured && process.env.NODE_ENV !== 'production' && process.env.EMAIL_TRANSPORT_MODE !== 'live')
  ) {
    try {
      const transporter = customTransporterOverride || nodemailer.createTransport({ jsonTransport: true });
      const info = await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject,
        text: textBody,
        html: htmlBody
      });

      recordedInvocations.push({
        to: toEmail,
        from: fromAddress,
        subject,
        text: textBody,
        html: htmlBody,
        provider: 'MOCK_TRANSPORT',
        sentAt: new Date().toISOString(),
        messageId: info?.messageId
      });

      recordDeliveredTestEmailEnvelope({
        to: toEmail,
        from: fromAddress,
        subject,
        text: textBody,
        html: htmlBody,
        expiresAt: expiresAtIso,
        provider: 'MOCK_TRANSPORT',
        messageId: info?.messageId
      });

      return {
        sent: true,
        provider: 'MOCK_TRANSPORT',
        messageId: info?.messageId || 'mock-msg-id'
      };
    } catch (err) {
      const sanitized = sanitizeEmailError(err, [emailPassword, otp]);
      console.error(`[EmailService] Mock transport delivery failed for ${toEmail}: ${sanitized}`);
      return {
        sent: false,
        provider: 'MOCK_TRANSPORT',
        error: sanitized
      };
    }
  }

  // 2. Verify real SMTP configuration
  if (!smtpStatus.configured) {
    const missingMsg = `SMTP provider is not configured. Missing environment variables: ${smtpStatus.missingVars.join(', ')}.`;
    console.error(`[EmailService] Password reset email NOT sent to ${toEmail}: ${missingMsg}`);
    return {
      sent: false,
      provider: 'UNCONFIGURED',
      error: missingMsg
    };
  }

  // 3. Send through real Nodemailer SMTP transport
  try {
    const transporter = nodemailer.createTransport({
      host: smtpStatus.host,
      port: smtpStatus.port,
      secure: smtpStatus.secure,
      auth: {
        user: smtpStatus.user,
        pass: emailPassword
      }
    });

    const info = await transporter.sendMail({
      from: smtpStatus.from,
      to: toEmail,
      subject,
      text: textBody,
      html: htmlBody
    });

    recordedInvocations.push({
      to: toEmail,
      from: smtpStatus.from,
      subject,
      text: textBody,
      html: htmlBody,
      provider: 'SMTP',
      sentAt: new Date().toISOString(),
      messageId: info?.messageId
    });

    recordDeliveredTestEmailEnvelope({
      to: toEmail,
      from: smtpStatus.from,
      subject,
      text: textBody,
      html: htmlBody,
      expiresAt: expiresAtIso,
      provider: 'SMTP',
      messageId: info?.messageId
    });

    return {
      sent: true,
      provider: 'SMTP',
      messageId: info?.messageId
    };
  } catch (err) {
    const sanitized = sanitizeEmailError(err, [emailPassword, smtpStatus.user, otp]);
    console.error(`[EmailService] SMTP delivery error while sending password reset email to ${toEmail}: ${sanitized}`);
    return {
      sent: false,
      provider: 'SMTP',
      error: sanitized
    };
  }
}

/**
 * Sends an official account/financial notification email to a member's registered email address.
 * Never creates or alters financial balances.
 */
export async function sendMemberNotificationEmail(
  params: MemberEmailNotificationParams
): Promise<EmailDeliveryResult> {
  const {
    toEmail,
    fullName,
    title,
    message,
    loanNumber,
    referenceNumber,
    amount,
    dueDate,
    actionUrl,
    actionLabel,
    cooperativeName = 'CCT Credit Cooperative',
    testTransportMode
  } = params;

  const smtpStatus = getSmtpConfigStatus();
  const emailPassword = (process.env.EMAIL_PASSWORD || '').trim();
  const fromAddress = smtpStatus.from || `"${cooperativeName}" <no-reply@cctcoop.org>`;
  const subject = params.subjectOverride || `${cooperativeName} — ${title}`;

  const cleanActionUrl = actionUrl || process.env.APP_URL || 'http://localhost:3000';
  const cleanActionLabel = actionLabel || 'Access Cooperative Portal';

  const formattedAmount = typeof amount === 'number' && !isNaN(amount)
    ? `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : undefined;

  // Build clean plain text body
  const textLines: string[] = [
    cooperativeName.toUpperCase(),
    '='.repeat(cooperativeName.length),
    '',
    `Notification: ${title}`,
    `Hello ${fullName},`,
    '',
    message,
    ''
  ];

  if (loanNumber || referenceNumber || formattedAmount || dueDate) {
    textLines.push('TRANSACTION / ACCOUNT DETAILS:');
    if (loanNumber) textLines.push(`• Loan / Application Number: ${loanNumber}`);
    if (referenceNumber && referenceNumber !== loanNumber) textLines.push(`• Reference / Receipt Number: ${referenceNumber}`);
    if (formattedAmount) textLines.push(`• Amount: ${formattedAmount}`);
    if (dueDate) textLines.push(`• Due Date: ${dueDate}`);
    textLines.push('');
  }

  textLines.push(`View your account online at: ${cleanActionUrl}`);
  textLines.push('');
  textLines.push('Notice: This is an automated notification from CCT Cooperative. Important account notices are delivered directly to your registered email address. Please do not reply directly to this email.');

  const textBody = textLines.join('\n');

  // Build high-clarity, responsive HTML email
  const detailsHtmlRows: string[] = [];
  if (loanNumber) {
    detailsHtmlRows.push(`
      <tr>
        <td style="padding: 8px 12px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Loan / Ref No.</td>
        <td style="padding: 8px 12px; font-size: 13px; color: #0f172a; font-family: monospace; font-weight: 700; text-align: right; border-bottom: 1px solid #f1f5f9;">${loanNumber}</td>
      </tr>
    `);
  }
  if (referenceNumber && referenceNumber !== loanNumber) {
    detailsHtmlRows.push(`
      <tr>
        <td style="padding: 8px 12px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Receipt / Ref No.</td>
        <td style="padding: 8px 12px; font-size: 13px; color: #0f172a; font-family: monospace; font-weight: 700; text-align: right; border-bottom: 1px solid #f1f5f9;">${referenceNumber}</td>
      </tr>
    `);
  }
  if (formattedAmount) {
    detailsHtmlRows.push(`
      <tr>
        <td style="padding: 8px 12px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Amount</td>
        <td style="padding: 8px 12px; font-size: 14px; color: #059669; font-weight: 700; text-align: right; border-bottom: 1px solid #f1f5f9;">${formattedAmount}</td>
      </tr>
    `);
  }
  if (dueDate) {
    detailsHtmlRows.push(`
      <tr>
        <td style="padding: 8px 12px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Due Date</td>
        <td style="padding: 8px 12px; font-size: 13px; color: #d97706; font-weight: 700; text-align: right; border-bottom: 1px solid #f1f5f9;">${dueDate}</td>
      </tr>
    `);
  }

  const detailsBox = detailsHtmlRows.length > 0 ? `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 20px 0; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          ${detailsHtmlRows.join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Brand Header -->
          <div style="background-color: #059669; padding: 24px; color: #ffffff; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.9; margin-bottom: 4px;">Official Member Notice</div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">${cooperativeName}</h1>
          </div>

          <!-- Body Content -->
          <div style="padding: 28px 24px;">
            <div style="display: inline-block; background-color: #ecfdf5; color: #047857; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #a7f3d0;">
              ${title}
            </div>

            <p style="font-size: 15px; margin: 0 0 14px; color: #1e293b;">
              Hello <strong>${fullName}</strong>,
            </p>

            <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px; color: #334155;">
              ${message}
            </p>

            ${detailsBox}

            <div style="text-align: center; margin: 28px 0 20px;">
              <a href="${cleanActionUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: 700; border-radius: 10px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
                ${cleanActionLabel}
              </a>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 20px 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              <strong>Member Security Notice:</strong> This notification was delivered to your registered email address. CCT Cooperative will never ask for your password, PIN, or confidential financial credentials via email.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
            &copy; ${new Date().getFullYear()} ${cooperativeName}. All rights reserved.<br>
            A CDA Registered Credit Cooperative.
          </div>
        </div>
      </body>
    </html>
  `;

  // 1. Simulated failure mode for testing error resilience
  if (testTransportMode === 'fail') {
    const simulatedErr = 'Error: Simulated SMTP connection timeout (ETIMEDOUT)';
    console.error(`[EmailService] Failed to dispatch member notification email to ${toEmail}: ${simulatedErr}`);
    return {
      sent: false,
      provider: 'SMTP',
      error: simulatedErr
    };
  }

  // 2. Mock transport mode for unit tests and local mock development (or when SMTP is unconfigured in non-prod)
  if (
    customTransporterOverride ||
    testTransportMode === 'mock' ||
    process.env.EMAIL_TRANSPORT_MODE === 'mock' ||
    (!smtpStatus.configured && process.env.NODE_ENV !== 'production' && process.env.EMAIL_TRANSPORT_MODE !== 'live')
  ) {
    try {
      const transporter = customTransporterOverride || nodemailer.createTransport({ jsonTransport: true });
      const info = await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject,
        text: textBody,
        html: htmlBody
      });

      const invocationRecord: RecordedNotificationEmail = {
        to: toEmail,
        fullName,
        title,
        message,
        loanNumber,
        referenceNumber,
        amount,
        dueDate,
        provider: 'MOCK_TRANSPORT',
        sentAt: new Date().toISOString(),
        subject,
        text: textBody,
        html: htmlBody,
        messageId: info?.messageId || `mock_msg_${Date.now()}`
      };

      recordedNotificationEmails.push(invocationRecord);
      recordedInvocations.push({
        to: toEmail,
        from: fromAddress,
        subject,
        text: textBody,
        html: htmlBody,
        provider: 'MOCK_TRANSPORT',
        sentAt: invocationRecord.sentAt,
        messageId: invocationRecord.messageId
      });

      return {
        sent: true,
        provider: 'MOCK_TRANSPORT',
        messageId: invocationRecord.messageId
      };
    } catch (err) {
      const sanitized = sanitizeEmailError(err, [emailPassword]);
      console.error(`[EmailService] Mock notification delivery failed for ${toEmail}: ${sanitized}`);
      return {
        sent: false,
        provider: 'MOCK_TRANSPORT',
        error: sanitized
      };
    }
  }

  // 3. Unconfigured check
  if (!smtpStatus.configured) {
    const missingMsg = `SMTP email provider is unconfigured. Missing: ${smtpStatus.missingVars.join(', ')}.`;
    console.warn(`[EmailService] Member notification email NOT sent to ${toEmail}: ${missingMsg}`);
    return {
      sent: false,
      provider: 'UNCONFIGURED',
      error: missingMsg
    };
  }

  // 4. Real SMTP delivery
  try {
    const transporter = nodemailer.createTransport({
      host: smtpStatus.host,
      port: smtpStatus.port,
      secure: smtpStatus.secure,
      auth: {
        user: smtpStatus.user,
        pass: emailPassword
      }
    });

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      text: textBody,
      html: htmlBody
    });

    const invocationRecord: RecordedNotificationEmail = {
      to: toEmail,
      fullName,
      title,
      message,
      loanNumber,
      referenceNumber,
      amount,
      dueDate,
      provider: 'SMTP',
      sentAt: new Date().toISOString(),
      subject,
      text: textBody,
      html: htmlBody,
      messageId: info?.messageId
    };

    recordedNotificationEmails.push(invocationRecord);
    recordedInvocations.push({
      to: toEmail,
      from: fromAddress,
      subject,
      text: textBody,
      html: htmlBody,
      provider: 'SMTP',
      sentAt: invocationRecord.sentAt,
      messageId: info?.messageId
    });

    return {
      sent: true,
      provider: 'SMTP',
      messageId: info?.messageId
    };
  } catch (err) {
    const sanitized = sanitizeEmailError(err, [emailPassword, smtpStatus.user]);
    console.error(`[EmailService] SMTP delivery error while sending member notification to ${toEmail}: ${sanitized}`);
    return {
      sent: false,
      provider: 'SMTP',
      error: sanitized
    };
  }
}
