import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  googleId?: string;
  phone?: string;
  password?: string;
  role: "user" | "admin";
  businessId: mongoose.Types.ObjectId;
  emailVerified: boolean;
  failedLoginAttempts: number;
  lockUntil?: Date;
  otp?: {
    code: string;
    expiresAt: Date;
    attempts: number;
    lastSentAt: Date;
    resendCount: number;
    resendWindowStartedAt: Date;
  };
  passwordResetOtp?: {
    code: string;
    expiresAt: Date;
    attempts: number;
    lastSentAt: Date;
    resendCount: number;
    resendWindowStartedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    password: {
      type: String,
      required: false,
      select: false,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
    },

    otp: {
      type: {
        code: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        attempts: { type: Number, default: 0 },
        lastSentAt: { type: Date, default: Date.now },
        resendCount: { type: Number, default: 0 },
        resendWindowStartedAt: { type: Date, default: Date.now },
      },
      required: false,
      _id: false,
    },
    passwordResetOtp: {
      type: {
        code: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        attempts: { type: Number, default: 0 },
        lastSentAt: { type: Date, default: Date.now },
        resendCount: { type: Number, default: 0 },
        resendWindowStartedAt: { type: Date, default: Date.now },
      },
      required: false,
      _id: false,
    },
  },
  {
    timestamps: true,
  },
);

const UserModel =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default UserModel;
