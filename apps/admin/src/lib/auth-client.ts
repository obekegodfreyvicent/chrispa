'use client';

// Dev-simple token storage — see apps/storefront/src/lib/auth-client.ts for the
// same note: production should use httpOnly cookies, not localStorage.
const ACCESS_KEY = 'chrispa_admin_access_token';
const REFRESH_KEY = 'chrispa_admin_refresh_token';

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export type UserRole = 'OWNER' | 'STORE_MANAGER' | 'FULFILLMENT' | 'SUPPORT_AGENT' | 'HR_MANAGER' | 'CUSTOMER';

// JWT segments are base64url (RFC 7515), not plain base64 — atob() decodes
// plain base64 and would silently mangle any payload whose encoded bytes
// happen to contain '-' or '_'. Convert to base64 first.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const segment = token.split('.')[1];
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// Decodes the `role` claim out of the JWT payload — no signature check,
// since this only drives which nav sections/tabs are shown. The API
// re-checks the role on every request (RolesGuard), which is the actual
// security boundary; this is cosmetic.
export function getUserRole(): UserRole | null {
  const token = getAccessToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return (payload?.role as UserRole) ?? null;
}

// Decodes the `mustChangePassword` claim — the API enforces this for real
// (MustChangePasswordGuard blocks every endpoint except change-password/
// logout/me until it's cleared); this drives the forced redirect to
// /change-password so the UI doesn't just show a wall of 403s.
export function getMustChangePassword(): boolean {
  const token = getAccessToken();
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  return payload?.mustChangePassword === true;
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// Revokes the refresh token server-side (not just a local token clear) —
// see AuthService.logout() in the API. Never throws: if the request fails
// (offline, expired token, etc.) we still clear local state.
export async function logout() {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null;
  if (refreshToken) {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  clearTokens();
}

// Access tokens expire after 15 minutes (JWT_ACCESS_TTL). Without this,
// every write action just silently 401s once a session runs past that —
// looking exactly like "the button doesn't work" with no error shown,
// since most pages treat a non-ok response as "no data" rather than
// surfacing it. `inflightRefresh` collapses concurrent 401s (e.g. a page
// firing several requests at once) into a single refresh call — the
// refresh token rotates server-side on each use, so firing more than one
// in parallel would invalidate the others mid-flight.
let inflightRefresh: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const { accessToken, refreshToken: newRefreshToken } = await res.json();
    setTokens(accessToken, newRefreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function authedFetch(path: string, init: RequestInit = {}) {
  const doFetch = (token: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  const token = getAccessToken();
  const res = await doFetch(token);
  if (res.status !== 401 || !token) return res;

  inflightRefresh ??= refreshAccessToken().finally(() => {
    inflightRefresh = null;
  });
  const refreshed = await inflightRefresh;
  return refreshed ? doFetch(getAccessToken()) : res;
}
