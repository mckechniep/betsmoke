// ============================================
// EMAIL SERVICE (Mailjet)
// ============================================
// Handles sending transactional emails like password reset.
// Uses Mailjet's free tier (200 emails/day, 6000/month).
//
// Setup required:
// 1. Create account at https://www.mailjet.com
// 2. Get API keys from https://app.mailjet.com/account/apikeys
// 3. Add a verified sender email in Mailjet dashboard
// 4. Add credentials to .env file
// ============================================

import Mailjet from 'node-mailjet';

// ============================================
// INITIALIZE MAILJET CLIENT
// ============================================
// We use lazy initialization to avoid errors if env vars aren't set

let mailjetClient = null;

const getMailjetClient = () => {
  if (!mailjetClient) {
    // Check if credentials are configured
    if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
      console.warn('⚠️  Mailjet credentials not configured. Email sending disabled.');
      return null;
    }

    mailjetClient = Mailjet.apiConnect(
      process.env.MAILJET_API_KEY,
      process.env.MAILJET_SECRET_KEY
    );
  }
  return mailjetClient;
};

// ============================================
// SEND PASSWORD RESET EMAIL
// ============================================
// Sends an email with a password reset link.
//
// Parameters:
//   - toEmail: The recipient's email address
//   - toName: The recipient's name (optional, defaults to email)
//   - resetToken: The unhashed reset token
//
// Returns: { success: boolean, error?: string }
// ============================================

export const sendPasswordResetEmail = async (toEmail, toName, resetToken) => {
  const client = getMailjetClient();
  
  // If Mailjet isn't configured, log the token for development
  if (!client) {
    console.log('📧 [DEV MODE] Password reset email would be sent to:', toEmail);
    console.log('📧 [DEV MODE] Reset token:', resetToken);
    console.log('📧 [DEV MODE] Reset link:', `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`);
    return { success: true, devMode: true };
  }

  // Build the reset link
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  try {
    const result = await client
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: process.env.MAILJET_FROM_EMAIL || 'noreply@betsmoke.com',
              Name: process.env.MAILJET_FROM_NAME || 'BetSmoke'
            },
            To: [
              {
                Email: toEmail,
                Name: toName || toEmail
              }
            ],
            Subject: 'Reset Your BetSmoke Password',
            // Plain text version (for email clients that don't support HTML)
            TextPart: `
Hi${toName ? ` ${toName}` : ''},

You requested to reset your BetSmoke password.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

- The BetSmoke Team
            `.trim(),
            // HTML version (prettier formatting)
            HTMLPart: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎰 BetSmoke</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
    
    <p>Hi${toName ? ` <strong>${toName}</strong>` : ''},</p>
    
    <p>You requested to reset your BetSmoke password. Click the button below to create a new password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" 
         style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        Reset Password
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      This link will expire in <strong>1 hour</strong>.
    </p>
    
    <p style="color: #6b7280; font-size: 14px;">
      If you didn't request this password reset, you can safely ignore this email. Your password won't be changed.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetLink}" style="color: #3b82f6; word-break: break-all;">${resetLink}</a>
    </p>
  </div>
</body>
</html>
            `.trim()
          }
        ]
      });

    console.log('✅ Password reset email sent to:', toEmail);
    return { success: true };

  } catch (error) {
    console.error('❌ Failed to send password reset email:', error.message);
    return { 
      success: false, 
      error: error.message || 'Failed to send email'
    };
  }
};

// ============================================
// EXPORT
// ============================================

export default {
  sendPasswordResetEmail
};
