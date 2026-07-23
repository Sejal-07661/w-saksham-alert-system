import amqp, { Channel, ChannelModel } from "amqplib";
import { config } from "../core/config";

let connection: ChannelModel;
let channel: Channel;

export const EXCHANGE_NAME = "alerts_exchange";
export const DLX_NAME = "alerts_dlx";
export const DLQ_NAME = "alerts_dead_letter_queue";

export async function connectRabbitMQ(retries = 5, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      connection = await amqp.connect(config.rabbitmqUrl);
      channel = await connection.createChannel();

      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

      // Dead-letter exchange + queue — catches anything nacked without requeue
      await channel.assertExchange(DLX_NAME, "fanout", { durable: true });
      await channel.assertQueue(DLQ_NAME, { durable: true });
      await channel.bindQueue(DLQ_NAME, DLX_NAME, "");

      console.log("RabbitMQ connected and exchange asserted:", EXCHANGE_NAME);
      console.log("Dead-letter exchange ready:", DLX_NAME);
      return;
    } catch (err) {
      console.warn(`RabbitMQ connection attempt ${attempt}/${retries} failed. Retrying in ${delayMs}ms...`);
      if (attempt === retries) {
        console.error("RabbitMQ connection failed after all retries:", err);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export function getChannel(): Channel {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized. Call connectRabbitMQ first.");
  }
  return channel;
}

export async function publishEvent(routingKey: string, payload: object): Promise<void> {
  const ch = getChannel();
  const buffer = Buffer.from(JSON.stringify(payload));
  ch.publish(EXCHANGE_NAME, routingKey, buffer, { persistent: true });
  console.log(`Published event [${routingKey}]:`, payload);
}

// Helper: assert a queue that's wired to the dead-letter exchange on failure
export async function assertQueueWithDLQ(queueName: string): Promise<void> {
  const ch = getChannel();
  await ch.assertQueue(queueName, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": DLX_NAME,
    },
  });
}