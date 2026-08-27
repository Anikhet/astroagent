import { NextResponse } from "next/server";
import { REALTIME_MODEL } from "@/lib/realtimeConfig";

/**
 * Mints a short-lived ephemeral client secret for the browser to open a
 * Realtime WebRTC session with, so the real API key never leaves the server.
 *
 * Uses the GA endpoint `POST /v1/realtime/client_secrets`. The response's
 * `value` field (an `ek_...` token) is what the client passes to the SDK.
 *
 * Note: this route lives in the frontend service, so `vercel.json` must route
 * `/api/session` there explicitly — the catch-all `/api/(.*)` rule sends
 * everything else to the FastAPI backend, and service routing is final.
 */
export async function GET() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not configured");
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: REALTIME_MODEL,
          },
        }),
      },
    );

    const data = await response.json();

    // OpenAI signals failure via HTTP status; without this check an error body
    // would be returned as a 200 and surface to the client as a missing key.
    if (!response.ok) {
      console.error("Failed to create realtime client secret:", data);
      return NextResponse.json(
        { error: data?.error?.message ?? "Failed to create realtime session" },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in /api/session:", error);
    return NextResponse.json(
      { error: "Failed to reach the OpenAI API" },
      { status: 502 },
    );
  }
}
