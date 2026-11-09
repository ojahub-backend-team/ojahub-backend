import MongoStore from "connect-mongo";
import session from "express-session";
import { env } from "./keys.js";
import mongoose from "mongoose";

// session max age
const SESSION_MAX_AGE = env.SESSION_MAX_AGE
  ? parseInt(env.SESSION_MAX_AGE)
  : 24 * 60 * 60 * 1000; //24hrs

//create mongoDb session store
const createSessionStore = () => {
  return MongoStore.create({
    mongoUrl: env.MONGO_URI,
    dbName: env.DB_NAME,
    collectionName: "sessions",
    touchAfter: 24 * 3600, // only update once per day
    autoRemove: "native", //use MOngoDb TTL for session cleanup
    stringify: false, //store sessions as objects for better performance
    client: mongoose.connection.getClient(),
  });
};

// session middleware config
export const createSessionMiddleware = () => {
  return session({
    secret: env.SESSION_SECRET,
    name: "_ojahub", //custom prefix cookie name
    resave: false, //dont save if session is unmodified
    saveUninitialized: false, //dont create session until something is stored
    proxy: true,
    store: createSessionStore(), //store where session is saved
    cookie: {
      maxAge: SESSION_MAX_AGE, //how long cookie will live
      httpOnly: true, //prevent xss attacks
      secure: env.NODE_ENV === "production", //'HTTPS only in production'
      sameSite: "lax",
    },
    rolling: true, //keep session active so long as user is currently on site
  });
};

export default createSessionMiddleware;
