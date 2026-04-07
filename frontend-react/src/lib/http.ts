import { env } from '../config/env'

export class HttpError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

type RequestOptions = {
  headers?: Record<string, string>
  token?: string
}

type RequestConfig = RequestInit & RequestOptions

function buildHeaders(config?: RequestConfig): Headers {
  const headers = new Headers(config?.headers || {})

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  // Auto-add token from localStorage if available
  const token = config?.token || localStorage.getItem('_tradeaudit_token')
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

async function request<T>(path: string, config?: RequestConfig): Promise<T> {
  const base = env.apiBaseUrl.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${base}${normalizedPath}`

  const response = await fetch(url, {
    ...config,
    headers: buildHeaders(config),
  })

  if (!response.ok) {
    let details: unknown = undefined
    try {
      details = await response.json()
    } catch {
      details = await response.text()
    }
    throw new HttpError(`HTTP ${response.status} for ${normalizedPath}`, response.status, details)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { method: 'GET', ...options })
}

export function post<TResponse, TBody = unknown>(
  path: string,
  body: TBody,
  options?: RequestOptions,
): Promise<TResponse> {
  return request<TResponse>(path, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  })
}
