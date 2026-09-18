import type { MesSettings } from "./settings";

export type BridgeOperation = "readDoc" | "updateDoc" | "addTask";

const API_ROOT = "https://serv.amazingmarvin.com/api";

interface ApiRequest {
  operation: BridgeOperation;
  payload: unknown;
}

const ALLOWED_UPDATE_FIELDS = new Set([
  "title",
  "taskTime",
  "deletedAt",
  "updatedAt",
  "fieldUpdates.title",
  "fieldUpdates.taskTime",
  "fieldUpdates.deletedAt",
]);

const ALLOWED_ADD_FIELDS = new Set([
  "title",
  "done",
  "day",
  "parentId",
  "labelIds",
  "firstScheduled",
  "rank",
  "dailySection",
  "bonusSection",
  "customSection",
  "timeBlockSection",
  "note",
  "dueDate",
  "timeEstimate",
  "isReward",
  "isStarred",
  "isFrogged",
  "plannedWeek",
  "plannedMonth",
  "rewardPoints",
  "rewardId",
  "backburner",
  "reviewDate",
  "itemSnoozeTime",
  "permaSnoozeTime",
  "taskTime",
  "timeZoneOffset",
]);

function validItemId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

export function validateRequestPayload(operation: BridgeOperation, payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid Marvin request payload.");
  const candidate = payload as Record<string, unknown>;

  if (operation === "readDoc") {
    if (!validItemId(candidate.itemId)) throw new Error("A valid task ID is required.");
    return { itemId: candidate.itemId };
  }

  if (operation === "updateDoc") {
    if (!validItemId(candidate.itemId) || !Array.isArray(candidate.setters) || candidate.setters.length < 1 || candidate.setters.length > 12) {
      throw new Error("Invalid Marvin task update.");
    }
    const setters = candidate.setters.map((setter) => {
      if (!setter || typeof setter !== "object" || Array.isArray(setter)) throw new Error("Invalid Marvin setter.");
      const record = setter as Record<string, unknown>;
      if (typeof record.key !== "string" || !ALLOWED_UPDATE_FIELDS.has(record.key)) {
        throw new Error(`MES does not allow updating Marvin field ${String(record.key)}.`);
      }
      if (!["string", "number"].includes(typeof record.val) && record.val !== null) {
        throw new Error(`Invalid value for Marvin field ${record.key}.`);
      }
      return { key: record.key, val: record.val };
    });
    return { itemId: candidate.itemId, setters };
  }

  if (operation === "addTask") {
    if (typeof candidate.title !== "string" || !candidate.title.trim() || candidate.title.length > 10_000) {
      throw new Error("A valid task title is required.");
    }
    for (const key of Object.keys(candidate)) {
      if (!ALLOWED_ADD_FIELDS.has(key)) throw new Error(`MES does not allow addTask field ${key}.`);
    }
    return { ...candidate, done: false };
  }

  throw new Error("Unsupported Marvin operation.");
}

export function endpointFor(operation: BridgeOperation, payload: unknown): { method: "GET" | "POST"; url: string } {
  if (operation === "readDoc") {
    const itemId = (payload as { itemId?: unknown })?.itemId;
    if (typeof itemId !== "string" || !itemId) throw new Error("A task ID is required.");
    return { method: "GET", url: `${API_ROOT}/doc?id=${encodeURIComponent(itemId)}` };
  }
  if (operation === "updateDoc") return { method: "POST", url: `${API_ROOT}/doc/update` };
  if (operation === "addTask") return { method: "POST", url: `${API_ROOT}/addTask` };
  throw new Error("Unsupported Marvin operation.");
}

export async function executeMarvinRequest(request: ApiRequest, settings: MesSettings): Promise<unknown> {
  const payload = validateRequestPayload(request.operation, request.payload);
  const endpoint = endpointFor(request.operation, payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (request.operation === "addTask") {
    if (!settings.unrollerApiToken) throw new Error("Set the Marvin API token in MES settings.");
    headers["X-API-Token"] = settings.unrollerApiToken;
    headers["X-Auto-Complete"] = "false";
  } else {
    if (!settings.unrollerFullAccessToken) throw new Error("Set the Marvin full-access token in MES settings.");
    headers["X-Full-Access-Token"] = settings.unrollerFullAccessToken;
  }

  const response = await fetch(endpoint.url, {
    method: endpoint.method,
    headers,
    body: endpoint.method === "POST" ? JSON.stringify(payload) : undefined,
  });
  const text = await response.text();
  const parsed = text ? safeJson(text) : null;
  if (!response.ok) {
    const detail = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    throw new Error(`Marvin API ${response.status}: ${detail || response.statusText}`);
  }
  return parsed;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
