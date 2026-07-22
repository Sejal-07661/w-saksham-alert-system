import { Router, Request, Response } from "express";
import { geocodeSchema, reverseGeocodeSchema } from "../../schemas/geocode.schema";
import { geocodeAddress, reverseGeocode } from "../../services/geocoding.service";

const router = Router();

router.post("/geocode", async (req: Request, res: Response) => {
  const parseResult = geocodeSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    });
  }

  const result = await geocodeAddress(parseResult.data.address);

  if (!result) {
    return res.status(404).json({ error: "Address not found" });
  }

  return res.json(result);
});

router.get("/reverse", async (req: Request, res: Response) => {
  const parseResult = reverseGeocodeSchema.safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    });
  }

  const { latitude, longitude } = parseResult.data;
  const address = await reverseGeocode(latitude, longitude);

  if (!address) {
    return res.status(404).json({ error: "Location not found" });
  }

  return res.json({ address });
});

export default router;