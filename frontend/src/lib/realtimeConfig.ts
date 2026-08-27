/**
 * Shared configuration for the OpenAI Realtime API.
 *
 * The model is referenced in two places that must agree:
 *  - `/api/session`, which mints the ephemeral client secret
 *  - the WebRTC session config in `useRealtimeSession`
 *
 * Keeping it here (rather than in the client hook) means the server route can
 * import it without pulling the client module graph into the server bundle.
 */

/** Realtime model backing the voice session. */
export const REALTIME_MODEL = "gpt-realtime-2.1-mini";

/** Model used to transcribe the user's inbound audio. */
export const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
