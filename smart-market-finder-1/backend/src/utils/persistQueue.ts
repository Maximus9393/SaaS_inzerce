import fs from 'fs'
import path from 'path'

const QUEUE_FILE = path.resolve(__dirname, '..', '..', 'data', 'persist_queue.jsonl')

function ensureDir() {
  const dir = path.dirname(QUEUE_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function enqueue(item: any) {
  ensureDir()
  const line = JSON.stringify(item) + '\n'
  fs.appendFileSync(QUEUE_FILE, line, 'utf8')
}

export function drainBatch(max = 100): any[] {
  ensureDir()
  if (!fs.existsSync(QUEUE_FILE)) return []
  const data = fs.readFileSync(QUEUE_FILE, 'utf8')
  if (!data) return []
  const lines = data.trim().split(/\r?\n/)
  const batch = lines.slice(0, max).map(l => JSON.parse(l))
  const remaining = lines.slice(batch.length)
  fs.writeFileSync(QUEUE_FILE, remaining.join('\n') + (remaining.length ? '\n' : ''), 'utf8')
  return batch
}

export function peekCount(): number {
  if (!fs.existsSync(QUEUE_FILE)) return 0
  const stats = fs.statSync(QUEUE_FILE)
  if (stats.size === 0) return 0
  const data = fs.readFileSync(QUEUE_FILE, 'utf8')
  if (!data) return 0
  return data.trim().split(/\r?\n/).length
}

export function flushAll(): any[] {
  ensureDir()
  if (!fs.existsSync(QUEUE_FILE)) return []
  const data = fs.readFileSync(QUEUE_FILE, 'utf8')
  if (!data) return []
  const items = data.trim().split(/\r?\n/).map(l => JSON.parse(l))
  fs.writeFileSync(QUEUE_FILE, '', 'utf8')
  return items
}
