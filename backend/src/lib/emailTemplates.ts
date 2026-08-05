const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const APP_NAME = 'Loan Alert System';

export interface WelcomeEmailParams {
  name: string;
  email: string;
  role: string;
  resetLink: string;
  temporaryPassword?: string;
  expiresInMinutes?: number;
}

export interface PasswordResetEmailParams {
  name: string;
  resetLink: string;
  expiresInMinutes?: number;
}

export const emailTemplates = {
  /**
   * Account Creation / Welcome Email with Password Setup Link
   */
  userWelcome: ({
    name,
    email,
    role,
    resetLink,
    temporaryPassword,
    expiresInMinutes = 30,
  }: WelcomeEmailParams) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 36px 32px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(37, 99, 235, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 8px; padding: 8px 16px; margin-bottom: 12px;">
                <span style="color: #60a5fa; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">System Account</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Welcome to ${APP_NAME}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px; line-height: 1.6;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #334155;">Hello <strong>${name}</strong>,</p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
                An account has been created for you on the <strong>${APP_NAME}</strong> platform with the assigned role of <span style="background-color: #f1f5f9; color: #0f172a; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 13px;">${role}</span>.
              </p>

              <!-- Account Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #64748b;">Account Email:</td>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0f172a; font-weight: 600; text-align: right;">${email}</td>
                </tr>
                ${temporaryPassword
        ? `
                <tr>
                  <td style="padding: 16px 20px; font-size: 14px; color: #64748b;">Temporary Password:</td>
                  <td style="padding: 16px 20px; font-size: 14px; color: #2563eb; font-weight: 700; font-family: monospace; text-align: right;">${temporaryPassword}</td>
                </tr>
                `
        : ''
      }
              </table>

              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
                To secure your account and start using the system, please set up your permanent password using the button below:
              </p>

              <!-- CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); transition: background-color 0.2s;">
                      Set Up Your Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
                  <strong>Note:</strong> This setup link is valid for <strong>${expiresInMinutes} minutes</strong>. If the link expires, you can request a new password reset link from the login page.
                </p>
              </div>

              <p style="margin: 0; font-size: 14px; color: #64748b;">
                Best regards,<br>
                <strong style="color: #1e293b;">The ${APP_NAME} Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0 0 4px 0;">This is an automated system email. Please do not reply directly to this message.</p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  },

  /**
   * Borrower Account Registration / Welcome Email
   */
  borrowerWelcome: ({
    name,
    email,
    resetLink,
    temporaryPassword = 'Borrower123!',
    expiresInMinutes = 30,
  }: WelcomeEmailParams) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome Borrower Account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 32px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 8px; padding: 8px 16px; margin-bottom: 12px;">
                <span style="color: #34d399; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Borrower Portal</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Welcome, ${name}!</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px; line-height: 1.6;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #334155;">Dear <strong>${name}</strong>,</p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
                Your borrower account has been successfully registered on the <strong>${APP_NAME}</strong> portal. You can log in to track your loan schedules, check balances, and communicate directly with your loan officer.
              </p>

              <!-- Account Details -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #64748b;">Registered Email:</td>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0f172a; font-weight: 600; text-align: right;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; font-size: 14px; color: #64748b;">Temporary Password:</td>
                  <td style="padding: 16px 20px; font-size: 14px; color: #059669; font-weight: 700; font-family: monospace; text-align: right;">${temporaryPassword}</td>
                </tr>
              </table>

              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
                For your security, we strongly recommend setting up your own personal password before accessing your account:
              </p>

              <!-- CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.2); transition: background-color 0.2s;">
                      Set Up Personal Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; color: #065f46; line-height: 1.5;">
                  <strong>Security Reminder:</strong> Never share your account password with anyone. The password reset link above remains valid for <strong>${expiresInMinutes} minutes</strong>.
                </p>
              </div>

              <p style="margin: 0; font-size: 14px; color: #64748b;">
                Warm regards,<br>
                <strong style="color: #1e293b;">The Lending Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0 0 4px 0;">This is an automated system email. Please do not reply directly to this message.</p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  },

  /**
   * Forgot Password Email Request
   */
  forgotPassword: ({
    name,
    resetLink,
    expiresInMinutes = 30,
  }: PasswordResetEmailParams) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 36px 32px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 8px 16px; margin-bottom: 12px;">
                <span style="color: #f87171; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Security Notice</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Password Reset Request</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px; line-height: 1.6;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #334155;">Hello <strong>${name}</strong>,</p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
                We received a request to reset the password for your account on <strong>${APP_NAME}</strong>. Click the button below to set a new password:
              </p>

              <!-- CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" target="_blank" style="display: inline-block; background-color: #dc2626; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2); transition: background-color 0.2s;">
                      Reset Password Now &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #991b1b; font-weight: 600;">Important Security Information:</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #991b1b; line-height: 1.5;">
                  <li>This reset link is valid for <strong>${expiresInMinutes} minutes</strong>.</li>
                  <li>If you did not request a password reset, please ignore this email — your account remains safe and unchanged.</li>
                </ul>
              </div>

              <p style="margin: 0; font-size: 14px; color: #64748b;">
                Best regards,<br>
                <strong style="color: #1e293b;">The ${APP_NAME} Security Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0 0 4px 0;">This is an automated security email. Please do not reply directly to this message.</p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  },

  /**
   * Consolidated Borrower Reminder Digest (Combines multiple installments into 1 email)
   */
  consolidatedBorrowerReminder: ({
    borrowerName,
    items,
  }: {
    borrowerName: string;
    items: Array<{
      loanNumber: string;
      installmentNumber: number;
      dueDate: string;
      amountRemaining: number;
      isOverdue: boolean;
      statusText: string;
    }>;
  }) => {
    const totalAmount = items.reduce((sum, item) => sum + item.amountRemaining, 0);
    const hasOverdue = items.some((item) => item.isOverdue);
    const headerColor = hasOverdue
      ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
      : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
    const headerBadgeText = hasOverdue ? 'Action Required' : 'Payment Reminder';
    const headerBadgeBg = hasOverdue ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.2)';
    const headerTitle = hasOverdue ? 'Overdue & Upcoming Payment Summary' : 'Upcoming Payment Digest';

    const rowsHtml = items
      .map(
        (item) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 14px; font-size: 14px; color: #0f172a; font-weight: 600;">${item.loanNumber}</td>
        <td style="padding: 12px 14px; font-size: 14px; color: #475569; text-align: center;">#${item.installmentNumber}</td>
        <td style="padding: 12px 14px; font-size: 14px; color: #475569;">${item.dueDate}</td>
        <td style="padding: 12px 14px; font-size: 14px; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; ${
            item.isOverdue
              ? 'background-color: #fef2f2; color: #dc2626; border: 1px solid #fecaca;'
              : 'background-color: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;'
          }">${item.statusText}</span>
        </td>
        <td style="padding: 12px 14px; font-size: 14px; color: #0f172a; font-weight: 700; text-align: right;">RWF ${item.amountRemaining.toLocaleString()}</td>
      </tr>
    `
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Summary</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 650px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background: ${headerColor}; padding: 36px 32px; text-align: center;">
              <div style="display: inline-block; background-color: ${headerBadgeBg}; border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 8px; padding: 6px 14px; margin-bottom: 12px;">
                <span style="color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">${headerBadgeText}</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${headerTitle}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px; line-height: 1.6;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #334155;">Dear <strong>${borrowerName}</strong>,</p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
                Here is your combined daily loan installment statement. You have <strong>${items.length}</strong> installment(s) requiring your attention:
              </p>

              <!-- Installments Table -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <thead>
                  <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <th style="padding: 12px 14px; font-size: 13px; color: #64748b; font-weight: 600; text-align: left;">Loan #</th>
                    <th style="padding: 12px 14px; font-size: 13px; color: #64748b; font-weight: 600; text-align: center;">Inst #</th>
                    <th style="padding: 12px 14px; font-size: 13px; color: #64748b; font-weight: 600; text-align: left;">Due Date</th>
                    <th style="padding: 12px 14px; font-size: 13px; color: #64748b; font-weight: 600; text-align: center;">Status</th>
                    <th style="padding: 12px 14px; font-size: 13px; color: #64748b; font-weight: 600; text-align: right;">Amount Due</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                  <tr style="background-color: #f8fafc;">
                    <td colspan="4" style="padding: 14px; font-size: 15px; color: #0f172a; font-weight: 700; text-align: right;">Total Outstanding:</td>
                    <td style="padding: 14px; font-size: 16px; color: ${hasOverdue ? '#dc2626' : '#2563eb'}; font-weight: 800; text-align: right;">RWF ${totalAmount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              ${
                hasOverdue
                  ? `
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #991b1b; line-height: 1.5;">
                  <strong>Attention Required:</strong> One or more installments above are overdue. Please clear these balances immediately to avoid default penalties.
                </p>
              </div>
              `
                  : `
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.5;">
                  <strong>Reminder:</strong> Please ensure sufficient funds are available on or before the respective due dates.
                </p>
              </div>
              `
              }

              <p style="margin: 0 0 4px 0; font-size: 14px; color: #475569;">Thank you for your prompt cooperation.</p>
              <p style="margin: 0; font-size: 14px; color: #64748b;">
                Best regards,<br>
                <strong style="color: #1e293b;">The ${APP_NAME} Lending Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0 0 4px 0;">This is an automated system digest. Please do not reply directly to this email.</p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  },

  /**
   * Consolidated SMS Text Message Generator
   */
  consolidatedBorrowerSMS: ({
    items,
  }: {
    items: Array<{
      loanNumber: string;
      amountRemaining: number;
      isOverdue: boolean;
      statusText: string;
    }>;
  }) => {
    const total = items.reduce((sum, item) => sum + item.amountRemaining, 0);
    const hasOverdue = items.some((i) => i.isOverdue);
    const summaryList = items
      .map((i) => `${i.loanNumber}: RWF ${i.amountRemaining.toLocaleString()} (${i.statusText})`)
      .join('; ');

    const prefix = hasOverdue ? 'URGENT REMINDER' : 'PAYMENT REMINDER';
    return `${prefix}: You have ${items.length} loan installment(s) due [${summaryList}]. Total: RWF ${total.toLocaleString()}. Please pay promptly. - MFI Team`;
  },
};

