import mongoose, { Document, Schema } from "mongoose";

export const LOCATION_TYPES = ["shop", "warehouse"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export interface ILocation extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  name: string;
  type: LocationType;
  address: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema: Schema<ILocation> = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: [...LOCATION_TYPES], required: true },
    address: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

LocationSchema.index(
  { businessId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);

LocationSchema.index(
  { businessId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

const LocationModel =
  mongoose.models.Location ||
  mongoose.model<ILocation>("Location", LocationSchema);

export default LocationModel;
