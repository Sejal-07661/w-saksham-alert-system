import { Router, Response } from "express";
import { requireAuth, requireRole, AuthenticatedRequest } from "../../core/authMiddleware";
import { listAlertsQuerySchema, updateAlertStatusSchema } from "../../schemas/admin.schema";
import { AlertModel } from "../../models/alert.model";

const router = Router();

// Every route below requires a valid token AND role === "admin".
router.use(requireAuth, requireRole("admin"));

router.get("/alerts", async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = listAlertsQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Validation failed", details: parseResult.error.flatten() });
  }
  const { severity, category, status, search, limit } = parseResult.data;

  const filter: Record<string, unknown> = {};
  if (severity) filter.severity = severity;
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { reportedBy: { $regex: search, $options: "i" } },
    ];
  }

  const alerts = await AlertModel.find(filter).sort({ createdAt: -1 }).limit(limit);
  return res.json({ count: alerts.length, alerts });
});

router.get("/stats", async (_req: AuthenticatedRequest, res: Response) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [total, critical, last24h, byStatus] = await Promise.all([
    AlertModel.countDocuments({}),
    AlertModel.countDocuments({ severity: "critical" }),
    AlertModel.countDocuments({ createdAt: { $gte: since24h } }),
    AlertModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) statusCounts[row._id] = row.count;

  return res.json({ total, critical, last24h, statusCounts });
});

router.patch("/alerts/:alertId/status", async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = updateAlertStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Validation failed", details: parseResult.error.flatten() });
  }

  const alert = await AlertModel.findOneAndUpdate(
    { alertId: req.params.alertId },
    { $set: { status: parseResult.data.status } },
    { new: true }
  );
  if (!alert) return res.status(404).json({ error: "Alert not found" });

  return res.json({ alert });
});

export default router;