import { describe, expect, it } from 'vitest'
import {
  applyScale,
  applyTwist,
  clampHandle,
  distance,
  hitBand,
  hitHandle,
  midpoint,
  nearestHandle,
  restHandles,
  translatePair,
} from './handles'

describe('restHandles', () => {
  it('sits on a horizontal band of length 0.4', () => {
    const { a, b } = restHandles()
    expect(distance(a, b)).toBeCloseTo(0.4)
    expect(a.y).toBeCloseTo(b.y)
    expect(midpoint(a, b).x).toBeCloseTo(0.5)
  })
})

describe('clampHandle', () => {
  it('keeps pegs inside the slab pad', () => {
    const p = clampHandle({ x: -1, y: 2 })
    expect(p.x).toBeCloseTo(0.07)
    expect(p.y).toBeCloseTo(0.93)
  })
})

describe('applyScale', () => {
  it('spreads around the midpoint', () => {
    const { a, b } = restHandles()
    const next = applyScale(a, b, 0.8)
    expect(distance(next.a, next.b)).toBeCloseTo(0.8)
    expect(midpoint(next.a, next.b).x).toBeCloseTo(0.5)
    expect(midpoint(next.a, next.b).y).toBeCloseTo(0.52)
  })

  it('clamps a vanishing pinch to the minimum', () => {
    const { a, b } = restHandles()
    const next = applyScale(a, b, 0.01)
    expect(distance(next.a, next.b)).toBeCloseTo(0.1)
  })
})

describe('applyTwist', () => {
  it('rotates the pair without changing length', () => {
    const { a, b } = restHandles()
    const next = applyTwist(a, b, Math.PI / 2)
    expect(distance(next.a, next.b)).toBeCloseTo(0.4)
    expect(next.b.x).toBeCloseTo(next.a.x)
    expect(next.b.y).toBeGreaterThan(next.a.y)
  })
})

describe('translatePair', () => {
  it('slides both pegs together', () => {
    const { a, b } = restHandles()
    const next = translatePair(a, b, 0, -0.1)
    expect(next.a.y).toBeCloseTo(0.42)
    expect(next.b.y).toBeCloseTo(0.42)
    expect(distance(next.a, next.b)).toBeCloseTo(0.4)
  })
})

describe('hit tests', () => {
  it('finds a peg and the rubber between them', () => {
    const { a, b } = restHandles()
    expect(hitHandle(a, 0.3, 0.52)).toBe(true)
    expect(hitHandle(a, 0.9, 0.1)).toBe(false)
    expect(hitBand(a, b, 0.5, 0.52)).toBe(true)
    expect(nearestHandle(a, b, 0.2, 0.5)).toBe('a')
    expect(nearestHandle(a, b, 0.9, 0.5)).toBe('b')
  })
})
