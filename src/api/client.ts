// Point d'entrée unique vers le backend FastAPI.
// VITE_API_MOCK=false dans .env.local pour appeler le vrai serveur au lieu des fixtures JSON.
const useMock = import.meta.env.VITE_API_MOCK !== 'false'
const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }

  // FastAPI renvoie { "detail": ... } ; texte brut sinon.
  get detail(): unknown {
    try {
      return toCamel(JSON.parse(this.message)?.detail)
    } catch {
      return this.message
    }
  }
}

// Le backend parle snake_case, le front camelCase : la conversion des clés se fait ici et nulle part ailleurs.
// Seules les clés en camelCase sont touchées : « Critical » ou « to-author » restent tels quels.
// Sous ces clés, un objet a pour clés des données (ex. customfield_10001, « Critical ») : elles ne sont jamais converties.
const opaqueKeys = new Set(['fields', 'priorityMapping', 'priority_mapping', 'preferences'])

const isRecord = (value: unknown) => value !== null && typeof value === 'object' && !Array.isArray(value)

function convertKeys(value: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => convertKeys(item, convert))
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [convert(key), opaqueKeys.has(key) && isRecord(item) ? item : convertKeys(item, convert)]),
  )
}

export const toSnake = (value: unknown) =>
  convertKeys(value, (key) => key.replace(/([a-z0-9])([A-Z])/g, (_, before: string, upper: string) => `${before}_${upper.toLowerCase()}`))

export const toCamel = (value: unknown) => convertKeys(value, (key) => key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase()))

// Jeton de l'app (JWT) : renvoyé par POST /auth/demo ou par le retour SSO (?token= dans l'URL).
const TOKEN_KEY = 'cockpit-token'

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

const tokenFromSso = new URLSearchParams(window.location.search).get('token')
if (tokenFromSso) {
  setToken(tokenFromSso)
  const url = new URL(window.location.href)
  url.searchParams.delete('token')
  window.history.replaceState(null, '', url)
}

// Paramètres de requête en snake_case, valeurs vides ignorées.
export function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const payload = body === undefined ? undefined : toSnake(body)

  if (useMock) {
    // Import dynamique : les fixtures ne sont pas embarquées quand le mock est désactivé.
    const { handleMock } = await import('./mock-server')
    return toCamel(await handleMock(method, path, payload)) as T
  }

  const token = localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
  if (!response.ok) throw new ApiError(response.status, await response.text())
  return (response.status === 204 ? undefined : toCamel(await response.json())) as T
}
