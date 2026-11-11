import nodemailer from "nodemailer";
import { env } from "../config/keys.js";

let transporter = nodemailer.createTransport({
  host: env.BREVO_SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: env.BREVO_SMTP_USER,
    pass: env.BREVO_SMTP_KEY,
  },
});
export const sendVerificationEmail = async (
  email: string,
  otp: string,
): Promise<void> => {
  let mailOptions = {
    from: env.BREVO_SENDER_EMAIL,
    to: email,
    subject: "Verify Your OjaHub Account",
    html: `
      <div>
        <h2>Welcome to OjaHub!</h2>
        <p>Thank you for creating an account.</p>
        <p>Use the verification code below to verify your email address:</p>
        <h1>${otp}</h1>
        <p>This code expires in 60 seconds.</p>
        <p>If you did not create this account, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
export const sendPasswordResetEmail = async (
  email: string,
  otp: string,
): Promise<void> => {
  let mailOptions = {
    from: env.BREVO_SENDER_EMAIL,
    to: email,
    subject: "Reset Your OjaHub Password",
    html: `
      <div>
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your OjaHub password.</p>
        <p>Use the code below to reset your password:</p>
        <h1>${otp}</h1>
        <p>This code expires in 60 seconds.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
