import mongoose, { Schema, Document } from "mongoose";

export type JourneyStatus = "active" | "deviated" | "unresponsive" | "completed" | "cancelled";

interface IPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface IJourney extends Document {
  journeyId: string;
  username: string;
  label?: string;
  startLocation: IPoint;
  endLocation: IPoint;
  currentLocation: IPoint;
  deviationThresholdMeters: number;
  status: JourneyStatus;
  alertTriggered: boolean;
  lastLocationAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const journeySchema = new Schema<IJourney>(
  {
    journeyId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, index: true },
    label: { type: String },
    startLocation: { type: pointSchema, required: true },
    endLocation: { type: pointSchema, required: true },
    currentLocation: { type: pointSchema, required: true },
    deviationThresholdMeters: { type: Number, default: 500 },
    status: {
      type: String,
      enum: ["active", "deviated", "unresponsive", "completed", "cancelled"],
      default: "active",
    },
    alertTriggered: { type: Boolean, default: false },
    lastLocationAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

journeySchema.index({ currentLocation: "2dsphere" });
journeySchema.index({ username: 1, status: 1 });

export const JourneyModel = mongoose.model<IJourney>("Journey", journeySchema);