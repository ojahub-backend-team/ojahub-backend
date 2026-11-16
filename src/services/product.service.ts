import ProductModel, { type ProductUnit } from "../models/product.model.js";
import LocationModel from "../models/location.model.js";
import StockLevelModel from "../models/stockLevel.model.js";
import StockMovementModel from "../models/stockMovement.model.js";
import UserModel from "../models/user.model.js";

type Step3Data = {
  name: string;
  unit: ProductUnit;
  priceKobo: number;
  quantity: number;
};

type Failure = { success: false; status: number; message: string };

type Step3Result =
  | {
      success: true;
      message: string;
      product: {
        _id: string;
        name: string;
        unit: ProductUnit;
        priceKobo: number;
      };
      stock: { locationId: string; quantity: number };
      onboardingStep: number;
    }
  | Failure;

type SkipResult =
  | { success: true; message: string; onboardingStep: number }
  | Failure;

export const saveFirstProductService = async (
  userId: string,
  data: Step3Data,
): Promise<Step3Result> => {
  const user = await UserModel.findById(userId);

  if (!user) {
    return { success: false, status: 404, message: "User not found" };
  }
  if (!user.businessId) {
    return {
      success: false,
      status: 403,
      message: "Save your business details first",
    };
  }
  if (user.onboardingStep < 2) {
    return {
      success: false,
      status: 403,
      message: "Save your first location first",
    };
  }
  if (user.onboardingStep >= 4) {
    return {
      success: false,
      status: 409,
      message:
        "Setup is already complete. Manage products from the procucts screen",
    };
  }

  const location = await LocationModel.findOne({
    businessId: user.businessId,
    isDefault: true,
  });

  if (!location) {
    return {
      success: false,
      status: 403,
      message: "Save your first location first",
    };
  }

  //Repeatable: one onboarding product per business, updated on every save
  const product = await ProductModel.findOneAndUpdate(
    { businessId: user.businessId, source: "onbrarding" },
    {
      $set: {
        name: data.name,
        unit: data.unit,
        isActive: true,
        priceTiers: [
          { tierName: "retail", minimumQuantity: 1, unitPrice: data.priceKobo },
        ],
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );

  await StockLevelModel.findOneAndUpdate(
    { productId: product._id, locationId: location._id },
    {
      $set: { quantity: data.quantity },
      $setOnInsert: { businessId: user.businessId },
    },
    { upsert: true, new: true, runValidators: true },
  );

  await StockMovementModel.findOneAndUpdate(
    { productId: product._id, locationId: location._id, type: "opening" },
    {
      $set: {
        businessId: user.businessId,
        quantityChange: data.quantity,
        balanceAfter: data.quantity,
        createdBy: user._id,
      },
    },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  // Only ever raises the step, never lowers it
  await UserModel.updateOne({ _id: user._id }, { $max: { onboardingStep: 3 } });

  return {
    success: true,
    message: "Product saved",
    product: {
      _id: product._id.toString(),
      name: product.name,
      unit: product.unit,
      priceKobo: product.priceTiers[0].unitPrice,
    },
    stock: {
      locationId: location._id.toString(),
      quantity: data.quantity,
    },
    onboardingStep: Math.max(user.onboardingStep, 3),
  };
};

export const skipFirstProductService = async (
  userId: string,
): Promise<SkipResult> => {
  const user = await UserModel.findById(userId);

  if (!user) {
    return { success: false, status: 404, message: "User not found" };
  }
  if (!user.businessId) {
    return { success: false, status: 403, message: "Save your business first" };
  }
  if (user.onboardingStep < 2) {
    return {
      success: false,
      status: 403,
      message: "Save your first location",
    };
  }

  await UserModel.updateOne({ _id: user._id }, { $max: { onboardingStep: 3 } });

  return {
    success: true,
    message: "Product step skipped",
    onboardingStep: Math.max(user.onboardingStep, 3),
  };
};
