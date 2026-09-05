/* =========================================================
   AGENTVERSE AI — SHARED API CLIENT
   ---------------------------------------------------------
   Every agent page and the career profile form talk to the
   backend through this module, so there is exactly one place
   that decides:
     - which base URL to use (local dev vs deployed)
     - how long to wait before giving up
     - how a failure becomes a user-safe message
   ========================================================= */

/*
 * Local development falls back to http://localhost:8000.
 * Production (Vercel) must set VITE_API_URL to the deployed
 * backend URL. Never hardcode a localhost URL inside a page.
 */
const RAW_API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

/* A trailing slash would turn "/study-ai" into "//study-ai". */
export const API_URL = RAW_API_URL.replace(/\/+$/, "");

/*
 * Kept below a typical 120s CDN/proxy read timeout so the client
 * reports a clean, useful message before the proxy returns its own
 * 524 HTML error page. The backend bounds each agent at 75s and
 * quiz generation at 70s, so this only ever fires if something
 * upstream of the app stalls.
 */
export const DEFAULT_TIMEOUT_MS = 95000;

const OFFLINE_MESSAGE =
  "Unable to connect to AgentVerse AI. Please check the connection and try again.";

const TIMEOUT_MESSAGE =
  "That request took too long to complete. Please try again with a shorter message.";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);

    this.name = "ApiError";
    this.status = status;
  }
}

export function endpointUrl(endpoint: string): string {
  return `${API_URL}/${endpoint.replace(/^\/+/, "")}`;
}


/* =========================================================
   ERROR MESSAGES
   ---------------------------------------------------------
   FastAPI sends { detail: "..." } for HTTPException and
   { detail: [{ loc, msg }] } for 422 validation errors.
   Anything else (an HTML error page from a proxy, an empty
   body) must never be shown raw, so it falls back to a
   status-based message instead.
   ========================================================= */

const GENERIC_DETAILS = new Set([
  "bad request",
  "forbidden",
  "internal server error",
  "method not allowed",
  "not found",
  "unauthorized",
  "unprocessable entity",
]);

function readBackendDetail(bodyText: string): string | null {
  const trimmed = bodyText.trim();

  if (!trimmed || trimmed.startsWith("<")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (
      typeof parsed?.detail === "string" &&
      parsed.detail.trim()
    ) {
      const detail = parsed.detail.trim();

      /* Starlette's own defaults ("Not Found") say no more than
         the status code already does, so a fuller sentence is
         preferred over echoing them. */
      return GENERIC_DETAILS.has(detail.toLowerCase())
        ? null
        : detail;
    }

    if (Array.isArray(parsed?.detail)) {
      const summary = parsed.detail
        .map((item: { loc?: unknown[]; msg?: string }) => {
          const field = Array.isArray(item.loc)
            ? item.loc
              .filter((part) => part !== "body")
              .join(".")
            : "";

          return [field, item.msg]
            .filter(Boolean)
            .join(": ");
        })
        .filter(Boolean)
        .join(" | ");

      return summary || null;
    }

    if (
      typeof parsed?.message === "string" &&
      parsed.message.trim()
    ) {
      return parsed.message.trim();
    }

    return null;
  } catch {
    return null;
  }
}


function statusMessage(status: number): string {
  if (status === 400) {
    return "That request could not be processed. Please rephrase it and try again.";
  }

  if (status === 401 || status === 403) {
    return "AgentVerse AI rejected the request. Please refresh the page and try again.";
  }

  if (status === 404) {
    return "This agent is not available on the server right now.";
  }

  if (status === 413) {
    return "That attachment is too large. Please upload a smaller image.";
  }

  if (status === 422) {
    return "The request was missing required fields. Please try again.";
  }

  if (status === 429) {
    return "Too many requests right now. Please wait a moment and try again.";
  }

  if (status === 504) {
    return TIMEOUT_MESSAGE;
  }

  if (status >= 500) {
    return "AgentVerse AI could not generate a response. Please try again.";
  }

  return `The server responded with an unexpected status (${status}).`;
}

/*
 * Turns anything thrown during a request into one sentence
 * that is safe to render inside the chat.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return TIMEOUT_MESSAGE;
  }

  /* fetch() rejects with a TypeError when the network or the
     CORS preflight fails — that is the "Failed to fetch" case. */
  if (error instanceof TypeError) {
    return OFFLINE_MESSAGE;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return OFFLINE_MESSAGE;
}


/* =========================================================
   REQUESTS
   ========================================================= */

type RequestOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

async function request<T>(
  endpoint: string,
  init: RequestInit,
  options: RequestOptions
): Promise<T> {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  const abortFromCaller = () => controller.abort();

  options.signal?.addEventListener("abort", abortFromCaller);

  try {
    const response = await fetch(endpointUrl(endpoint), {
      ...init,
      signal: controller.signal,
    });

    const bodyText = await response.text();

    if (!response.ok) {
      throw new ApiError(
        readBackendDetail(bodyText) ||
        statusMessage(response.status),
        response.status
      );
    }

    if (!bodyText.trim()) {
      throw new ApiError(
        "AgentVerse AI returned an empty response. Please try again.",
        response.status
      );
    }

    try {
      return JSON.parse(bodyText) as T;
    } catch {
      throw new ApiError(
        "AgentVerse AI returned an unreadable response. Please try again.",
        response.status
      );
    }
  } finally {
    window.clearTimeout(timeoutId);

    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}


export function postJson<T = unknown>(
  endpoint: string,
  payload: unknown,
  options: RequestOptions = {}
): Promise<T> {
  return request<T>(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload ?? {}),
    },
    options
  );
}

/*
 * Content-Type is deliberately omitted: the browser has to
 * add it together with the multipart boundary, and setting
 * it by hand makes FastAPI reject the upload.
 */
export function postFormData<T = unknown>(
  endpoint: string,
  formData: FormData,
  options: RequestOptions = {}
): Promise<T> {
  return request<T>(
    endpoint,
    {
      method: "POST",
      body: formData,
    },
    options
  );
}

export function getJson<T = unknown>(
  endpoint = "",
  options: RequestOptions = {}
): Promise<T> {
  return request<T>(endpoint, { method: "GET" }, options);
}
