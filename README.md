# W-Saksham — Women's Safety Alert & Monitoring Platform

An event-driven backend (with a full working frontend) for personal safety alerts, live location tracking, and AI-assisted risk assessment. Built as a portfolio project to demonstrate real distributed-systems patterns — message queues, horizontal scaling, idempotency, dead-letter recovery — applied to a genuinely useful problem, not a toy CRUD app.

**Live demo:** *(add your deployment URL here if you deploy it, otherwise remove this line)*
**Repo:** https://github.com/Sejal-07661/w-saksham-alert-system

---

## What it does

- **SOS button** — one tap shares live location, gets AI risk-scored, and broadcasts to the dispatch feed and map in real time.
- **Incident reporting** — harassment, stalking, unsafe areas, medical emergencies, with severity and category.
- **Route/journey tracking** — set a start and destination; the system watches your live location and automatically raises an alert if you drift off the planned corridor or go silent for 15+ minutes.
- **AI risk scoring** — every alert is scored 0–100 by an LLM (Groq/Llama), factoring in category, severity, and a live "hotspot" signal (recent nearby alert density) — not just a static severity label.
- **Automatic escalation** — alerts scoring ≥80 trigger real emails to the reporter's trusted contacts via Gmail SMTP, with a direct map link to their location.
- **Admin/responder dashboard** — a role-gated (RBAC) console showing every alert, live stats, filters, and inline status management (pending → acknowledged → processing → escalated → resolved).
- **Live map** — dark-themed Leaflet map, severity-color-coded, updates in real time via WebSocket, no polling.

---

## Architecture

The core is event-driven: one alert fans out to four independent consumers over RabbitMQ, so persistence, real-time broadcast, AI scoring, and notifications never block each other and can fail independently without losing data.

```
                    ┌─────────────────┐
  POST /alerts ───► │  RabbitMQ topic  │
  PATCH /journeys   │  exchange        │
  (route deviation) │  (alert.created) │
                    └────────┬─────────┘
                             │ fan-out
        ┌───────────┬────────┴────────┬───────────────┐
        ▼           ▼                 ▼                ▼
   Persistence   Broadcast      Risk Assessment    (escalated alerts
   worker        worker         worker              route to↓)
        │           │                 │
        ▼           ▼                 ▼
    MongoDB    WebSocket to      Groq LLM API
   (upsert by  every app         + nearby-alert
    alertId)   instance          hotspot query
                                       │
                              score ≥ 80?
                                       │
                                       ▼
                              alert.escalated ──► Notification worker
                                                   ──► Gmail SMTP to
                                                       trusted contacts
```

**Key design decisions worth calling out:**

- **Exclusive queues for broadcast, shared queue for persistence/risk/notification.** With 3 load-balanced app instances behind Nginx, a shared queue for broadcast would mean only one instance's WebSocket clients ever see a live update (RabbitMQ competing-consumer behavior). Exclusive, auto-generated queues per instance mean every instance — and therefore every connected client — gets every event.
- **Idempotent upserts keyed by `alertId`, not `_id`.** Persistence and risk-assessment workers can run in either order and still converge on one correct document, regardless of which one creates it first.
- **Dead-letter queue, not silent drops.** Any consumer that nacks a message routes it to `alerts_dlx` / `alerts_dead_letter_queue` instead of losing it. Tested by deliberately breaking a consumer mid-development and confirming messages landed in the DLQ rather than vanishing.
- **Redis-backed rate limiting, not in-memory.** With 3 stateless instances, an in-memory counter would undercount by 3x — Redis makes the limit correct globally. Fails open (allows the request) if Redis itself is down, since availability of the core app matters more than perfect rate-limit enforcement during a Redis outage.
- **Route deviation uses a straight-line corridor check, not real road routing.** Distance from current position to the start→end line segment (haversine-based). This is a known, deliberate simplification — a legitimately curved road can register as "deviated" mid-leg. A production version would snap to OSRM or a real routing API.
- **Real RBAC for admin, not just "logged in."** The `admin` route group checks `role === 'admin'` server-side on every request; the JWT payload carries the role, and there is deliberately no public API to self-assign it — that would defeat the purpose of having roles at all.

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Node.js, TypeScript, Express |
| Message broker | RabbitMQ (topic exchange, dead-letter queue) |
| Database | MongoDB (Mongoose), 2dsphere geo indexing |
| Cache / rate limiting / idempotency | Redis |
| Real-time | Native `ws` WebSocket server |
| Auth | JWT (RS-capable design, currently HS256) + bcrypt |
| AI | Groq LLM API (Llama) for risk scoring |
| Email | Nodemailer + Gmail SMTP |
| Geocoding | OpenStreetMap Nominatim |
| Frontend | Plain HTML/CSS/JS, shared design-token stylesheet, Leaflet (dark CARTO tiles) |
| Infra | Docker multi-stage build, Docker Compose, Nginx load balancing across 3 app instances |

---

## API overview

All routes under `/api/v1`.

**Auth** — `POST /auth/register`, `POST /auth/login` (rate limited)

**Alerts** — `POST /alerts` (JWT, rate limited, idempotent), `GET /alerts/nearby?longitude&latitude&radiusKm`

**Journeys** — `POST /journeys`, `PATCH /journeys/:id/location`, `GET /journeys/active`, `POST /journeys/:id/complete`, `POST /journeys/:id/cancel`

**Contacts** — `GET/POST/DELETE /contacts` (trusted contacts, max 5)

**Geo** — `POST /geo/geocode`, `GET /geo/reverse`

**Admin** *(requires `role: admin`)* — `GET /admin/alerts` (filterable), `GET /admin/stats`, `PATCH /admin/alerts/:id/status`

**Debug** *(dev only, no auth)* — `/health`, `/health/redis`, `/health/rabbitmq`, `/debug/alerts`, `/debug/dead-letters`

---

## Running it locally

**Requirements:** Node 18+, Docker Desktop, npm.

```cmd
git clone https://github.com/Sejal-07661/w-saksham-alert-system.git
cd w-saksham-alert-system
npm install
```

Copy `.env.example` to `.env` and fill in:
```
PORT=3000
MONGO_URI=mongodb://localhost:27017/wsaksham_dev
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
RABBITMQ_URL=amqp://guest:guest@localhost:5672
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
GROQ_API_KEY=<your Groq API key>
GROQ_MODEL=llama-3.1-8b-instant
GMAIL_USER=<your gmail address>
GMAIL_APP_PASSWORD=<gmail app password, not your real password>
INSTANCE_ID=local
```

Start dependencies:
```cmd
docker compose up -d mongo redis rabbitmq
```

Run the app:
```cmd
npm run dev
```

Then open `http://localhost:3000/login.html`.

**To run the full multi-instance setup** (Nginx + 3 app instances, matching the horizontal-scaling design):
```cmd
docker compose up --build
```
Verify load balancing is real, not just claimed:
```cmd
curl http://localhost:3000/health
```
Run it a few times — the `"instance"` field should rotate between `app1`/`app2`/`app3`.

---

## What's honestly not built

Being direct about scope, since overclaiming is worse than a clear "not yet":

- No face/voice/hazard detection — evaluated and deliberately deferred. Face recognition verifies identity, it doesn't detect distress; always-on background voice listening is aggressively killed by mobile OSes and has an unworkable false-positive rate for open-vocabulary trigger phrases. Groq-based risk scoring was built instead as the genuine, defensible AI feature.
- No Bluetooth mesh / offline fallback for a fully powered-off phone — not possible in principle (no software runs on an off device). A real mesh network for "no signal but phone on" is a smaller, still-unbuilt scope.
- No direct police dispatch integration — no such public API exists; the honest version is formatting an alert for 112/100 or a local station's contact, not automated dispatch.
- No automated test suite yet.
- No report moderation/verification — any authenticated user can submit any report.
- No encryption at rest for location data.
- Route deviation is a straight-line corridor check, not real road-routing (see Architecture notes above).

---

## Known environment gotchas (Windows)

- A native Windows MongoDB service can silently run on port 27017 alongside the Docker Mongo container, making it look like the Docker container isn't receiving writes. Check `Get-Service` / Task Manager for a stray `mongod` and disable it if found.
- Docker containers need `restart: unless-stopped` in the compose file plus Docker Desktop's "start on login" enabled to survive a reboot.
- Port 3000 conflicts between `npm run dev` and the Docker Compose stack — check `docker ps` before running locally.
- `ts-node` 10.9.2 is incompatible with `typescript@7.x` — pinned to `typescript@5.5.4` in `package.json`.
