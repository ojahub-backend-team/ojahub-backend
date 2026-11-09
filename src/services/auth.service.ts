import bcrypt from "bcrypt";
import { env } from "../config/keys.js";
import userModel from "../models/user.model.js";

type formDataType = {
  email: string;
  password: string;
  name: string;
  phone: string;
};

type userProfile = {
  name: string;
  email: string;
  phone: string;
};

type ServiceError = { success: false; status: number; message: string };

type RegisterUserResult =
  | { success: true; user: userProfile; message: string }
  | ServiceError;

export const registerUserService = async (
  formData: formDataType,
): Promise<RegisterUserResult> => {
  const { email, password, name, phone } = formData;
  const existingUser = await userModel.findOne({ email }).lean();
  if (existingUser) {
    return {
      success: false,
      status: 409,
      message: "User already exists",
    };
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const newUser = await userModel.create({
    email,
    name,
    password: hashedPassword,
  });
  return {
    success: true,
    user: newUser,
    message: "User registered successfully",
  };
};
