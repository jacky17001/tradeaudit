import { get, post } from '../../lib/http'
import { endpoints } from '../endpoints'

export interface LoginResponse {
  ok: boolean
  token: string
  issuedAt: string
  expiresAt: string
}

export interface VerifyResponse {
  valid: boolean
  expiresAt?: string
}

export interface ConfigStatusResponse {
  configurationWarning: boolean
  adminPasswordConfigured: boolean
  unsafeAdminPassword: boolean
  warningMessages: string[]
}

export function loginWithPassword(password: string): Promise<LoginResponse> {
  return post<LoginResponse, { password: string }>(endpoints.auth.login, { password })
}

export function verifySession(token?: string): Promise<VerifyResponse> {
  return post<VerifyResponse, Record<string, never>>(endpoints.auth.verify, {}, token ? { token } : undefined)
}

export function getConfigStatus(): Promise<ConfigStatusResponse> {
  return get<ConfigStatusResponse>(endpoints.auth.configStatus)
}
