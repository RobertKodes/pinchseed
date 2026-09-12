import { describe, expect, it } from 'vitest'
import {
  TARGET_SAMPLES,
  TRAIL_DOMAIN,
  emptyTrail,
  normalizeTrail,
  packTrail,
  quantizeScale,
  quantizeTwist,
  resampleTrail,
  restSample,
  trailExtent,
  unwrapTwist,
  type PinchSample,
  type PinchTrail,
} from './trail'

function sample(scale: number, twist: number): PinchSample {
  return { scale, twist }
}

function trail(samples: PinchSample[]): PinchTrail {
  return { samples }
}

describe('quantizeScale', () => {
  it('maps rest length 0.4 onto 1e-4 of √2', () => {
    expect(quantizeScale(0.4)).toBe(Math.round((0.4 / Math.SQRT2) * 10_000))
  })

  it('clamps to 0..10000', () => {
    expect(quantizeScale(-0.2)).toBe(0)
    expect(quantizeScale(4)).toBe(10_000)
  })
})

describe('quantizeTwist', () => {
  it('stores tenths of a degree', () => {
    expect(quantizeTwist(0)).toBe(0)
    expect(quantizeTwist(Math.PI / 2)).toBe(900)
  })
})

describe('unwrapTwist', () => {
  it('keeps a crossing of ±π continuous', () => {
    const out = unwrapTwist([sample(0.4, 3.0), sample(0.4, -3.1)])
    expect(out[1]!.twist).toBeGreaterThan(3)
  })
})

describe('resampleTrail', () => {
  it('emits a fixed pose count', () => {
    const samples = [sample(0.2, 0), sample(0.5, 0.4), sample(0.8, -0.2)]
    expect(resampleTrail(samples).length).toBe(TARGET_SAMPLES)
  })

  it('repeats a single pose', () => {
    const one = [sample(0.4, 0.1)]
    const out = resampleTrail(one, 4)
    expect(out).toHaveLength(4)
    expect(out.every((s) => s.scale === 0.4 && s.twist === 0.1)).toBe(true)
  })

  it('interpolates endpoints', () => {
    const out = resampleTrail([sample(0.2, 0), sample(0.8, 1)], 3)
    expect(out[0]?.scale).toBeCloseTo(0.2)
    expect(out[1]?.scale).toBeCloseTo(0.5)
    expect(out[2]?.scale).toBeCloseTo(0.8)
    expect(out[1]?.twist).toBeCloseTo(0.5)
  })
})

describe('packTrail', () => {
  it('writes 4 bytes per resampled pose', () => {
    const bytes = packTrail(trail([restSample()]))
    expect(bytes.byteLength).toBe(TARGET_SAMPLES * 4)
    const view = new DataView(bytes.buffer)
    expect(view.getInt16(0, true)).toBe(quantizeScale(restSample().scale))
    expect(view.getInt16(2, true)).toBe(quantizeTwist(restSample().twist))
  })
})

describe('normalizeTrail', () => {
  it('rejects an empty trail', () => {
    expect(() => normalizeTrail(emptyTrail())).toThrow(/empty trail/)
  })

  it('prefixes the domain and a fixed window', () => {
    const bytes = normalizeTrail(trail([restSample()]))
    const domain = new TextEncoder().encode(TRAIL_DOMAIN)
    expect(bytes.slice(0, domain.length)).toEqual(domain)
    expect(bytes.byteLength).toBe(domain.length + TARGET_SAMPLES * 4)
  })

  it('is stable for the same path at different tempos', () => {
    const slow = trail([sample(0.2, 0), sample(0.5, 0.4), sample(0.8, 0.2)])
    const fast = trail([
      sample(0.2, 0),
      sample(0.35, 0.2),
      sample(0.5, 0.4),
      sample(0.65, 0.3),
      sample(0.8, 0.2),
    ])
    expect(normalizeTrail(slow)).toEqual(normalizeTrail(fast))
  })

  it('changes when the stretch path changes', () => {
    const a = normalizeTrail(trail([sample(0.2, 0), sample(0.8, 0)]))
    const b = normalizeTrail(trail([sample(0.2, 0), sample(0.3, 0)]))
    expect(a).not.toEqual(b)
  })

  it('changes when the twist path changes', () => {
    const a = normalizeTrail(trail([sample(0.4, 0), sample(0.4, 0.8)]))
    const b = normalizeTrail(trail([sample(0.4, 0), sample(0.4, -0.8)]))
    expect(a).not.toEqual(b)
  })

  it('treats a full extra turn as a different trail', () => {
    const steps = (end: number, n = 9): PinchSample[] =>
      Array.from({ length: n }, (_, i) => sample(0.4, (end * i) / (n - 1)))
    const a = normalizeTrail(trail(steps(Math.PI / 2)))
    const b = normalizeTrail(trail(steps(Math.PI / 2 + Math.PI * 2)))
    expect(a).not.toEqual(b)
  })
})

describe('trailExtent', () => {
  it('is zero for a still hold', () => {
    const p = restSample()
    expect(trailExtent(trail([p, { ...p }]))).toBe(0)
  })

  it('grows with a spread', () => {
    expect(trailExtent(trail([sample(0.2, 0), sample(0.9, 0)]))).toBeGreaterThan(0.4)
  })
})
