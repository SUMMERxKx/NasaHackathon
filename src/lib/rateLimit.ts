// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The question limit for Ask EMBER, shared by the server function and the chat panel.
// The server keeps it per address in each running instance and the panel keeps it per browser.
// Neither is a hard stop. The hard stop is the daily spending limit on the model key.

// 60 an hour, not 40, so one evaluation run of 45 live questions fits in an hour from one address.
export const RATE_LIMITS = [
  { windowMs: 60_000, max: 6 },
  { windowMs: 3_600_000, max: 60 },
]

export const RATE_MESSAGE = 'You have asked several questions in a short time. Wait a minute, then ask again.'

export type RateCheck = { ok: true; times: number[] } | { ok: false; times: number[]; retryAfterMs: number }

// times holds earlier request times. On ok, the returned list includes now.
export function checkRate(times: number[], now: number, limits = RATE_LIMITS): RateCheck {
  const longest = Math.max(...limits.map((l) => l.windowMs))
  const recent = times.filter((t) => t > now - longest && t <= now)
  let retryAfterMs = 0
  for (const limit of limits) {
    const inWindow = recent.filter((t) => t > now - limit.windowMs)
    if (inWindow.length >= limit.max) retryAfterMs = Math.max(retryAfterMs, inWindow[inWindow.length - limit.max] + limit.windowMs - now)
  }
  if (retryAfterMs > 0) return { ok: false, times: recent, retryAfterMs }
  return { ok: true, times: [...recent, now] }
}

export type RateLimiter = (key: string, now?: number) => RateCheck

// One instance's memory of who asked when. Old addresses are dropped once the map is full.
export function createRateLimiter(limits = RATE_LIMITS, maxKeys = 5000): RateLimiter {
  const seen = new Map<string, number[]>()
  return (key, now = Date.now()) => {
    const result = checkRate(seen.get(key) ?? [], now, limits)
    seen.delete(key)
    if (result.times.length > 0) seen.set(key, result.times)
    while (seen.size > maxKeys) seen.delete(seen.keys().next().value as string)
    return result
  }
}
