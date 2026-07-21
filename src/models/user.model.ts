import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  role: "citizen" | "admin";
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["citizen", "admin"], default: "citizen" },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<IUser>("User", userSchema);