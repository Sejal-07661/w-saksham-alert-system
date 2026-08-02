import { getChannel, EXCHANGE_NAME, assertQueueWithDLQ } from "../services/rabbitmq.service";
import { UserModel } from "../models/user.model";
import { sendEscalationEmail } from "../services/email.service";
 
const QUEUE_NAME = "notification_queue";
const ROUTING_KEY = "alert.escalated";
 
export async function startNotificationWorker(): Promise<void> {
  const channel = getChannel();
 
  await assertQueueWithDLQ(QUEUE_NAME);
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);
 
  channel.prefetch(1);
 
  console.log(`Notification worker listening on queue: ${QUEUE_NAME}`);
 
  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;
 
    try {
      const payload = JSON.parse(msg.content.toString());
 
      const user = await UserModel.findOne({ username: payload.reportedBy });
 
      if (!user || user.trustedContacts.length === 0) {
        console.log(
          `No trusted contacts for ${payload.reportedBy} — skipping notification for alert ${payload.alertId}`
        );
        channel.ack(msg);
        return;
      }
 
      const [longitude, latitude] = payload.location.coordinates;
 
      await Promise.all(
        user.trustedContacts.map((contact) =>
          sendEscalationEmail({
            toEmail: contact.email,
            toName: contact.name,
            reporterUsername: payload.reportedBy,
            urgencyLabel: payload.urgencyLabel,
            riskScore: payload.riskScore,
            latitude,
            longitude,
          })
        )
      );
 
      console.log(
        `Notified ${user.trustedContacts.length} trusted contact(s) for alert ${payload.alertId}`
      );
      channel.ack(msg);
    } catch (err) {
      console.error("Failed to send notification. Routing to dead-letter queue:", err);
      channel.nack(msg, false, false);
    }
  });
}