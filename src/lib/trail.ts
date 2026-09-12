import { distance, restHandles, type Handle } from './handles'

/** One pose on the pinch trail: stretch length + band angle. */
export type PinchSample = {
  scale: number
  twist: number
}

/**
 * A finished pinch: contact-pair scale (stage units) and twist (radians)
 * sampled over the gesture.
 */
export type PinchTrail = {
  samples: PinchSample[]
}

/** Fixed pose count so sample rate does not change the hash — the path does. */
export const TARGET_SAMPLES = 48

/** Domain separator mixed into the digest. */
export const TRAIL_DOMAIN = 'pinchseed\n'

const SCALE_POS = 10_000
const SCALE_TWIST = 10
const MAX_STAGE = Math.SQRT2

export function restSample(): PinchSample {
  const { a, b } = restHandles()
  return sampleOf(a, b)
}

export function emptyTrail(): PinchTrail {
  return { samples: [] }
}

export function sampleOf(a: Handle, b: Handle): PinchSample {
  return {
    scale: distance(a, b),
    twist: Math.atan2(b.y - a.y, b.x - a.x),
  }
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

export function quantizeScale(scale: number): number {
  const unit = clamp01(scale / MAX_STAGE)
  const q = Math.round(unit * SCALE_POS)
  return Math.min(SCALE_POS, Math.max(0, q))
}

export function quantizeTwist(rad: number): number {
  const deg = (rad * 180) / Math.PI
  const q = Math.round(deg * SCALE_TWIST)
  return Math.min(32767, Math.max(-32768, q))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpSample(a: PinchSample, b: PinchSample, t: number): PinchSample {
  return {
    scale: lerp(a.scale, b.scale, t),
    twist: lerp(a.twist, b.twist, t),
  }
}

/** Unwrap twist so resampling does not jump across ±π. */
export function unwrapTwist(samples: readonly PinchSample[]): PinchSample[] {
  if (samples.length === 0) return []
  const out = samples.map((s) => ({ ...s }))
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1]!
    const cur = out[i]!
    let d = cur.twist - prev.twist
    while (d > Math.PI) {
      cur.twist -= Math.PI * 2
      d -= Math.PI * 2
    }
    while (d < -Math.PI) {
      cur.twist += Math.PI * 2
      d += Math.PI * 2
    }
  }
  return out
}

export function resampleTrail(
  samples: readonly PinchSample[],
  count = TARGET_SAMPLES,
): PinchSample[] {
  if (count < 1) return []
  if (samples.length === 0) return []
  if (samples.length === 1) {
    return Array.from({ length: count }, () => ({ ...samples[0]! }))
  }

  const unwrapped = unwrapTwist(samples)
  const out: PinchSample[] = []
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * (unwrapped.length - 1)
    const i0 = Math.floor(t)
    const i1 = Math.min(unwrapped.length - 1, i0 + 1)
    const f = t - i0
    out.push(lerpSample(unwrapped[i0]!, unwrapped[i1]!, f))
  }
  return out
}

/** Little-endian int16 pairs: scale (1e-4 of √2), twist (0.1°). */
export function packTrail(trail: PinchTrail): Uint8Array {
  const samples = resampleTrail(trail.samples, TARGET_SAMPLES)
  const bytes = new Uint8Array(samples.length * 4)
  const view = new DataView(bytes.buffer)
  let o = 0
  for (const s of samples) {
    view.setInt16(o, quantizeScale(s.scale), true)
    o += 2
    view.setInt16(o, quantizeTwist(s.twist), true)
    o += 2
  }
  return bytes
}

export function normalizeTrail(trail: PinchTrail): Uint8Array {
  if (trail.samples.length === 0) {
    throw new Error('empty trail')
  }
  const packed = packTrail(trail)
  const domain = new TextEncoder().encode(TRAIL_DOMAIN)
  const out = new Uint8Array(domain.length + packed.length)
  out.set(domain, 0)
  out.set(packed, domain.length)
  return out
}

/** Gesture travel: scale path + twist path (radians). */
export function trailExtent(trail: PinchTrail): number {
  let length = 0
  const unwrapped = unwrapTwist(trail.samples)
  for (let i = 1; i < unwrapped.length; i++) {
    const a = unwrapped[i - 1]!
    const b = unwrapped[i]!
    const dScale = (b.scale - a.scale) / MAX_STAGE
    const dTwist = (b.twist - a.twist) / Math.PI
    length += Math.hypot(dScale, dTwist)
  }
  return length
}

export function stillThreshold(): number {
  return 0.035
}
