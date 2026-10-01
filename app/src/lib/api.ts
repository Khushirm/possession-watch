export type CheckStatus = "pending" | "ok" | "error";
export type UpdateKind = "first_snapshot" | "facts_changed" | "page_changed";

export interface ProjectFacts {
  projectName: string | null;
  promoterName: string | null;
  reraRegistrationNumber: string | null;
  projectStatus: string | null;
  proposedCompletionDate: string | null;
  revisedCompletionDate: string | null;
  extensionCount: number | null;
  complaintCount: number | null;
  constructionProgressPercent: number | null;
}

export interface Project {
  id: string;
  nickname: string;
  url: string;
  createdAt: string;
  lastCheckedAt: string | null;
  checkStatus: CheckStatus;
  lastError: string | null;
  facts: ProjectFacts | null;
  updateCount: number;
}

export interface FactChange {
  field: keyof ProjectFacts;
  label: string;
  before: string | number | null;
  after: string | number | null;
}

export interface ProjectUpdate {
  id: string;
  detectedAt: string;
  kind: UpdateKind;
  summary: string;
  factChanges: FactChange[];
  addedLines: string[];
  removedLines: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");
const TOKEN = process.env.EXPO_PUBLIC_API_TOKEN;
// Generous enough for a free-tier host (e.g. Render) to wake from sleep, which can take up to a minute.
const TIMEOUT_MS = 75_000;
const IS_LOCAL_SERVER = BASE_URL ? /^http:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(BASE_URL) : false;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError("Set EXPO_PUBLIC_API_URL in app/.env, then restart Expo.", 0);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(
      IS_LOCAL_SERVER
        ? `Can't reach the server at ${BASE_URL}. Is it running and on the same Wi-Fi?`
        : `Can't reach the server at ${BASE_URL}. Check your internet connection and try again.`,
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!response.ok) {
    throw new ApiError(body?.error ?? `Request failed (${response.status}).`, response.status);
  }
  return body as T;
}

export const api = {
  listProjects: () => request<{ projects: Project[] }>("/projects").then((body) => body.projects),

  getProject: (id: string) => request<{ project: Project; updates: ProjectUpdate[] }>(`/projects/${encodeURIComponent(id)}`),

  createProject: (input: { nickname: string; url: string }) =>
    request<{ project: Project }>("/projects", { method: "POST", body: JSON.stringify(input) }).then((body) => body.project),

  checkNow: (id: string) =>
    request<{ project: Project }>(`/projects/${encodeURIComponent(id)}/check`, { method: "POST" }).then((body) => body.project),

  deleteProject: (id: string) => request<void>(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
