import mongoose, { Document, Schema } from "mongoose";
export interface IRefreshToken extends Document {
  user: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  sessionDurationDays: 7 | 30;
  createdAt: Date;
}
const RefreshTokenSchema: Schema<IRefreshToken> = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
    sessionDurationDays: {
      type: Number,
      enum: [7, 30],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);
const RefreshTokenModel = mongoose.model<IRefreshToken>(
  "RefreshToken",
  RefreshTokenSchema,
);

export default RefreshTokenModel;
