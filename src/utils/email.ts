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

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });

const formatAmount = (amountKobo: number): string =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(amountKobo / 100);

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
        <h1>${escapeHtml(otp)}</h1>
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
        <h1>${escapeHtml(otp)}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
      </div>
    `,
  );
};

interface PaymentEmailDetails {
  name: string;
  planLabel: string;
  amountKobo: number;
  reference: string;
}

export const sendPaymentSuccessEmail = async (
  email: string,
  details: PaymentEmailDetails & {
    paidAt: Date;
    currentPeriodEnd: Date;
  },
): Promise<void> => {
  const name = escapeHtml(details.name);
  const plan = escapeHtml(details.planLabel);
  const reference = escapeHtml(details.reference);
  const amount = formatAmount(details.amountKobo);
  const paymentDate = details.paidAt.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  });
  const subscriptionEnd = details.currentPeriodEnd.toLocaleDateString("en-NG", {
    dateStyle: "long",
    timeZone: "Africa/Lagos",
  });

  await sendEmail(
    email,
    "Payment Successful - OjaHub Subscription Activated",
    `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; margin: auto;">
        <h2 style="color: #16803c;">Payment Successful!</h2>
        <p>Hello ${name},</p>
        <p>We have successfully received your subscription payment. Your OjaHub subscription is now active.</p>

        <h3>Payment Details</h3>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px;">Plan</td><td style="padding: 8px;"><strong>${plan}</strong></td></tr>
          <tr><td style="padding: 8px;">Amount paid</td><td style="padding: 8px;"><strong>${amount}</strong></td></tr>
          <tr><td style="padding: 8px;">Payment date</td><td style="padding: 8px;">${paymentDate}</td></tr>
          <tr><td style="padding: 8px;">Reference</td><td style="padding: 8px;">${reference}</td></tr>
          <tr><td style="padding: 8px;">Subscription active until</td><td style="padding: 8px;">${subscriptionEnd}</td></tr>
        </table>

        <p>You can now continue using your OjaHub dashboard.</p>
        <p>Thank you for choosing OjaHub!</p>
        <p>The OjaHub Team</p>
      </div>
    `,
  );
};

export const sendPaymentFailedEmail = async (
  email: string,
  details: PaymentEmailDetails,
): Promise<void> => {
  const name = escapeHtml(details.name);
  const plan = escapeHtml(details.planLabel);
  const reference = escapeHtml(details.reference);
  const amount = formatAmount(details.amountKobo);

  await sendEmail(
    email,
    "Payment Unsuccessful - OjaHub",
    `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; margin: auto;">
        <h2 style="color: #c62828;">Payment Unsuccessful</h2>
        <p>Hello ${name},</p>
        <p>Unfortunately, your payment for the OjaHub subscription could not be completed.</p>

        <h3>Transaction Details</h3>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px;">Plan</td><td style="padding: 8px;"><strong>${plan}</strong></td></tr>
          <tr><td style="padding: 8px;">Amount</td><td style="padding: 8px;">${amount}</td></tr>
          <tr><td style="padding: 8px;">Reference</td><td style="padding: 8px;">${reference}</td></tr>
          <tr><td style="padding: 8px;">Status</td><td style="padding: 8px;"><strong>Failed</strong></td></tr>
        </table>

        <p>Your subscription has not been activated by this transaction.</p>
        <p>You can return to OjaHub and try making the payment again.</p>
        <p>If you believe you were charged despite this message, please contact our support team.</p>
        <p>The OjaHub Team</p>
      </div>
    `,
  );
};
