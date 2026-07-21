import { z } from "zod";

export const createAlertSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(2000),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});

export type CreateAlertInput = z.infer<typeof createAlertSchema>;