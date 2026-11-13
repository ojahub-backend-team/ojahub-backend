import BusinessModel from "../models/business.model.js";
import UserModel from "../models/user.model.js";

export const BUSINESS_CATEGORIES = [
  "Fabrics",
  "Electronics",
  "Phones",
  "Provision",
  "Cosmetics",
  "Building Materials",
  "Others",
] as const;

type Step1Data = {
  name: string;
  category: (typeof BUSINESS_CATEGORIES)[number];
  businessLocation: string;
};

type Step1Result =
  | {
      success: true;
      message: string;
      business: {
        _id: string;
        name: string;
        category?: string;
        businessLocation?: string;
      };
      onboardingStep: number;
    }
  | { success: false; status: number; message: string };

export const saveBusinessStep1Service = async (
  userId: string,
  data: Step1Data,
): Promise<Step1Result> => {
  const user = await UserModel.findById(userId);

  if (!user) {
    return { success: false, status: 404, message: "User not found" };
  }

  //Repeatable: update the existing business instead of creating a second one
  let business = user.businessId
    ? await BusinessModel.findById(user.businessId)
    : await BusinessModel.findOne({ owner: user._id });

  let created = false;

  if (business) {
    business.name = data.name;
    business.category = data.category;
    business.businessLocation = data.businessLocation;
    if (!business.owner) business.owner = user._id;
    await business.save();
  } else {
    business = await BusinessModel.create({ ...data, owner: user._id });
    created = true;
  }

  try {
    user.businessId = business._id;
    if (user.onboardingStep < 1) user.onboardingStep = 1;
    await user.save();
  } catch (error) {
    // Keep it atomic; if the user could not be updated, remove the business we just made
    if (created) await BusinessModel.deleteOne({ _id: business._id });
    throw error;
  }

  return {
    success: true,
    message: "Business details saved",
    business: {
      _id: business.id.toString(),
      name: business.name,
      category: business.category,
      businessLocation: business.businessLocation,
    },
    onboardingStep: user.onboardingStep,
  };
};
