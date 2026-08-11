import { Router, Response } from "express";
import { randomUUID } from "crypto";
import { requireAuth, AuthenticatedRequest } from "../../core/authMiddleware";
import { rateLimit, authenticatedUserKeyFn } from "../../core/rateLimiter";
import { startJourneySchema, updateJourneyLocationSchema } from "../../schemas/journey.schema";
import { JourneyModel } from "../../models/journey.model";
import { updateJourneyLocation, DEFAULT_DEVIATION_THRESHOLD_METERS } from "../../services/journey.service";

const router = Router();

router.use(requireAuth);

const locationPingLimiter = rateLimit({
  windowSeconds: 60,
  maxRequests: 30,
  keyPrefix: "journey-location",
  keyFn: authenticatedUserKeyFn,
});

router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = startJourneySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Validation failed", details: parseResult.error.flatten() });
  }
  const input = parseResult.data;

  const existing = await JourneyModel.findOne({
    username: req.user!.username,
    status: { $in: ["active", "deviated"] },
  });
  if (existing) {
    return res.status(409).json({ error: "You already have an active journey", journeyId: existing.journeyId });
  }

  const journey = await JourneyModel.create({
    journeyId: randomUUID(),
    username: req.user!.username,
    label: input.label,
    startLocation: { type: "Point", coordinates: [input.startLongitude, input.startLatitude] },
    endLocation: { type: "Point", coordinates: [input.endLongitude, input.endLatitude] },
    currentLocation: { type: "Point", coordinates: [input.startLongitude, input.startLatitude] },
    deviationThresholdMeters: input.deviationThresholdMeters || DEFAULT_DEVIATION_THRESHOLD_METERS,
  });

  return res.status(201).json({ journey });
});

router.patch("/:journeyId/location", locationPingLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = updateJourneyLocationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Validation failed", details: parseResult.error.flatten() });
  }

  const journey = await JourneyModel.findOne({
    journeyId: req.params.journeyId,
    username: req.user!.username,
  });
  if (!journey) return res.status(404).json({ error: "Journey not found" });
  if (journey.status === "completed" || journey.status === "cancelled") {
    return res.status(400).json({ error: `Journey is already ${journey.status}` });
  }

  const { latitude, longitude } = parseResult.data;
  const result = await updateJourneyLocation(journey, latitude, longitude);

  return res.json({
    journeyId: journey.journeyId,
    status: journey.status,
    deviated: result.deviated,
    distanceFromRouteMeters: Math.round(result.distanceMeters),
  });
});

router.get("/active", async (req: AuthenticatedRequest, res: Response) => {
  const journey = await JourneyModel.findOne({
    username: req.user!.username,
    status: { $in: ["active", "deviated", "unresponsive"] },
  }).sort({ createdAt: -1 });

  return res.json({ journey: journey || null });
});

router.post("/:journeyId/complete", async (req: AuthenticatedRequest, res: Response) => {
  const journey = await JourneyModel.findOne({ journeyId: req.params.journeyId, username: req.user!.username });
  if (!journey) return res.status(404).json({ error: "Journey not found" });
  journey.status = "completed";
  await journey.save();
  return res.json({ journey });
});

router.post("/:journeyId/cancel", async (req: AuthenticatedRequest, res: Response) => {
  const journey = await JourneyModel.findOne({ journeyId: req.params.journeyId, username: req.user!.username });
  if (!journey) return res.status(404).json({ error: "Journey not found" });
  journey.status = "cancelled";
  await journey.save();
  return res.json({ journey });
});

export default router;