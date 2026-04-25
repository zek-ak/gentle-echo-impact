import { createSupabaseClient, initializeSupabaseClient } from "@/lib/supabase/client";

export interface AuthUser {
  id: string;
  phone: string;
  full_name: string;
  role: string;
}

export interface AuthSession {
  access_token: string;
  expires_at: string;
  user_id: string;
  user: AuthUser;
}

const AUTH_STORAGE_KEY = "auth_session";

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "255" + cleaned.slice(1);
  }
  if (!cleaned.startsWith("255")) {
    cleaned = "255" + cleaned;
  }
  return cleaned;
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    if (new Date(session.expires_at) < new Date()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function signIn(phone: string): Promise<AuthSession> {
  const client = createSupabaseClient();
  const { data, error } = await client.functions.invoke("sign-in", {
    body: { phone },
  });

  if (error) throw new Error(error.message || "Failed to sign in");
  if (!data?.success) throw new Error(data?.error || "Failed to sign in");

  const session: AuthSession = {
    access_token: data.access_token,
    expires_at: data.expires_at,
    user_id: data.user_id,
    user: data.user,
  };

  saveSession(session);
  return session;
}

export async function sendOtp(phone: string, full_name?: string) {
  const client = createSupabaseClient();
  const { data, error } = await client.functions.invoke("send-otp", {
    body: { phone, full_name },
  });

  if (error) throw new Error(error.message || "Failed to send OTP");
  if (!data?.success) throw new Error(data?.error || "Failed to send OTP");
  return data;
}

export async function verifyOtp(phone: string, otp: string, full_name?: string): Promise<AuthSession> {
  const client = createSupabaseClient();
  const { data, error } = await client.functions.invoke("verify-otp", {
    body: { phone, otp, full_name },
  });

  if (error) throw new Error(error.message || "Failed to verify OTP");
  if (!data?.success) throw new Error(data?.error || "Failed to verify OTP");

  const session: AuthSession = {
    access_token: data.access_token,
    expires_at: data.expires_at,
    user_id: data.user_id,
    user: data.user,
  };

  saveSession(session);
  
  // Initialize the Supabase client with the token so RLS policies work
  initializeSupabaseClient();
  
  return session;
}
