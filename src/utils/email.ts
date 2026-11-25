import { env } from "../config/keys.js";

const sendEmail = async (
  email: string,
  subject: string,
  htmlContent: string,
): Promise<void> => {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: env.BREVO_SENDER_EMAIL },
      to: [{ email }],
      subject,
      htmlContent,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    throw new Error(
      `Brevo email request failed (${response.status}): ${errorDetails}`,
    );
  }
};

export const sendVerificationEmail = async (
  email: string,
  otp: string,
): Promise<void> => {
  await sendEmail(
    email,
    "Verify Your OjaHub Account",
    `
      <div>
        <h2>Welcome to OjaHub!</h2>
        <p>Thank you for creating an account.</p>
        <p>Use the verification code below to verify your email address:</p>
        <h1>${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not create this account, please ignore this email.</p>
      </div>
    `,
  );
};
export const sendPasswordResetEmail = async (
  email: string,
  otp: string,
): Promise<void> => {
  await sendEmail(
    email,
    "Reset Your OjaHub Password",
    `
      <div>
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your OjaHub password.</p>
        <p>Use the code below to reset your password:</p>
        <h1>${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
      </div>
    `,
  );
};
