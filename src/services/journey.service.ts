import { randomUUID } from "crypto";
import { JourneyModel, IJourney } from "../models/journey.model";
import { publishEvent } from "./rabbitmq.service";

const EARTH_RADIUS_METERS = 6371000;
export const DEFAULT_DEVIATION_THRESHOLD_METERS = 500;
// Hysteresis so a journey doesn't flip between active/deviated right at the boundary
const RECOVERY_FACTOR = 0.7;
export const STALE_MINUTES = 15;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Distance from a point to the straight-line corridor between start and end,
 * approximated by sampling points along the segment. This is NOT real road
 * routing — a legitimately curved road can register as "deviated" mid-leg.
 * Good enough for demo scale; a production version would snap to OSRM.
 */
export function distanceToCorridorMeters(
  point: { lat: number; lon: number },
  start: { lat: number; lon: number },
  end: { lat: number; lon: number },
  samples = 40
): number {
  let min = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const lat = start.lat + (end.lat - start.lat) * t;
    const lon = start.lon + (end.lon - start.lon) * t;
    const d = haversineMeters(point.lat, point.lon, lat, lon);
    if (d < min) min = d;
  }
  return min;
}

export interface DeviationCheckResult {
  deviated: boolean;
  distanceMeters: number;
}

export function checkDeviation(journey: IJourney, currentLat: number, currentLon: number): DeviationCheckResult {
  const [startLon, startLat] = journey.startLocation.coordinates;
  const [endLon, endLat] = journey.endLocation.coordinates;

  const distanceMeters = distanceToCorridorMeters(
    { lat: currentLat, lon: currentLon },
    { lat: startLat, lon: startLon },
    { lat: endLat, lon: endLon }
  );

  return {
    deviated: distanceMeters > journey.deviationThresholdMeters,
    distanceMeters,
  };
}

async function raiseDeviationAlert(journey: IJourney, reason: "deviation" | "stale", distanceMeters?: number): Promise<void> {
  const alertId = randomUUID();

  await publishEvent("alert.created", {
    alertId,
    title: `Route deviation — ${journey.username}`,
    description:
      reason === "stale"
        ? `${journey.username} has not sent a location update in over ${STALE_MINUTES} minutes during an active journey${journey.label ? ` ("${journey.label}")` : ""}.`
        : `${journey.username} has moved roughly ${Math.round(distanceMeters || 0)}m off their planned route${journey.label ? ` ("${journey.label}")` : ""}.`,
    category: "route_deviation",
    severity: "critical",
    location: journey.currentLocation,
    reportedBy: journey.username,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Called on every location ping for an active journey. Updates position,
 * runs the deviation check, and — on first crossing the threshold —
 * publishes a route_deviation alert into the SAME event pipeline as every
 * other alert type, so it gets risk-scored by Groq and can trigger the
 * existing trusted-contact notification flow if the score clears escalation.
 */
export async function updateJourneyLocation(
  journey: IJourney,
  latitude: number,
  longitude: number
): Promise<DeviationCheckResult> {
  const result = checkDeviation(journey, latitude, longitude);

  journey.currentLocation = { type: "Point", coordinates: [longitude, latitude] };
  journey.lastLocationAt = new Date();

  if (result.deviated && !journey.alertTriggered) {
    journey.status = "deviated";
    journey.alertTriggered = true;
    await journey.save();
    await raiseDeviationAlert(journey, "deviation", result.distanceMeters);
    return result;
  }

  if (
    !result.deviated &&
    journey.status === "deviated" &&
    result.distanceMeters < journey.deviationThresholdMeters * RECOVERY_FACTOR
  ) {
    journey.status = "active";
    journey.alertTriggered = false;
  }

  await journey.save();
  return result;
}

/**
 * Sweeps active journeys for staleness (no location ping in STALE_MINUTES).
 * Honestly covers the "phone died / lost signal mid-journey" case — this
 * detects silence, it does not recover data from a powered-off phone.
 * Called on an interval from index.ts.
 */
export async function checkStaleJourneys(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

  const staleJourneys = await JourneyModel.find({
    status: { $in: ["active", "deviated"] },
    lastLocationAt: { $lt: cutoff },
    alertTriggered: { $ne: true },
  });

  for (const journey of staleJourneys) {
    journey.status = "unresponsive";
    journey.alertTriggered = true;
    await journey.save();
    await raiseDeviationAlert(journey, "stale");
    console.log(`Journey ${journey.journeyId} marked unresponsive — no location update in ${STALE_MINUTES}+ minutes`);
  }
}