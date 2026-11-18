import BusinessModel from "../models/business.model.js";
import LocationModel from "../models/location.model.js";
import ProductModel from "../models/product.model.js";
import StockLevelModel from "../models/stockLevel.model.js";
import UserModel from "../models/user.model.js";

type OnboardingState = {
  onboardingStep: number;
  business: {
    _id: string;
    name: string;
    category?: string;
    businessLocation?: string;
  } | null;
  location: {
    _id: string;
    name: string;
    type: string;
    address: string;
  } | null;
  product: {
    _id: string;
    name: string;
    unit: string;
    priceKobo: number | null;
    quantity: number | null;
  } | null;
};

type StateResult =
  | { success: true; state: OnboardingState }
  | { success: false; status: number; message: string };

export const getOnboardingStateService = async (
  userId: string,
): Promise<StateResult> => {
  const user = await UserModel.findById(userId).select(
    "businessId onboardingStep",
  );

  if (!user) {
    return { success: false, status: 404, message: "User not found" };
  }

  // Step 0: nothing saved yet. This is a normal answer, not an error.
  if (!user.businessId) {
    return {
      success: true,
      state: {
        onboardingStep: user.onboardingStep,
        business: null,
        location: null,
        product: null,
      },
    };
  }

  // Every lookup is filtered by the business ID stored on the user, never by the request
  const [business, location, product] = await Promise.all([
    BusinessModel.findById(user.businessId),
    LocationModel.findOne({ businessId: user.businessId, isDefault: true }),
    ProductModel.findOne({ businessId: user.businessId, source: "onboarding" }),
  ]);

  const stock =
    product && location
      ? await StockLevelModel.findOne({
          productId: product._id,
          locationId: location._id,
        })
      : null;

  return {
    success: true,
    state: {
      onboardingStep: user.onboardingStep,
      business: business
        ? {
            _id: business._id.toString(),
            name: business.name,
            category: business.category,
            businessLocation: business.businessLocation,
          }
        : null,
      location: location
        ? {
            _id: location._id.toString(),
            name: location.name,
            type: location.type,
            address: location.address,
          }
        : null,
      product: product
        ? {
            _id: product._id.toString(),
            name: product.name,
            unit: product.unit,
            priceKobo: product.priceTiers?.[0]?.unitPrice ?? null,
            quantity: stock ? stock.quantity : null,
          }
        : null,
    },
  };
};
