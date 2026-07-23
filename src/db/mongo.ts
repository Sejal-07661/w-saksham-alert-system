import mongoose from "mongoose";
import { config } from "../core/config";

export async function connectMongo(): Promise<void> {
  try {
    mongoose.set("bufferCommands", false);
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000, // fail fast after 5s instead of default 30s
    });
    console.log("MongoDB connected:", config.mongoUri);
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }
}