import { getChannel, EXCHANGE_NAME, assertQueueWithDLQ, publishEvent } from "../services/rabbitmq.service";
import { assessRisk } from "../services/riskAssessment.service";
import { AlertModel } from "../models/alert.model";
 
const QUEUE_NAME = "risk_assessment_queue";
const ROUTING_KEY = "alert.created";
const ESCALATION_THRESHOLD = 80;
 
// Count recent nearby alerts as a "hotspot" signal for the risk model.
// Uses $centerSphere (radians) rather than $near, since $near isn't
// supported inside countDocuments.
async function countNearbyRecentAlerts(coordinates: [number, number]): Promise<number> {
  const radiusKm = 2;
  const radiusRadians = radiusKm / 6378.1;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
 
  return AlertModel.countDocuments({
    location: {
      $geoWithin: {
        $centerSphere: [coordinates, radiusRadians],
      },
    },
    createdAt: { $gte: since },
  });
}
 
export async function startRiskAssessmentWorker(): Promise<void> {
  const channel = getChannel();
 
  await assertQueueWithDLQ(QUEUE_NAME);
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);
 
  channel.prefetch(1);
 
  console.log(`Risk assessment worker listening on queue: ${QUEUE_NAME}`);
 
  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;
 
    try {
      const payload = JSON.parse(msg.content.toString());
      const coordinates: [number, number] = payload.location.coordinates;
 
      const nearbyAlertCount = await countNearbyRecentAlerts(coordinates);
 
      const result = await assessRisk({
        title: payload.title,
        description: payload.description,
        category: payload.category,
        severity: payload.severity,
        nearbyAlertCount,
      });
 
      // Idempotent upsert keyed by alertId — works regardless of whether
      // the persistence worker has already created the document or not.
      await AlertModel.findOneAndUpdate(
        { alertId: payload.alertId },
        {
          $set: {
            riskScore: result.riskScore,
            urgencyLabel: result.urgencyLabel,
            riskReasoning: result.reasoning,
          },
          $setOnInsert: {
            alertId: payload.alertId,
            title: payload.title,
            description: payload.description,
            category: payload.category,
            severity: payload.severity,
            location: payload.location,
            reportedBy: payload.reportedBy,
            status: "pending",
          },
        },
        { upsert: true }
      );
 
      console.log(
        `Risk assessed for alert ${payload.alertId}: score=${result.riskScore} (${result.urgencyLabel}) — ${result.reasoning}`
      );
 
      if (result.riskScore >= ESCALATION_THRESHOLD) {
        await publishEvent("alert.escalated", {
          alertId: payload.alertId,
          riskScore: result.riskScore,
          urgencyLabel: result.urgencyLabel,
          reportedBy: payload.reportedBy,
          location: payload.location,
        });
        console.log(`Alert ${payload.alertId} escalated (score ${result.riskScore} >= ${ESCALATION_THRESHOLD})`);
      }
 
      channel.ack(msg);
    } catch (err) {
      console.error("Failed to assess risk for alert. Routing to dead-letter queue:", err);
      channel.nack(msg, false, false);
    }
  });
}