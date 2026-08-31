export type JiraSavedFilter = {
  id: string
  name: string
  jql: string
}

const STORAGE_KEY = 'orca.jira.saved-filters.v1'
const MAX_FILTERS = 50
const MAX_ID_LENGTH = 100
const MAX_NAME_LENGTH = 80
const MAX_JQL_LENGTH = 4000

function normalizeSavedFilter(value: unknown): JiraSavedFilter | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.jql !== 'string'
  ) {
    return null
  }
  const id = candidate.id.trim()
  const name = candidate.name.trim()
  const jql = candidate.jql.trim()
  if (
    !id ||
    !name ||
    !jql ||
    id.length > MAX_ID_LENGTH ||
    name.length > MAX_NAME_LENGTH ||
    jql.length > MAX_JQL_LENGTH
  ) {
    return null
  }
  return { id, name, jql }
}

export function normalizeJiraSavedFilters(value: unknown): JiraSavedFilter[] {
  if (!Array.isArray(value)) {
    return []
  }
  const ids = new Set<string>()
  const filters: JiraSavedFilter[] = []
  for (const valueEntry of value) {
    const filter = normalizeSavedFilter(valueEntry)
    if (!filter || ids.has(filter.id)) {
      continue
    }
    ids.add(filter.id)
    filters.push(filter)
    if (filters.length === MAX_FILTERS) {
      break
    }
  }
  return filters
}

export function loadJiraSavedFilters(): JiraSavedFilter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalizeJiraSavedFilters(raw ? (JSON.parse(raw) as unknown) : undefined)
  } catch {
    return []
  }
}

export function saveJiraSavedFilters(filters: readonly JiraSavedFilter[]): JiraSavedFilter[] {
  const normalized = normalizeJiraSavedFilters(filters)
  try {
    if (normalized.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {
    // Keep the live filters usable when browser storage is unavailable or full.
  }
  return normalized
}
