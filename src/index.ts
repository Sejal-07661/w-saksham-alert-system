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

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "w-saksham-alert-system" });
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

app.use("/api/v1/alerts", alertsRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/geo", geoRouter);

const server = http.createServer(app);

async function startServer() {
  await connectMongo();
  await connectRabbitMQ();
  await startPersistenceWorker();
  await startBroadcastWorker();
  initWebSocketServer(server);

  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

startServer();