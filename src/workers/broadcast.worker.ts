import { getChannel, EXCHANGE_NAME } from "../services/rabbitmq.service";
import { broadcastAlert } from "../ws/socketServer";
 
const ROUTING_KEY = "alert.created";
 
export async function startBroadcastWorker(): Promise<void> {
  const channel = getChannel();
 
  // Exclusive, auto-named, non-durable queue: each running app instance gets
  // its OWN queue bound to the exchange. This means every instance receives
  // every event (fan-out), instead of competing for messages from one shared
  // queue. A shared queue would mean only one instance's WebSocket clients
  // ever get the live update — the rest would silently miss it.
  const { queue } = await channel.assertQueue("", {
    exclusive: true,
    durable: false,
    autoDelete: true,
  });
 
  await channel.bindQueue(queue, EXCHANGE_NAME, ROUTING_KEY);
 
  console.log(`Broadcast worker listening on exclusive queue: ${queue}`);
 
  channel.consume(queue, (msg) => {
    if (!msg) return;
 
    try {
      const payload = JSON.parse(msg.content.toString());
      broadcastAlert(payload);
      console.log(`Broadcasted alert ${payload.alertId} to local WebSocket clients`);
      channel.ack(msg);
    } catch (err) {
      console.error("Failed to broadcast alert:", err);
      channel.nack(msg, false, false);
    }
  });
}