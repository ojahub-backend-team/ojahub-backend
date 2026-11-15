import mongoose, { Document, Schema } from "mongoose";
export interface IBusiness extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  owner?: mongoose.Types.ObjectId;

  category?:
    | "Fabrics"
    | "Electronics"
    | "Phones"
    | "Provision"
    | "Cosmetics"
    | "Building Materials"
    | "Others";

  businessLocation?: string;

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

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      sparse: true,
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
  },
  {
    timestamps: true,
  },
);

const BusinessModel =
  mongoose.models.Business ||
  mongoose.model<IBusiness>("Business", BusinessSchema);

export default BusinessModel;
