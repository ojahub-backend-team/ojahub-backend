import LocationModel, { type LocationType } from "../models/location.model.js";
import UserModel from "../models/user.model.js";

type Step2Data = {
  name: string;
  type: LocationType;
  address: string;
};

type Step2Result =
  | {
      success: true;
      message: string;
      location: {
        _id: string;
        name: string;
        type: LocationType;
        address: string;
        isDefault: boolean;
      };
      onboardingStep: number;
    }
  | { success: false; status: number; message: string };

export const saveFirstLocationService = async (
  userId: string,
  data: Step2Data,
): Promise<Step2Result> => {
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

  //Repeatable: update the default location if it exists, create it if not
  const location = await LocationModel.findOneAndUpdate(
    { businessId: user.businessId, isDefault: true },
    {
      $set: {
        name: data.name,
        type: data.type,
        address: data.address,
        isActive: true,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  // Only ever raises the step, never lowers it
  await UserModel.updateOne({ _id: user._id }, { $max: { onboardingStep: 2 } });

  return {
    success: true,
    message: "Location saved",
    location: {
      _id: location._id.toString(),
      name: location.name,
      type: location.type,
      address: location.address,
      isDefault: location.isDefault,
    },
    onboardingStep: Math.max(user.onboardingStep, 2),
  };
};
