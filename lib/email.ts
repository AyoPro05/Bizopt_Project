import { Resend } from "resend";

let resend: Resend | null = null;

// Lazy initialize Resend only when API key is available
function getResend() {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured. Email features disabled.");
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export interface SendVerificationEmailParams {
  email: string;
  userName: string;
  verificationToken: string;
}

/**
 * Send verification email to new user
 */
export async function sendVerificationEmail({
  email,
  userName,
  verificationToken,
}: SendVerificationEmailParams) {
  const emailClient = getResend();
  if (!emailClient) {
    console.warn("Email service not available. Skipping verification email.");
    return { success: false, error: "Email service not configured" };
  }

  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${verificationToken}`;

  try {
    const result = await emailClient.emails.send({
      from: `BizOpt <onboarding@resend.dev>`, // Change to your domain after adding DNS
      to: email,
      subject: "Verify your BizOpt account",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #0d9488; font-size: 24px; margin-bottom: 20px;">Welcome to BizOpt!</h1>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            Hi ${userName},
          </p>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            Thanks for signing up. Please verify your email address to activate your account and start creating amazing content.
          </p>
          
          <div style="margin-bottom: 30px;">
            <a href="${verificationUrl}" style="display: inline-block; background-color: #0d9488; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 14px; margin-bottom: 10px;">
            Or copy and paste this link in your browser:
          </p>
          
          <p style="color: #0d9488; font-size: 14px; word-break: break-all; margin-bottom: 30px;">
            ${verificationUrl}
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin-bottom: 30px;" />
          
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 10px;">
            This link will expire in 24 hours.
          </p>
          
          <p style="color: #94a3b8; font-size: 12px;">
            Questions? Reply to this email or visit our help center.
          </p>
        </div>
      `,
    });

    if (result.error) {
      console.error("Failed to send verification email:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Error sending verification email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

/**
 * Send welcome email after verification
 */
export async function sendWelcomeEmail({
  email,
  userName,
}: {
  email: string;
  userName: string;
}) {
  const emailClient = getResend();
  if (!emailClient) {
    console.warn("Email service not available. Skipping welcome email.");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const result = await emailClient.emails.send({
      from: `BizOpt <onboarding@resend.dev>`,
      to: email,
      subject: "Let's create your first campaign!",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #0d9488; font-size: 24px; margin-bottom: 20px;">You're all set! 🎉</h1>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            Hi ${userName},
          </p>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            Your email is verified and your account is ready to use. Start your 7-day free trial and create your first AI-powered social media campaign.
          </p>
          
          <div style="margin-bottom: 30px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/ai-studio" style="display: inline-block; background-color: #0d9488; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Go to AI Studio
            </a>
          </div>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            <strong>Quick Start:</strong>
          </p>
          
          <ol style="color: #475569; font-size: 16px; line-height: 1.8; margin-bottom: 30px; padding-left: 20px;">
            <li>Generate 3 free content ideas in AI Studio</li>
            <li>Pick your favorite and customize it</li>
            <li>Publish to LinkedIn immediately</li>
            <li>Watch your growth metrics in real-time</li>
          </ol>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            Your 7-day trial includes unlimited ideas, multi-platform publishing, growth predictions, and compliance checks. No credit card needed to explore.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin-bottom: 30px;" />
          
          <p style="color: #94a3b8; font-size: 12px;">
            Questions? We're here to help. Reply to this email anytime.
          </p>
        </div>
      `,
    });

    if (result.error) {
      console.error("Failed to send welcome email:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

/**
 * Send trial ending notification
 */
export async function sendTrialEndingEmail({
  email,
  userName,
  daysLeft,
}: {
  email: string;
  userName: string;
  daysLeft: number;
}) {
  const emailClient = getResend();
  if (!emailClient) {
    console.warn("Email service not available. Skipping trial ending email.");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const result = await emailClient.emails.send({
      from: `BizOpt <onboarding@resend.dev>`,
      to: email,
      subject: `Your trial ends in ${daysLeft} days`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #0d9488; font-size: 24px; margin-bottom: 20px;">Your trial ends soon</h1>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            Hi ${userName},
          </p>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            Your 7-day trial expires in <strong>${daysLeft} days</strong>. To continue using BizOpt and get access to unlimited content ideas and insights, please upgrade your account.
          </p>
          
          <div style="margin-bottom: 30px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/billing" style="display: inline-block; background-color: #0d9488; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Upgrade Now
            </a>
          </div>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            After your trial, you can upgrade to our Pro plan for just <strong>$9.99/month</strong> and never miss a beat.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin-bottom: 30px;" />
          
          <p style="color: #94a3b8; font-size: 12px;">
            Questions? We're here to help. Reply to this email anytime.
          </p>
        </div>
      `,
    });

    if (result.error) {
      console.error("Failed to send trial ending email:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Error sending trial ending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}
