// 共通APIヘルパー
// すべてのfetchコールはここを通すこと

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (body && typeof body === "object") {
    const detail = "detail" in body ? (body as { detail?: unknown }).detail : undefined;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail)) {
      const joined = detail
        .map((item) => {
          if (!item || typeof item !== "object") {
            return "";
          }
          const maybeError = item as { loc?: unknown; msg?: unknown };
          const where = Array.isArray(maybeError.loc) ? maybeError.loc.join(" > ") : "";
          const message = typeof maybeError.msg === "string" ? maybeError.msg : "";
          return [where, message].filter(Boolean).join(": ");
        })
        .filter(Boolean)
        .join("\n");
      if (joined) {
        return joined;
      }
    }
  }

  return fallback;
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = extractErrorMessage(body, `${res.status} ${res.statusText}`);
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  get: <T = any>(path: string) => apiFetch<T>(path, { method: "GET" }),
  post: <T = any>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  postForm: async <T = any>(path: string, body: Record<string, string>): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...authHeaders(),
      },
      body: new URLSearchParams(body),
    });
    const responseBody = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(extractErrorMessage(responseBody, `${res.status} ${res.statusText}`));
    }
    return responseBody as T;
  },
  put: <T = any>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
};
