import { z } from "zod";

export const listAlertsQuerySchema = z.object({
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  category: z.enum(["sos", "harassment", "stalking", "unsafe_area", "medical", "route_deviation", "other"]).optional(),
  status: z.enum(["pending", "acknowledged", "processing", "escalated", "resolved"]).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
});

export const updateAlertStatusSchema = z.object({
  status: z.enum(["pending", "acknowledged", "processing", "escalated", "resolved"]),
});

export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;