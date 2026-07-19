import mongoose, { Schema, Document } from "mongoose";

export type AlertStatus = "pending" | "processing" | "escalated" | "resolved";
export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface IAlert extends Document {
  title: string;
  description: string;
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
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
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