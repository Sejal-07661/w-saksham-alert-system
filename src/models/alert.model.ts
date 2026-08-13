import mongoose, { Schema, Document } from "mongoose";

export type AlertStatus = "pending" | "acknowledged" | "processing" | "escalated" | "resolved";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertCategory = "sos" | "harassment" | "stalking" | "unsafe_area" | "medical" | "route_deviation" | "other";
export type UrgencyLabel = "low" | "medium" | "high" | "critical";

export interface IAlert extends Document {
  alertId: string;
  title: string;
  description: string;
  category: AlertCategory;
  severity: AlertSeverity;
  status: AlertStatus;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  reportedBy: string;
  riskScore?: number;
  urgencyLabel?: UrgencyLabel;
  riskReasoning?: string;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["sos", "harassment", "stalking", "unsafe_area", "medical", "route_deviation", "other"],
      default: "sos",
},
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "high",
    },
    status: {
      type: String,
      enum: ["pending", "acknowledged", "processing", "escalated", "resolved"],
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
    riskScore: { type: Number, min: 0, max: 100 },
    urgencyLabel: { type: String, enum: ["low", "medium", "high", "critical"] },
    riskReasoning: { type: String },
  },
  { timestamps: true }
);

alertSchema.index({ location: "2dsphere" });

export const AlertModel = mongoose.model<IAlert>("Alert", alertSchema);