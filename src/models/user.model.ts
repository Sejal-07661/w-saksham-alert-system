import mongoose, { Schema, Document } from "mongoose";
 
export interface ITrustedContact {
  name: string;
  email: string;
}
 
export interface IUser extends Document {
  username: string;
  passwordHash: string;
  role: "citizen" | "admin";
  trustedContacts: ITrustedContact[];
  createdAt: Date;
}
 
const trustedContactSchema = new Schema<ITrustedContact>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false }
);
 
const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["citizen", "admin"], default: "citizen" },
    trustedContacts: { type: [trustedContactSchema], default: [] },
  },
  { timestamps: true }
);
 
export const UserModel = mongoose.model<IUser>("User", userSchema);