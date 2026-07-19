import { getChannel, EXCHANGE_NAME } from "../services/rabbitmq.service";
import { AlertModel } from "../models/alert.model";

const QUEUE_NAME = "persistence_queue";
const ROUTING_KEY = "alert.created";

export async function startPersistenceWorker(): Promise<void> {
  const channel = getChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

  channel.prefetch(1); // process one message at a time per worker instance

  console.log(`Persistence worker listening on queue: ${QUEUE_NAME}`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());

      await AlertModel.create({
        title: payload.title,
        description: payload.description,
        severity: payload.severity,
        location: payload.location,
        reportedBy: payload.reportedBy,
        status: "pending",
      });

      console.log(`Persisted alert ${payload.alertId} to MongoDB`);
      channel.ack(msg);
    } catch (err) {
      console.error("Failed to persist alert:", err);
      // requeue = false sends it to a dead-letter queue if configured later;
      // for now, false means don't retry infinitely on bad data
      channel.nack(msg, false, false);
    }
  });
}