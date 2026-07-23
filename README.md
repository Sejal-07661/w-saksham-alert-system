# W-Saksham — Alert & Monitoring System

A production-patterned, event-driven backend for real-time emergency alert tracking, geospatial querying, and live map visualization. Built from scratch with a focus on decoupled architecture, fault tolerance, and observability.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **API Framework**: Express
- **Message Broker**: RabbitMQ (topic exchange, fan-out to independent consumers)
- **Database**: MongoDB (geospatial `2dsphere` indexing)
- **Cache / Idempotency**: Redis
- **Real-time**: WebSocket (native `ws`)
- **Auth**: JWT (bcrypt password hashing)
- **Geocoding**: OpenStreetMap Nominatim (free, no API key)
- **Visualization**: Leaflet.js + OpenStreetMap tiles
- **Containerization**: Docker (multi-stage build) + Docker Compose

## Architecture

Client (curl / browser / map.html)
│
▼
Express API Gateway (JWT-protected ingestion, public geo queries)
│
├──► Redis (idempotency keys, dedup)
│
└──► RabbitMQ Topic Exchange (alerts_exchange)
│
┌───────────┴────────────┐
▼ ▼
Persistence Worker Broadcast Worker
│ │
▼ ▼
MongoDB (2dsphere) WebSocket clients
│ │
▼ ▼
Failed writes ──► Dead-Letter Exchange/Queue

**Design principle**: Ingestion is decoupled from processing. The API publishes an event and returns immediately (`202 Accepted`); persistence and real-time broadcast happen asynchronously via independent RabbitMQ consumers. A failure in one consumer (e.g. MongoDB downtime) does not block or lose data for the other — failed messages are routed to a durable dead-letter queue instead of being silently dropped.

## Features

- **Event-driven ingestion** — validated (Zod), idempotent (Redis `SET NX`), published to RabbitMQ, never blocks on downstream writes
- **Fan-out processing** — two independent consumers (persistence + broadcast) bound to the same exchange via separate durable queues
- **Geospatial queries** — MongoDB `2dsphere` index + `$near`, returns alerts within a radius sorted by distance
- **Free geocoding** — address ↔ coordinates via OpenStreetMap Nominatim, no billing dependency
- **Real-time map** — Leaflet + WebSocket, alerts appear on the map instantly with zero polling
- **JWT authentication** — register/login, bcrypt-hashed passwords, protected write endpoints
- **Dead-letter queue** — failed persistence attempts are captured and inspectable, never lost
- **Fully containerized** — one command (`docker compose up`) starts the app and all infrastructure together

## Getting Started

### Prerequisites
- Docker Desktop
- Node.js 20+ (only needed for local dev outside Docker)

### Run everything with Docker
```bash
docker compose -f docker/docker-compose.yml up -d --build
```

This starts the API server, MongoDB, Redis, and RabbitMQ together. Visit:
- `http://localhost:3000/health` — health check
- `http://localhost:3000/map.html` — live alert map
- `http://localhost:15672` — RabbitMQ management UI (guest/guest)

### Run locally for development
```bash
npm install
docker compose -f docker/docker-compose.yml up -d mongo redis rabbitmq
npm run dev
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | No | Register a new user |
| POST | `/api/v1/auth/login` | No | Log in, receive JWT |
| POST | `/api/v1/alerts` | Yes (Bearer) | Create an alert (event-driven ingestion) |
| GET | `/api/v1/alerts/nearby` | No | Find alerts within a radius (`?longitude&latitude&radiusKm`) |
| POST | `/api/v1/geo/geocode` | No | Address → coordinates |
| GET | `/api/v1/geo/reverse` | No | Coordinates → address |

## Resilience Notes

- RabbitMQ connection includes retry logic (5 attempts, 3s backoff) to tolerate slow container startup
- MongoDB configured with `bufferCommands: false` and a 5s server selection timeout — fails fast rather than silently queueing writes
- Failed message processing is routed to a dead-letter exchange (`alerts_dlx`) rather than discarded