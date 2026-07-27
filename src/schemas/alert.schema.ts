import { z } from "zod";
 
export const createAlertSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(2000),
  category: z.enum(["sos", "harassment", "stalking", "unsafe_area", "medical", "other"]).default("sos"),
  severity: z.enum(["low", "medium", "high", "critical"]).default("high"),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});
 
export type CreateAlertInput = z.infer<typeof createAlertSchema>;