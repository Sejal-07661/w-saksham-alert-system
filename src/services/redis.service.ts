import Redis from "ioredis";
import { config } from "../core/config";

export const redisClient = new Redis({
  host: config.redisHost,
  port: config.redisPort,
  password: config.redisPassword || undefined,
});

redisClient.on("connect", () => {
  console.log("Redis connected:", `${config.redisHost}:${config.redisPort}`);
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err);
});