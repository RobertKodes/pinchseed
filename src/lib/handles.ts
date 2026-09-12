/** A contact / peg on the stage, in 0..1 coordinates. */
export type Handle = {
  x: number
  y: number
}

export const HANDLE_PAD = 0.07
export const MIN_SCALE = 0.1
export const MAX_SCALE = 1.22

export function restHandles(): { a: Handle; b: Handle } {
  return { a: { x: 0.3, y: 0.52 }, b: { x: 0.7, y: 0.52 } }
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

export function clampHandle(p: Handle, pad = HANDLE_PAD): Handle {
  return {
    x: Math.min(1 - pad, Math.max(pad, p.x)),
    y: Math.min(1 - pad, Math.max(pad, p.y)),
  }
}

export function midpoint(a: Handle, b: Handle): Handle {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function distance(a: Handle, b: Handle): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function angleOf(a: Handle, b: Handle): number {
  return Math.atan2(b.y - a.y, b.x - a.x)
}

export function hitHandle(p: Handle, x: number, y: number, radius = 0.07): boolean {
  return Math.hypot(x - p.x, y - p.y) <= radius
}

/** Distance from a point to the segment between two handles. */
export function distToBand(a: Handle, b: Handle, x: number, y: number): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-8) return Math.hypot(x - a.x, y - a.y)
  const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len2))
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t))
}

export function hitBand(a: Handle, b: Handle, x: number, y: number, radius = 0.045): boolean {
  return distToBand(a, b, x, y) <= radius
}

function placeAround(
  mid: Handle,
  scale: number,
  twist: number,
): { a: Handle; b: Handle } {
  const hx = Math.cos(twist) * (scale / 2)
  const hy = Math.sin(twist) * (scale / 2)
  return {
    a: clampHandle({ x: mid.x - hx, y: mid.y - hy }),
    b: clampHandle({ x: mid.x + hx, y: mid.y + hy }),
  }
}

export function applyScale(
  a: Handle,
  b: Handle,
  nextScale: number,
  min = MIN_SCALE,
  max = MAX_SCALE,
): { a: Handle; b: Handle } {
  const mid = midpoint(a, b)
  const twist = angleOf(a, b)
  const scale = Math.min(max, Math.max(min, nextScale))
  return placeAround(mid, scale, twist)
}

export function applyTwist(a: Handle, b: Handle, deltaRad: number): { a: Handle; b: Handle } {
  const mid = midpoint(a, b)
  const scale = Math.max(MIN_SCALE, distance(a, b))
  return placeAround(mid, scale, angleOf(a, b) + deltaRad)
}

export function translatePair(a: Handle, b: Handle, dx: number, dy: number): { a: Handle; b: Handle } {
  const nextA = clampHandle({ x: a.x + dx, y: a.y + dy })
  const usedX = nextA.x - a.x
  const usedY = nextA.y - a.y
  const nextB = clampHandle({ x: b.x + usedX, y: b.y + usedY })
  const lockX = nextB.x - b.x
  const lockY = nextB.y - b.y
  return {
    a: clampHandle({ x: a.x + lockX, y: a.y + lockY }),
    b: nextB,
  }
}

export function nearestHandle(a: Handle, b: Handle, x: number, y: number): 'a' | 'b' {
  const da = Math.hypot(x - a.x, y - a.y)
  const db = Math.hypot(x - b.x, y - b.y)
  return da <= db ? 'a' : 'b'
}
