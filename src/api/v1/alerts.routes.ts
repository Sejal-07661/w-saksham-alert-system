import { Router, Request, Response } from "express";
import { createAlertSchema } from "../../schemas/alert.schema";
import { publishEvent } from "../../services/rabbitmq.service";
import { redisClient } from "../../services/redis.service";
import { randomUUID } from "crypto";
import { nearbyAlertsSchema } from "../../schemas/geo.schema";
import { AlertModel } from "../../models/alert.model";
import { requireAuth, AuthenticatedRequest } from "../../core/authMiddleware";

const router = Router();

router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = createAlertSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    });
  }

  const input = parseResult.data;
  const alertId = randomUUID();

  // Idempotency check — prevents duplicate submissions (e.g. client retry/double-tap)
  const idempotencyKey = `alert:idempotency:${alertId}`;
  const alreadyProcessed = await redisClient.set(idempotencyKey, "1", "EX", 60, "NX");

  if (!alreadyProcessed) {
    return res.status(409).json({ error: "Duplicate alert submission" });
  }

  const eventPayload = {
    alertId,
    title: input.title,
    description: input.description,
    category: input.category,
    severity: input.severity,
    location: {
      type: "Point",
      coordinates: [input.longitude, input.latitude],
    },
    reportedBy: req.user!.username,
    createdAt: new Date().toISOString(),
  };

  // Publish immediately — persistence happens asynchronously via consumer
  await publishEvent("alert.created", eventPayload);

  return res.status(202).json({
    message: "Alert accepted for processing",
    alertId,
  });
});

router.get("/nearby", async (req: Request, res: Response) => {
  const parseResult = nearbyAlertsSchema.safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    });
  }

  const { longitude, latitude, radiusKm } = parseResult.data;
  const radiusInMeters = radiusKm * 1000;

  const alerts = await AlertModel.find({
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        $maxDistance: radiusInMeters,
      },
    },
  }).limit(50);

  return res.json({
    count: alerts.length,
    radiusKm,
    alerts,
  });
});

export default router;