import { z } from "zod";

export const startJourneySchema = z.object({
  label: z.string().max(200).optional(),
  startLatitude: z.number().min(-90).max(90),
  startLongitude: z.number().min(-180).max(180),
  endLatitude: z.number().min(-90).max(90),
  endLongitude: z.number().min(-180).max(180),
  deviationThresholdMeters: z.number().min(50).max(5000).optional(),
});

export const updateJourneyLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type StartJourneyInput = z.infer<typeof startJourneySchema>;
export type UpdateJourneyLocationInput = z.infer<typeof updateJourneyLocationSchema>;