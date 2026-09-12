import { describe, expect, it } from 'vitest'
import { chipsFromAddress, formatCallsign, seedFromTrail } from './seed'
import { restSample, type PinchSample, type PinchTrail } from './trail'

function sample(scale: number, twist: number): PinchSample {
  return { scale, twist }
}

function trail(samples: PinchSample[]): PinchTrail {
  return { samples }
}

describe('seedFromTrail', () => {
  it('hashes the same trail to the same callsign', async () => {
    const pinch = trail([sample(0.28, -0.2), sample(0.62, 0.4), sample(0.44, 0.15)])
    const once = await seedFromTrail(pinch)
    const twice = await seedFromTrail(pinch)
    expect(once.address).toBe(twice.address)
    expect(once.hashHex).toBe(twice.hashHex)
    expect(once.address.length).toBeGreaterThanOrEqual(32)
    expect(once.address.length).toBeLessThanOrEqual(44)
    expect(once.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/)
    expect(once.chips).toEqual(chipsFromAddress(once.address))
    expect(once.samples).toBe(3)
    expect(once.still).toBe(false)
  })

  it('changes when the trail changes', async () => {
    const a = await seedFromTrail(trail([sample(0.2, 0), sample(0.8, 0.3)]))
    const b = await seedFromTrail(trail([sample(0.2, 0), sample(0.3, 0.3)]))
    expect(a.address).not.toBe(b.address)
  })

  it('marks a still pinch', async () => {
    const p = restSample()
    const seed = await seedFromTrail(trail([p, { ...p }]))
    expect(seed.still).toBe(true)
    expect(seed.extent).toBe(0)
  })

  it('groups the callsign for the plate', async () => {
    const seed = await seedFromTrail(trail([restSample()]))
    expect(formatCallsign(seed.address).includes(' ')).toBe(true)
  })

  it('locks a known rest-point vector', async () => {
    const seed = await seedFromTrail(trail([restSample()]))
    expect(seed.hashHex).toBe(
      '17529bc54006c1dda3c1da09a224e977a53c325861e6c4626743baa87a0bd482',
    )
  })
})
