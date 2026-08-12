import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import { config } from "./core/config";
import { connectMongo } from "./db/mongo";
import { redisClient } from "./services/redis.service";
import { connectRabbitMQ, publishEvent } from "./services/rabbitmq.service";
import alertsRouter from "./api/v1/alerts.routes";
import { startPersistenceWorker } from "./workers/persistence.worker";
import { startBroadcastWorker } from "./workers/broadcast.worker";
import { initWebSocketServer } from "./ws/socketServer";
import authRouter from "./api/v1/auth.routes";
import geoRouter from "./api/v1/geo.routes";
import path from "path";
import { startRiskAssessmentWorker } from "./workers/riskAssessment.worker";
import contactsRouter from "./api/v1/contacts.routes";
import { startNotificationWorker } from "./workers/notification.worker";
import journeysRouter from "./api/v1/journeys.routes";
import { checkStaleJourneys } from "./services/journey.service";
 
const app = express();
 
// Trust the first proxy hop (Nginx) so req.ip reflects the real client IP,
// not Nginx's internal address. This matters for rate limiting accuracy —
// without it, every request would appear to come from the same "IP" (Nginx),
// silently breaking per-IP limits when the app runs behind the load balancer.
app.set("trust proxy", 1);
 
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://unpkg.com", "'unsafe-inline'"],
        styleSrc: ["'self'", "https://unpkg.com", "https://fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://*.basemaps.cartocdn.com", "https://*.tile.openstreetmap.org"],
        connectSrc: ["'self'", "ws://localhost:3000"],
      },
    },
  })
);
 
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "http://localhost:3000",
  })
);
 
app.use(express.json());
 
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "w-saksham-alert-system", instance: config.instanceId });
});
 
app.get("/health/redis", async (req, res) => {
  await redisClient.set("healthcheck", "ok");
  const value = await redisClient.get("healthcheck");
  res.json({ redis: value });
});
 
app.get("/health/rabbitmq", async (req, res) => {
  await publishEvent("alert.test", { message: "hello from health check" });
  res.json({ rabbitmq: "event published" });
});
 
app.get("/debug/alerts", async (req, res) => {
  const { AlertModel } = await import("./models/alert.model");
  const alerts = await AlertModel.find().sort({ createdAt: -1 }).limit(10);
  res.json(alerts);
});
 
app.get("/debug/dead-letters", async (req, res) => {
  const { getChannel, DLQ_NAME } = await import("./services/rabbitmq.service");
  const channel = getChannel();
 
  const messages: any[] = [];
  let msg;
  while ((msg = await channel.get(DLQ_NAME, { noAck: false }))) {
    messages.push(JSON.parse(msg.content.toString()));
    channel.ack(msg); // ack after reading so it's removed from queue (like "viewing" the DLQ)
  }
 
  res.json({ count: messages.length, messages });
});
 
app.use("/api/v1/alerts", alertsRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/geo", geoRouter);
app.use("/api/v1/contacts", contactsRouter);
app.use("/api/v1/journeys", journeysRouter);
app.use(express.static(path.join(__dirname, "../public")));
 
const server = http.createServer(app);
 
async function startServer() {
  if (config.jwtSecret === "changeme_dev_only") {
    console.warn(
      "⚠️  WARNING: Using default JWT_SECRET. Set a strong, unique secret via the JWT_SECRET environment variable before deploying anywhere real."
    );
  }
 
  await connectMongo();
  await connectRabbitMQ();
  await startPersistenceWorker();
  await startBroadcastWorker();
  await startRiskAssessmentWorker();
  await startNotificationWorker();
  initWebSocketServer(server);

  // Sweep for journeys that have gone silent (no location ping) every minute
setInterval(() => {
  checkStaleJourneys().catch((err) => console.error("Stale journey check failed:", err));
}, 60_000);
 
  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}
 
startServer();