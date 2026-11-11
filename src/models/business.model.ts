import mongoose, { Document, Schema } from "mongoose";
export interface IBusiness extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;

  category?:
    | "Fabrics"
    | "Electronics"
    | "Phones"
    | "Provision"
    | "Cosmetics"
    | "Building Materials"
    | "Others";

  businessLocation?: string;

  storageType?: "Stall or Shop" | "Warehouse";

  storageLocationName?: string;

  storageAddress?: string;

  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema: Schema<IBusiness> = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: [
        "Fabrics",
        "Electronics",
        "Phones",
        "Provision",
        "Cosmetics",
        "Building Materials",
        "Others",
      ],
    },

    businessLocation: {
      type: String,
      trim: true,
    },

    storageType: {
      type: String,
      enum: ["Stall or Shop", "Warehouse"],
    },

    storageLocationName: {
      type: String,
      trim: true,
    },

    storageAddress: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

const BusinessModel =
  mongoose.models.Business ||
  mongoose.model<IBusiness>("Business", BusinessSchema);

export default BusinessModel;
