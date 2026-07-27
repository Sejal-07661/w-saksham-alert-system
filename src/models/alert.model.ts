import mongoose, { Schema, Document } from "mongoose";
 
export type AlertStatus = "pending" | "processing" | "escalated" | "resolved";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertCategory = "sos" | "harassment" | "stalking" | "unsafe_area" | "medical" | "other";
 
export interface IAlert extends Document {
  title: string;
  description: string;
  category: AlertCategory;
  severity: AlertSeverity;
  status: AlertStatus;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  reportedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
 
const alertSchema = new Schema<IAlert>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["sos", "harassment", "stalking", "unsafe_area", "medical", "other"],
      default: "sos",
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "high",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "escalated", "resolved"],
      default: "pending",
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    reportedBy: { type: String, required: true },
  },
  { timestamps: true }
);
 
alertSchema.index({ location: "2dsphere" });
 
export const AlertModel = mongoose.model<IAlert>("Alert", alertSchema);