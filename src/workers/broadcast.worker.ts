import { getChannel, EXCHANGE_NAME, assertQueueWithDLQ } from "../services/rabbitmq.service";
import { broadcastAlert } from "../ws/socketServer";

const QUEUE_NAME = "broadcast_queue";
const ROUTING_KEY = "alert.created";

export async function startBroadcastWorker(): Promise<void> {
  const channel = getChannel();

  await assertQueueWithDLQ(QUEUE_NAME);
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

  channel.prefetch(1);

  console.log(`Broadcast worker listening on queue: ${QUEUE_NAME}`);

  channel.consume(QUEUE_NAME, (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      broadcastAlert(payload);
      console.log(`Broadcasted alert ${payload.alertId} to WebSocket clients`);
      channel.ack(msg);
    } catch (err) {
      console.error("Failed to broadcast alert. Routing to dead-letter queue:", err);
      channel.nack(msg, false, false);
    }
  });
}