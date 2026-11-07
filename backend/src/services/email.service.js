/**
 * Email service - sends transactional emails over SMTP via Nodemailer.
 *
 * Defaults to Gmail (smtp.gmail.com:465, implicit TLS) using an app password.
 * HOST/PORT/USER/PASS/FROM are config-driven, so another relay can be swapped
 * in via env without code changes. Templates are defined here for consistency
 * across the platform.
 */

const nodemailer = require('nodemailer');
const { config } = require('../config');
const { logger } = require('../utils/logger');

let transporter = null;

/**
 * Get or create the email transporter.
 */
const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    // 465 is implicit TLS; 587/25 use STARTTLS.
    secure: config.SMTP_PORT === 465,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });

  return transporter;
};

/**
 * Send a raw email.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await getTransporter().sendMail({
      from: `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });

    logger.info('Email sent', { to, subject, messageId: info.messageId });
    return info;
  } catch (error) {
    logger.error('Email send failed', { to, subject, error: error.message });
    throw error;
  }
};

/**
 * Send OTP verification email.
 */
const sendOtpEmail = async (email, otp) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width:480px;background-color:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
              <!-- Header -->
              <tr>
                <td style="padding:32px 32px 0;text-align:center;">
                  <h1 style="margin:0;font-size:24px;color:#1a1a2e;font-weight:700;">Marketplace.ng</h1>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px;font-size:16px;color:#374151;">Your verification code is:</p>
                  <div style="background-color:#f0f4ff;border-radius:8px;padding:24px;text-align:center;margin:0 0 24px;">
                    <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a2e;">${otp}</span>
                  </div>
                  <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">This code expires in <strong>10 minutes</strong>.</p>
                  <p style="margin:0;font-size:14px;color:#6b7280;">If you didn't request this code, ignore this email.</p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:0 32px 32px;text-align:center;">
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    &copy; ${new Date().getFullYear()} Marketplace.ng. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${otp} - Your Marketplace.ng verification code`,
    html,
    text: `Your verification code is: ${otp}. It expires in 10 minutes.`,
  });
};

/**
 * Send welcome email after registration.
 */
const sendWelcomeEmail = async (email, firstName) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width:480px;background-color:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
              <tr>
                <td style="padding:32px 32px 0;text-align:center;">
                  <h1 style="margin:0;font-size:24px;color:#1a1a2e;font-weight:700;">Welcome to Marketplace.ng!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${firstName},</p>
                  <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
                    Your account has been created successfully. You can now:
                  </p>
                  <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#6b7280;">
                    <li style="margin-bottom:8px;">Fund your wallet via bank transfer</li>
                    <li style="margin-bottom:8px;">Buy airtime, data, and pay electricity bills</li>
                    <li style="margin-bottom:8px;">Send & receive money instantly</li>
                    <li>Discover vendors and products across the marketplace</li>
                  </ul>
                  <p style="margin:0;font-size:14px;color:#6b7280;">Set up your transaction PIN to start using financial features.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 32px;text-align:center;">
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    &copy; ${new Date().getFullYear()} Marketplace.ng
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Welcome to Marketplace.ng, ${firstName}!`,
    html,
    text: `Hi ${firstName}, welcome to Marketplace.ng! Your account is ready.`,
  });
};

/**
 * Send password reset email.
 */
const sendPasswordResetEmail = async (email, otp) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width:480px;background-color:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
              <tr>
                <td style="padding:32px 32px 0;text-align:center;">
                  <h1 style="margin:0;font-size:24px;color:#1a1a2e;font-weight:700;">Password Reset</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px;font-size:16px;color:#374151;">
                    You requested a password reset. Use this code:
                  </p>
                  <div style="background-color:#fef3f2;border-radius:8px;padding:24px;text-align:center;margin:0 0 24px;">
                    <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#dc2626;">${otp}</span>
                  </div>
                  <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">This code expires in <strong>10 minutes</strong>.</p>
                  <p style="margin:0;font-size:14px;color:#ef4444;font-weight:600;">If you didn't request this, change your password immediately.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 32px;text-align:center;">
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    &copy; ${new Date().getFullYear()} Marketplace.ng
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${otp} - Password reset code`,
    html,
    text: `Your password reset code is: ${otp}. It expires in 10 minutes.`,
  });
};

// ============================================================
// Vendor Notification Emails
// ============================================================

const emailBase = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background-color:#ffffff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#EA580C,#C2410C);padding:28px 32px;border-radius:16px 16px 0 0;">
              <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.3px;">Marketplace.ng</h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Vendor Notification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} Marketplace.ng. All rights reserved.</p>
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Questions? Contact <a href="mailto:support@marketplace.ng" style="color:#EA580C;text-decoration:none;">support@marketplace.ng</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const btnPrimary = (text, href = "#") =>
  `<div style="text-align:center;margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:#EA580C;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none;">${text}</a>
  </div>`;

const infoBox = (color, bg, items) =>
  `<div style="background-color:${bg};border-left:4px solid ${color};border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
    ${items.map(([label, value]) => `<p style="margin:0 0 6px;font-size:14px;color:#374151;"><strong style="color:#111827;">${label}:</strong> ${value}</p>`).join('')}
  </div>`;

/**
 * Vendor application approved - welcome email with next steps.
 */
const sendVendorApprovedEmail = async (email, vendorName, dashboardUrl) => {
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#10b981;font-weight:700;">Application Approved!</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Congratulations, <strong>${vendorName}</strong>!</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Your vendor application on Marketplace.ng has been <strong style="color:#10b981;">approved</strong>.
      You can now log in to your vendor dashboard and start listing your products.
    </p>
    <div style="background:#f0fdf4;border-radius:10px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#166534;">Next Steps</p>
      <ul style="margin:0;padding-left:20px;font-size:14px;color:#374151;line-height:2;">
        <li>Log in to your vendor dashboard</li>
        <li>Complete your store profile with a logo and cover image</li>
        <li>Add your bank account for withdrawals</li>
        <li>Upload your first products or menu items</li>
        <li>Set your operating hours</li>
      </ul>
    </div>
    ${btnPrimary('Go to Vendor Dashboard', dashboardUrl)}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">This button signs you straight in - no password needed. Welcome aboard!</p>
  `);

  return sendEmail({
    to: email,
    subject: `Your Marketplace.ng vendor application is approved - ${vendorName}`,
    html,
    text: `Congratulations! Your vendor application for ${vendorName} has been approved. Log in to your dashboard to get started.`,
  });
};

/**
 * Vendor application rejected - reason + how to reapply.
 */
const sendVendorRejectedEmail = async (email, vendorName, reason) => {
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#ef4444;font-weight:700;">Application Not Approved</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${vendorName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      After reviewing your application, we were unable to approve your vendor account at this time.
    </p>
    ${infoBox('#ef4444', '#fef2f2', [['Reason', reason || 'Your application did not meet our current requirements.']])}
    <div style="background:#fafafa;border-radius:10px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#374151;">What you can do</p>
      <ul style="margin:0;padding-left:20px;font-size:14px;color:#6b7280;line-height:2;">
        <li>Review the reason above and address the issue</li>
        <li>Re-submit your application with the required corrections</li>
        <li>Contact our support team if you need clarification</li>
      </ul>
    </div>
    <p style="margin:20px 0 0;font-size:14px;color:#6b7280;">
      If you believe this decision was made in error, please contact us at
      <a href="mailto:support@marketplace.ng" style="color:#EA580C;">support@marketplace.ng</a>.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: `Update on your Marketplace.ng vendor application`,
    html,
    text: `Dear ${vendorName}, your vendor application was not approved. Reason: ${reason}. Please contact support@marketplace.ng for more information.`,
  });
};

/**
 * Vendor suspended - reason + contact info.
 */
const sendVendorSuspendedEmail = async (email, vendorName, reason) => {
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#f59e0b;font-weight:700;">Account Suspended</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${vendorName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Your vendor account has been <strong style="color:#f59e0b;">temporarily suspended</strong>.
      During this period, your store will not be visible to customers and withdrawals are paused.
    </p>
    ${infoBox('#f59e0b', '#fffbeb', [['Suspension Reason', reason || 'Account review in progress.']])}
    <p style="margin:20px 0;font-size:14px;color:#6b7280;line-height:1.6;">
      To appeal this decision or get more information, please contact our vendor support team at
      <a href="mailto:support@marketplace.ng" style="color:#EA580C;">support@marketplace.ng</a>
      or call <strong>+234-800-000-0000</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#9ca3af;">We aim to resolve all suspensions as quickly as possible.</p>
  `);

  return sendEmail({
    to: email,
    subject: `Important: Your Marketplace.ng vendor account has been suspended`,
    html,
    text: `Dear ${vendorName}, your vendor account has been suspended. Reason: ${reason}. Contact support@marketplace.ng to appeal.`,
  });
};

/**
 * Vendor unsuspended - access restored.
 */
const sendVendorUnsuspendedEmail = async (email, vendorName, dashboardUrl) => {
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#10b981;font-weight:700;">Account Restored</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${vendorName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Great news! The suspension on your vendor account has been <strong style="color:#10b981;">lifted</strong>.
      Your store is now live again and customers can place orders.
    </p>
    <div style="background:#f0fdf4;border-radius:10px;padding:20px;margin:20px 0;">
      <p style="margin:0;font-size:14px;color:#166534;line-height:1.6;">
        You can log in to your dashboard to resume normal operations.
      </p>
    </div>
    ${btnPrimary('Go to Vendor Dashboard', dashboardUrl)}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">This button signs you straight in - no password needed. Thank you for your patience.</p>
  `);

  return sendEmail({
    to: email,
    subject: `Your Marketplace.ng vendor account has been restored - ${vendorName}`,
    html,
    text: `Dear ${vendorName}, your vendor account suspension has been lifted. You can now log in and resume operations.`,
  });
};

// ============================================================
// Marketing-site contact form
// ============================================================

const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Forward a marketing-site contact-form submission to the inbox.
 * The Reply-To is set to the submitter so support staff can hit Reply directly.
 */
const sendContactInquiryEmail = async ({ to, name, email, message, source }) => {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
  const safeSource = source ? escapeHtml(source) : null;

  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">New contact form message</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Someone reached out via the Marketplace.ng website contact form.</p>
    ${infoBox('#EA580C', '#fff7ed', [
      ['Name', safeName],
      ['Email', `<a href="mailto:${safeEmail}" style="color:#EA580C;">${safeEmail}</a>`],
      ...(safeSource ? [['Submitted from', safeSource]] : []),
    ])}
    <div style="background:#fafafa;border-radius:10px;padding:18px 20px;margin:20px 0;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
      <p style="margin:0;font-size:15px;color:#111827;line-height:1.6;">${safeMessage}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;">Reply to this email to respond to ${safeName} directly.</p>
  `);

  return getTransporter().sendMail({
    from: `"Marketplace.ng" <${config.SMTP_FROM_EMAIL}>`,
    to,
    replyTo: email,
    subject: `Website contact - ${name}`,
    html,
    text: `New contact form submission\n\nFrom: ${name} <${email}>${source ? `\nFrom page: ${source}` : ''}\n\nMessage:\n${message}\n`,
  }).then((info) => {
    logger.info('Contact inquiry forwarded', { to, from: email, messageId: info.messageId });
    return info;
  });
};

/**
 * Confirmation auto-reply to the form submitter so they know we got it.
 */
const sendContactConfirmationEmail = async ({ name, email }) => {
  const safeName = escapeHtml(name);
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">We got your message</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${safeName},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Thanks for reaching out to Marketplace.ng. A human on our team will get back to you
      within one business day at this email address.
    </p>
    <div style="background:#f0fdf4;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0;font-size:14px;color:#166534;">
        Need a faster response? You can also email us at
        <a href="mailto:hello@marketplace.ng" style="color:#EA580C;">hello@marketplace.ng</a>
        or message us on WhatsApp.
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;">- The Marketplace.ng team</p>
  `);

  return sendEmail({
    to: email,
    subject: 'We received your message - Marketplace.ng',
    html,
    text: `Hi ${name},\n\nThanks for reaching out to Marketplace.ng. A human on our team will get back to you within one business day.\n\n- The Marketplace.ng team`,
  });
};

/**
 * Internal team alert: a vendor application needs review. Fires on a brand-new
 * application and on a resubmission after rejection, so the pending queue is
 * never silent. Sent to the team inbox (CONTACT_INBOX_EMAIL), not the vendor.
 */
const sendVendorApplicationAlertEmail = async ({ to, vendorName, contactEmail, contactPhone, isResubmission = false }) => {
  const heading = isResubmission ? 'Vendor application resubmitted' : 'New vendor application';
  const lead = isResubmission
    ? 'A previously rejected vendor has fixed their profile and resubmitted for review.'
    : 'A new vendor has registered and is waiting for approval.';

  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#EA580C;font-weight:700;">${heading}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">${lead}</p>
    ${infoBox('#EA580C', '#fff7ed', [
      ['Business', escapeHtml(vendorName || '-')],
      ...(contactEmail ? [['Email', escapeHtml(contactEmail)]] : []),
      ...(contactPhone ? [['Phone', escapeHtml(contactPhone)]] : []),
      ['Status', 'Pending approval'],
    ])}
    <p style="margin:0;font-size:13px;color:#9ca3af;">Open the admin dashboard to review it under Vendors → Pending.</p>
  `);

  return sendEmail({
    to,
    subject: `${isResubmission ? 'Resubmitted' : 'New'} vendor application - ${vendorName || 'Unknown'}`,
    html,
    text: `${lead}\n\nBusiness: ${vendorName || '-'}${contactEmail ? `\nEmail: ${contactEmail}` : ''}${contactPhone ? `\nPhone: ${contactPhone}` : ''}\nStatus: Pending approval\n\nReview it in the admin dashboard under Vendors > Pending.`,
  });
};

/**
 * Internal team alert: a support ticket was opened or the user replied. Sent to
 * the team inbox (CONTACT_INBOX_EMAIL) so the customer isn't left waiting when
 * no admin has the dashboard open. Best-effort - callers must never let a send
 * failure block the ticket action itself.
 */
const sendSupportTicketAlertEmail = async ({
  to,
  number,
  subject,
  category,
  priority,
  customerName,
  customerEmail,
  description,
  isReply = false,
}) => {
  const heading = isReply ? 'New reply on a support ticket' : 'New support ticket';
  const lead = isReply
    ? 'A customer replied on a support thread and is waiting for a response.'
    : 'A customer opened a support ticket and is waiting for a response.';

  const safeDescription = escapeHtml(description || '').replace(/\n/g, '<br>');

  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#EA580C;font-weight:700;">${heading}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">${lead}</p>
    ${infoBox('#EA580C', '#fff7ed', [
      ['Ticket', `${escapeHtml(String(number ?? '-'))}${subject ? ` - ${escapeHtml(subject)}` : ''}`],
      ...(category ? [['Category', escapeHtml(String(category).replace(/_/g, ' '))]] : []),
      ...(priority ? [['Priority', escapeHtml(String(priority))]] : []),
      ['Customer', escapeHtml(customerName || '-')],
      ...(customerEmail ? [['Email', `<a href="mailto:${escapeHtml(customerEmail)}" style="color:#EA580C;">${escapeHtml(customerEmail)}</a>`]] : []),
    ])}
    <div style="background:#fafafa;border-radius:10px;padding:18px 20px;margin:20px 0;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
      <p style="margin:0;font-size:15px;color:#111827;line-height:1.6;">${safeDescription}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;">Open the admin dashboard to reply. Replying to this email will not update the ticket.</p>
  `);

  return sendEmail({
    to,
    subject: `${isReply ? 'Reply on' : 'New'} support ticket #${number ?? '?'}${subject ? ` - ${subject}` : ''}`,
    html,
    text: `${lead}\n\nTicket: #${number ?? '?'}${subject ? ` - ${subject}` : ''}${category ? `\nCategory: ${String(category).replace(/_/g, ' ')}` : ''}${priority ? `\nPriority: ${priority}` : ''}\nCustomer: ${customerName || '-'}${customerEmail ? `\nEmail: ${customerEmail}` : ''}\n\nMessage:\n${description || ''}\n\nOpen the admin dashboard to reply.`,
  }).then((info) => {
    logger.info('Support ticket alert email sent', { to, number, isReply, messageId: info.messageId });
    return info;
  });
};

/**
 * A customer asked a vendor to call them back about a listing (chat-commerce
 * model - see ContactVendorSheet). Sent to the vendor's own account email, no
 * confirmation copy to the customer since it's not a form submission on the
 * marketing site, just an in-app action.
 */
const sendVendorCallbackRequestEmail = async ({ to, vendorName, customerName, customerPhone, productName }) => {
  const safeCustomerName = escapeHtml(customerName);
  const safePhone = escapeHtml(customerPhone);
  const safeProductName = productName ? escapeHtml(productName) : null;

  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">A customer wants a callback</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Someone browsing your shop on Marketplace.ng asked you to call them back.</p>
    ${infoBox('#EA580C', '#fff7ed', [
      ['Customer', safeCustomerName],
      ['Phone', `<a href="tel:${safePhone}" style="color:#EA580C;">${safePhone}</a>`],
      ...(safeProductName ? [['About', safeProductName]] : []),
    ])}
    <p style="margin:0;font-size:13px;color:#9ca3af;">Give them a call when you're free - they're expecting to hear from you.</p>
  `);

  return sendEmail({
    to,
    subject: `Callback request from ${customerName}${productName ? ` - ${productName}` : ''}`,
    html,
    text: `${customerName} asked for a callback about your shop on Marketplace.ng.\n\nPhone: ${customerPhone}${productName ? `\nAbout: ${productName}` : ''}\n\nGive them a call when you're free.`,
  }).then((info) => {
    logger.info('Vendor callback request email sent', { to, vendorName, messageId: info.messageId });
    return info;
  });
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVendorApprovedEmail,
  sendVendorRejectedEmail,
  sendVendorSuspendedEmail,
  sendVendorUnsuspendedEmail,
  sendVendorApplicationAlertEmail,
  sendSupportTicketAlertEmail,
  sendContactInquiryEmail,
  sendContactConfirmationEmail,
  sendVendorCallbackRequestEmail,
};
