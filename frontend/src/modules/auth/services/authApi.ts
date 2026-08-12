import { apiGet, apiPost } from "../../../lib/api";

export interface Account {
  id: number;
  email: string;
  displayName: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function register(input: RegisterInput) {
  return apiPost<Account, RegisterInput>(
    "/api/auth/register",
    input,
  );
}

export function login(input: LoginInput) {
  return apiPost<Account, LoginInput>(
    "/api/auth/login",
    input,
  );
}

export function getCurrentAccount() {
  return apiGet<Account>("/api/auth/me");
}

export function logout() {
  return apiPost<void>("/api/auth/logout");
}