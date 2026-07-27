import { getChannel, EXCHANGE_NAME, assertQueueWithDLQ } from "../services/rabbitmq.service";
import { AlertModel } from "../models/alert.model";

const QUEUE_NAME = "persistence_queue";
const ROUTING_KEY = "alert.created";

export async function startPersistenceWorker(): Promise<void> {
  const channel = getChannel();

  await assertQueueWithDLQ(QUEUE_NAME);
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

  channel.prefetch(1);

  console.log(`Persistence worker listening on queue: ${QUEUE_NAME}`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());

      await AlertModel.create({
        title: payload.title,
        description: payload.description,
        category: payload.category,
        severity: payload.severity,
        location: payload.location,
        reportedBy: payload.reportedBy,
        status: "pending",
      });

      console.log(`Persisted alert ${payload.alertId} to MongoDB`);
      channel.ack(msg);
    } catch (err) {
      console.error("Failed to persist alert. Routing to dead-letter queue:", err);
      channel.nack(msg, false, false); // false, false = don't requeue → goes to DLX automatically
    }
  });
}