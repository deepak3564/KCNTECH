const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");
let pendingApiRequests = 0;

type ApiOptions = RequestInit & {
  showLoading?: boolean;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "EMPLOYEE";
  organisationId: string | null;
  organisationName: string;
  mustChangePassword: boolean;
  preferredLanguage: "en" | "mr";
  preferredTheme: "professional" | "brand" | "light" | "dark";
};

export function getToken() {
  return sessionStorage.getItem("kcn_token");
}

export function saveSession(token: string, user: SessionUser) {
  if (token) sessionStorage.setItem("kcn_token", token);
  sessionStorage.setItem("kcn_user", JSON.stringify(user));
  localStorage.removeItem("kcn_token");
  localStorage.removeItem("kcn_user");
}

export function getSavedUser(): SessionUser | null {
  localStorage.removeItem("kcn_token");
  localStorage.removeItem("kcn_user");
  const raw = sessionStorage.getItem("kcn_user");
  if (!raw) return null;
  const user = JSON.parse(raw) as SessionUser;
  const preferredTheme = ["brand", "light", "dark"].includes(user.preferredTheme) ? user.preferredTheme : "professional";
  return { ...user, preferredLanguage: user.preferredLanguage === "mr" ? "mr" : "en", preferredTheme };
}

export function clearSession() {
  sessionStorage.removeItem("kcn_token");
  sessionStorage.removeItem("kcn_user");
  localStorage.removeItem("kcn_token");
  localStorage.removeItem("kcn_user");
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { showLoading = true, ...requestOptions } = options;
  const token = getToken();
  const headers = new Headers(requestOptions.headers);
  if (!(requestOptions.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (showLoading) beginApiRequest();
  try {
    const response = await fetch(`${API_URL}${path}`, { ...requestOptions, headers }).catch(() => {
      const message = "Cannot Connect To Server. Please Check That Backend Is Running.";
      window.dispatchEvent(new CustomEvent("app-error", { detail: { message } }));
      throw new Error(message);
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = readableErrorMessage(data);
      window.dispatchEvent(new CustomEvent("app-error", { detail: { message } }));
      throw new Error(message);
    }
    return data as T;
  } finally {
    if (showLoading) endApiRequest();
  }
}

function beginApiRequest() {
  pendingApiRequests += 1;
  emitApiLoading();
}

function endApiRequest() {
  pendingApiRequests = Math.max(0, pendingApiRequests - 1);
  emitApiLoading();
}

function emitApiLoading() {
  window.dispatchEvent(new CustomEvent("api-loading", { detail: { isLoading: pendingApiRequests > 0 } }));
}

function readableErrorMessage(data: unknown) {
  const raw = extractErrorText(data);
  if (!raw) return "Something Went Wrong. Please Try Again.";

  const parsed = parseJsonError(raw);
  if (parsed) return parsed;

  const lower = raw.toLowerCase();
  if (lower.includes("invalid email") || lower.includes("valid email")) return "Please Enter A Valid Email Address.";
  if (lower.includes("unique constraint") || lower.includes("already exists")) return "This Record Already Exists. Please Check The Details.";
  if (lower.includes("invalid email or password")) return "Invalid Email Or Password.";
  if (lower.includes("password") && lower.includes("8")) return "Password Must Be At Least 8 Characters.";
  if ((lower.includes("payment amount") || lower.includes("collection amount")) && lower.includes("pending amount")) return "Collection Amount Cannot Be Greater Than Pending Amount.";
  if (lower.includes("customer not found")) return "Customer Not Found.";
  if (lower.includes("organisation") && lower.includes("unique")) return "Organisation Name Already Exists.";

  return raw.length > 180 ? "Something Went Wrong. Please Check The Details And Try Again." : raw;
}

function extractErrorText(data: unknown): string {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return JSON.stringify(data);
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return JSON.stringify(message);
  }
  return "";
}

function parseJsonError(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    if (first && typeof first === "object" && "message" in first) {
      const message = String((first as { message?: unknown }).message ?? "");
      if (message.toLowerCase().includes("invalid email")) return "Please Enter A Valid Email Address.";
      return message || "Please Check The Details And Try Again.";
    }
  } catch {
    return "";
  }
  return "";
}

export const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

export function uploadUrl(path: string) {
  if (path.startsWith("http")) return path;
  return `${API_ORIGIN}${path}`;
}
