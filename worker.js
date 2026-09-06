/* Usage collection for sudokupad_to_penpa. The database is only accessible
 * through the owner's Cloudflare account; this worker has no log-reading API. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_URL_LENGTH = 900000;
const DEFAULT_ORIGINS = ["https://cyddrdrd.github.io"];

function allowedOrigins(env) {
  // Local development may opt into exact origins, such as http://localhost:8766.
  // Do not use wildcard origins: GitHub Pages is the only production caller.
  const extra = (env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...extra]);
}

function reply(status, data, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff"
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(data), {status, headers});
}

function invalid(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function readJSON(request) {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("Content-Type") || "")) {
    throw invalid("Expected application/json.", 415);
  }
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength && Number(declaredLength) > MAX_BODY_BYTES) throw invalid("Request is too large.", 413);
  if (!request.body) throw invalid("Missing event.");
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw invalid("Request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(body));
  } catch {
    throw invalid("Invalid JSON.");
  }
}

function validateEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid("Expected an event object.");
  const string = (key, maximum, optional = false) => {
    if (optional && (value[key] === undefined || value[key] === null || value[key] === "")) return null;
    if (typeof value[key] !== "string" || value[key].length > maximum) throw invalid("Invalid " + key + ".");
    return value[key];
  };
  const eventId = string("eventId", 80);
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(eventId)) throw invalid("Invalid eventId.");
  const startedAt = string("startedAt", 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(startedAt) ||
      !Number.isFinite(Date.parse(startedAt)) || new Date(startedAt).toISOString() !== startedAt) {
    throw invalid("Invalid startedAt.");
  }
  const inputUrl = string("inputUrl", MAX_URL_LENGTH);
  const outputUrl = string("outputUrl", MAX_URL_LENGTH, true);
  const inputFormat = string("inputFormat", 32, true);
  const error = string("error", 4000, true);
  const version = string("version", 40);
  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version)) throw invalid("Invalid version.");
  if (typeof value.noSolutionCheck !== "boolean") throw invalid("Invalid noSolutionCheck.");
  if (!["success", "error"].includes(value.status)) throw invalid("Invalid status.");
  if (value.status === "success" && (!outputUrl || !/^https:\/\/swaroopg92\.github\.io\/penpa-edit\/[?#]/.test(outputUrl))) {
    throw invalid("A successful event requires a Penpa output URL.");
  }
  if (value.status === "error" && (!error || outputUrl)) throw invalid("An error event requires an error and no output URL.");
  if (value.status === "success" && error) throw invalid("A successful event cannot contain an error.");
  // Keep only these explicit fields. Cookies, IP addresses and browser headers
  // are neither read nor included in the database record.
  return {eventId, startedAt, inputUrl, outputUrl, noSolutionCheck: value.noSolutionCheck,
    status: value.status, inputFormat, error, version};
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (!allowedOrigins(env).has(origin)) return reply(403, {ok: false, error: "Origin is not allowed."});
    if (new URL(request.url).pathname !== "/log") return reply(404, {ok: false, error: "Not found."}, origin);
    if (request.method === "OPTIONS") {
      const method = request.headers.get("Access-Control-Request-Method");
      const headers = (request.headers.get("Access-Control-Request-Headers") || "").toLowerCase().split(",").map(value => value.trim()).filter(Boolean);
      if (method !== "POST" || headers.some(header => header !== "content-type")) {
        return reply(403, {ok: false, error: "Preflight is not allowed."}, origin);
      }
      return new Response(null, {status: 204, headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin, Access-Control-Request-Method, Access-Control-Request-Headers"
      }});
    }
    if (request.method !== "POST") {
      const response = reply(405, {ok: false, error: "Method is not allowed."}, origin);
      response.headers.set("Allow", "POST, OPTIONS");
      return response;
    }
    let event;
    try {
      event = validateEvent(await readJSON(request));
    } catch (error) {
      return reply(error.status || 400, {ok: false, error: error.status ? error.message : "Invalid event."}, origin);
    }
    try {
      const result = await env.DB.prepare(`
        INSERT INTO conversion_events
          (event_id, received_at, started_at, input_url, output_url,
           no_solution_check, status, input_format, error, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id) DO NOTHING
      `).bind(event.eventId, new Date().toISOString(), event.startedAt,
        event.inputUrl, event.outputUrl, Number(event.noSolutionCheck),
        event.status, event.inputFormat, event.error, event.version).run();
      if (result && result.success === false) throw new Error("Storage failed.");
      return reply(201, {ok: true}, origin);
    } catch {
      // Return a retryable failure without including database details or URLs.
      return reply(503, {ok: false, error: "Usage storage is temporarily unavailable."}, origin);
    }
  }
};
