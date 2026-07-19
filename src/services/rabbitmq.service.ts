import amqp, { Channel, ChannelModel } from "amqplib";
import { config } from "../core/config";

let connection: ChannelModel;
let channel: Channel;

export const EXCHANGE_NAME = "alerts_exchange";

export async function connectRabbitMQ(): Promise<void> {
  connection = await amqp.connect(config.rabbitmqUrl);
  channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

  console.log("RabbitMQ connected and exchange asserted:", EXCHANGE_NAME);
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