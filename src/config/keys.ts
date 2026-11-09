import { config } from "dotenv";

//load up env keys oonly in dev enviornment
if (process.env.NODE_ENV !== "production") {
  config();
}

interface EnvSpec {
  key: string;
  required?: boolean;
}

const ENV_VARS: EnvSpec[] = [
  {
    key: "MONGO_URI",
    required: true,
  },
  {
    key: "NODE_ENV",
    required: true,
  },
  {
    key: "DB_NAME",
    required: true,
  },
  {
    key: "SESSION_MAX_AGE,",
    required: false,
  },
  {
    key: "SESSION_SECRET",
    required: true,
  },
];

interface Env {
  readonly [key: string]: string;
}

const env: Env = process.env as Env;

//check required keys on start up
const requiredKeys = ENV_VARS.filter((item) => item.required);
//find missing keys from required keys
const missingKeys = requiredKeys.filter((item) => !env[item.key]);

if (missingKeys.length > 0) {
  throw new Error(
    `Missing required env key: ${missingKeys.map((k) => k.key).join(" , ")}`,
  );
}

export { env };
