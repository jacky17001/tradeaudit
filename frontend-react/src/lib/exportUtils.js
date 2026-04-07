export function formatGeneratedAt(timestamp = new Date()) {
  try {
    return new Date(timestamp).toISOString()
  } catch {
    return String(timestamp)
  }
}

export function asText(value, fallback = '--') {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text || fallback
}

export function toNumberText(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '--'
  const n = Number(value)
  if (Number.isNaN(n)) return asText(value)
  return n.toFixed(digits)
}

export function timelineLines(items, limit = 10) {
  if (!Array.isArray(items) || items.length === 0) {
    return ['- (no timeline events)']
  }

  return items.slice(0, Math.max(limit, 1)).map((item) => {
    const time = asText(item?.created_at)
    const title = asText(item?.title)
    const desc = asText(item?.description, '')
    const source = asText(item?.source_section)
    return desc
      ? `- [${time}] ${title} | ${source} | ${desc}`
      : `- [${time}] ${title} | ${source}`
  })
}

export function downloadMarkdown(filenameBase, content) {
  const safeBase = asText(filenameBase, 'tradeaudit-export')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeBase || 'tradeaudit-export'}.md`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}