import { z } from "zod";

export const geocodeSchema = z.object({
  address: z.string().min(3),
});

export const reverseGeocodeSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});