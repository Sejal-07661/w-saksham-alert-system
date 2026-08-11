import axios from "axios";
import { config } from "../core/config";
 
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
 
export interface RiskAssessmentInput {
  title: string;
  description: string;
  category: string;
  severity: string;
  nearbyAlertCount: number; // recent alerts within radius — a real "hotspot" signal
}
 
export interface RiskAssessmentResult {
  riskScore: number; // 0-100
  urgencyLabel: "low" | "medium" | "high" | "critical";
  reasoning: string;
}
 
const SYSTEM_PROMPT = `You are a risk assessment engine for a women's safety alert platform.
Given an incident report, output ONLY a JSON object (no markdown, no extra text) with this exact shape:
{"riskScore": <integer 0-100>, "urgencyLabel": "<low|medium|high|critical>", "reasoning": "<one short sentence>"}
 
Scoring guidance:
- SOS/panic alerts and anything describing immediate physical danger should score 85-100.
- Stalking or harassment with specific, ongoing threat language should score 60-85.
- Reports of unsafe areas (poor lighting, isolated, no immediate threat described) should score 20-50.
- A high count of nearby recent alerts (a "hotspot") should push the score up, since it indicates a pattern of risk in that location.
- Medical emergencies should score 70-100 depending on severity language.
Be decisive. Never return a score of exactly 0 or refuse to answer — always produce your best assessment.
- Route deviation alerts (a user has drifted off their planned path or gone silent mid-journey) should score 65-90, since unexplained deviation during a tracked journey is itself a strong risk signal.`;
 
// Fallback used only if the Groq API call fails (network issue, rate limit, etc.)
// — ingestion and persistence must never be blocked by an AI provider outage.
function fallbackAssessment(input: RiskAssessmentInput): RiskAssessmentResult {
  const categoryBase: Record<string, number> = {
    sos: 90,
    medical: 80,
    route_deviation: 75,
    stalking: 65,
    harassment: 55,
    unsafe_area: 35,
    other: 30,
  };
  const base = categoryBase[input.category] ?? 40;
  const hotspotBoost = Math.min(input.nearbyAlertCount * 5, 20);
  const riskScore = Math.min(base + hotspotBoost, 100);
 
  let urgencyLabel: RiskAssessmentResult["urgencyLabel"] = "low";
  if (riskScore >= 80) urgencyLabel = "critical";
  else if (riskScore >= 60) urgencyLabel = "high";
  else if (riskScore >= 35) urgencyLabel = "medium";
 
  return {
    riskScore,
    urgencyLabel,
    reasoning: "Rule-based fallback score (AI provider unavailable).",
  };
}
 
export async function assessRisk(input: RiskAssessmentInput): Promise<RiskAssessmentResult> {
  if (!config.groqApiKey) {
    return fallbackAssessment(input);
  }
 
  const userPrompt = `Category: ${input.category}
Severity (self-reported): ${input.severity}
Title: ${input.title}
Description: ${input.description}
Nearby recent alerts within 2km (last 24h): ${input.nearbyAlertCount}`;
 
  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: config.groqModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${config.groqApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );
 
    const raw = response.data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw);
 
    const riskScore = Math.max(0, Math.min(100, Number(parsed.riskScore)));
    const urgencyLabel = ["low", "medium", "high", "critical"].includes(parsed.urgencyLabel)
      ? parsed.urgencyLabel
      : fallbackAssessment(input).urgencyLabel;
 
    return {
      riskScore: Number.isFinite(riskScore) ? riskScore : fallbackAssessment(input).riskScore,
      urgencyLabel,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "AI assessment completed.",
    };
  } catch (err) {
    console.warn("Groq risk assessment failed, using rule-based fallback:", (err as Error).message);
    return fallbackAssessment(input);
  }
}
