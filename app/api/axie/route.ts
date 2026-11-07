import { axieRequest, readAnswer, readQuestions } from "@/lib/axie";

// Lets a deployment change model without a code change. The alias follows Google's current lite model, because a pinned one gets retired
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
const MAX_BODY = 4096;
const WINDOW_MS = 60_000;
const PER_WINDOW = 12;

// shortcut: counts per server instance and is lost on restart, so on many instances the real limit is higher. Move to a shared store if this endpoint gets abused
const recent = new Map<string, number[]>();
function allowed(visitor: string) {
  const now = Date.now();
  const hits = (recent.get(visitor) ?? []).filter((at) => now - at < WINDOW_MS);
  if (hits.length >= PER_WINDOW) return false;
  recent.set(visitor, [...hits, now]);
  if (recent.size > 5000) recent.forEach((times, key) => times.every((at) => now - at >= WINDOW_MS) && recent.delete(key));
  return true;
}

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  // Only this site's own pages, or this would be a free Gemini proxy for anyone who found it
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || !URL.canParse(origin) || new URL(origin).host !== host) return fail(403, "Not allowed.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail(415, "Send JSON.");

  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!allowed(visitor)) return fail(429, "Too many questions.");

  const raw = await request.text();
  if (raw.length > MAX_BODY) return fail(413, "That's too long.");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "That isn't a question.");
  }
  const questions = readQuestions(body);
  if (!questions) return fail(400, "That isn't a question.");

  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail(503, "Axie is offline.");
  try {
    const ask = () =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(axieRequest(questions)),
        signal: AbortSignal.timeout(10_000),
      });
    let response = await ask();
    // Google's "busy, try again" tends to clear at once, and one retry saves the visitor a dropped answer
    if (response.status === 503) response = await ask();
    // Only the status goes to the log, and nothing from Google's reply goes to the visitor
    if (!response.ok) {
      console.error(`Gemini answered ${response.status}`);
      return fail(502, "Axie is offline.");
    }
    return Response.json({ reply: readAnswer(await response.json()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gemini call failed:", error instanceof Error ? error.name : "unknown");
    return fail(502, "Axie is offline.");
  }
}
