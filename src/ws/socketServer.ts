import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";

let wss: WebSocketServer;
const clients = new Set<WebSocket>();

export function initWebSocketServer(server: Server): void {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(`WebSocket client connected. Total clients: ${clients.size}`);

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`WebSocket client disconnected. Total clients: ${clients.size}`);
    });

    ws.on("error", (err) => {
      console.error("WebSocket client error:", err);
    });
  });

  console.log("WebSocket server initialized");
}

export function broadcastAlert(payload: object): void {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}