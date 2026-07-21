import { z } from "zod";

export const nearbyAlertsSchema = z.object({
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  radiusKm: z.coerce.number().min(0.1).max(100).default(5),
});

export type NearbyAlertsInput = z.infer<typeof nearbyAlertsSchema>;