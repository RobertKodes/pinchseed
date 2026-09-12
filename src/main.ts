import './style.css'
import { copyText } from './lib/clipboard'
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
  type Handle,
} from './lib/handles'
import { formatCallsign, seedFromTrail, type Seed } from './lib/seed'
import { sampleOf, type PinchSample } from './lib/trail'
import { eventToStage, paintStage, type Phase } from './stage'

const desk = document.querySelector<HTMLElement>('#desk')!
const statusEl = document.querySelector<HTMLElement>('#status')!
const lampEl = document.querySelector<HTMLElement>('#lamp')!
const hintEl = document.querySelector<HTMLElement>('#hint')!
const stage = document.querySelector<HTMLCanvasElement>('#stage')!
const plate = document.querySelector<HTMLElement>('#plate')!
const addressEl = document.querySelector<HTMLElement>('#address')!
const chipsEl = document.querySelector<HTMLElement>('#chips')!
const crumb = document.querySelector<HTMLElement>('#crumb')!
const copyBtn = document.querySelector<HTMLButtonElement>('#copy')!
const againBtn = document.querySelector<HTMLButtonElement>('#again')!

type Role = 'a' | 'b' | 'mid' | 'twist'

type PointerBind = {
  role: Role
  x: number
  y: number
}

const RELEASE_MS = 420
const MAX_MS = 8000
const SAMPLE_EPS = 0.0012

let phase: Phase = 'ready'
let handles = restHandles()
let seed: Seed | null = null
let developing = false
let copyReset = 0
let releaseTimer = 0
let captureStarted = 0
let liveTrail: PinchSample[] = []
let source: 'touch' | 'mouse' | 'mix' = 'mouse'
let sawTouch = false
let sawMouse = false

const pointers = new Map<number, PointerBind>()
let twistAngle: number | null = null
let gestureOrigin: { scale: number; twist: number } | null = null

function setStatus(text: string): void {
  statusEl.textContent = text
}

function setPhase(next: Phase): void {
  phase = next
  desk.dataset.state = next
  lampEl.textContent = next
}

function liveHint(): string {
  const s = sampleOf(handles.a, handles.b)
  const deg = ((s.twist * 180) / Math.PI).toFixed(0)
  return `scale ${s.scale.toFixed(2)} · twist ${deg}°`
}

function showPlate(next: Seed): void {
  seed = next
  plate.hidden = false
  addressEl.textContent = formatCallsign(next.address)
  chipsEl.replaceChildren(
    ...next.chips.map((chip) => {
      const el = document.createElement('span')
      el.className = 'chip'
      el.textContent = chip
      return el
    }),
  )
  const how = source
  crumb.textContent = next.still
    ? `still pinch · ${how} · ${next.hashHex.slice(0, 8)}`
    : `${next.samples} poses · ${how} · ${next.hashHex.slice(0, 8)}`
  setStatus(next.still ? 'callsign from a still pinch' : 'callsign on the plate')
  setPhase('seeded')
  copyBtn.textContent = 'copy address'
}

function clearPlate(): void {
  seed = null
  plate.hidden = true
  addressEl.textContent = ''
  chipsEl.replaceChildren()
  crumb.textContent = ''
}

function resetToy(): void {
  handles = restHandles()
  liveTrail = []
  pointers.clear()
  twistAngle = null
  gestureOrigin = null
  developing = false
  captureStarted = 0
  window.clearTimeout(releaseTimer)
  sawTouch = false
  sawMouse = false
  source = 'mouse'
}

function noteSource(pointerType: string): void {
  if (pointerType === 'touch') sawTouch = true
  else sawMouse = true
  source = sawTouch && sawMouse ? 'mix' : sawTouch ? 'touch' : 'mouse'
}

function pushSample(force = false): void {
  const next = sampleOf(handles.a, handles.b)
  const last = liveTrail[liveTrail.length - 1]
  if (
    !force &&
    last &&
    Math.abs(next.scale - last.scale) < SAMPLE_EPS &&
    Math.abs(next.twist - last.twist) < SAMPLE_EPS
  ) {
    return
  }
  liveTrail.push(next)
}

function beginPinch(): void {
  if (phase === 'pinching') return
  clearPlate()
  liveTrail = []
  captureStarted = performance.now()
  setPhase('pinching')
  setStatus('pinch, spread, or twist — lift to seed')
  pushSample(true)
}

function currentTrail(): PinchSample[] {
  return liveTrail.length > 0 ? liveTrail : [sampleOf(handles.a, handles.b)]
}

async function develop(): Promise<void> {
  if (developing) return
  developing = true
  window.clearTimeout(releaseTimer)
  pointers.clear()
  twistAngle = null
  setStatus('hashing the stretch')
  try {
    const samples = currentTrail()
    showPlate(await seedFromTrail({ samples }))
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'could not hash that pinch')
    resetToy()
    setPhase('ready')
    setStatus('stretch the band — two fingers, or drag the pegs')
  } finally {
    developing = false
  }
}

function scheduleRelease(): void {
  window.clearTimeout(releaseTimer)
  if (pointers.size > 0 || developing) return
  releaseTimer = window.setTimeout(() => {
    if (phase === 'pinching' && pointers.size === 0) void develop()
  }, RELEASE_MS)
}

function setHandle(role: 'a' | 'b', next: Handle): void {
  const peg = clampHandle(next)
  handles = role === 'a' ? { a: peg, b: handles.b } : { a: handles.a, b: peg }
}

function assignRole(x: number, y: number, shift: boolean): Role {
  if (shift) return 'twist'
  if (hitHandle(handles.a, x, y)) return 'a'
  if (hitHandle(handles.b, x, y)) return 'b'
  const bound = [...pointers.values()].map((p) => p.role)
  if (bound.includes('a') && !bound.includes('b')) return 'b'
  if (bound.includes('b') && !bound.includes('a')) return 'a'
  if (hitBand(handles.a, handles.b, x, y)) return 'mid'
  return nearestHandle(handles.a, handles.b, x, y)
}

function applyPointer(bind: PointerBind, x: number, y: number): void {
  if (bind.role === 'a') {
    setHandle('a', { x, y })
  } else if (bind.role === 'b') {
    setHandle('b', { x, y })
  } else if (bind.role === 'mid') {
    handles = translatePair(handles.a, handles.b, x - bind.x, y - bind.y)
  } else {
    const mid = midpoint(handles.a, handles.b)
    const angle = Math.atan2(y - mid.y, x - mid.x)
    if (twistAngle !== null) handles = applyTwist(handles.a, handles.b, angle - twistAngle)
    twistAngle = angle
  }
  bind.x = x
  bind.y = y
}

function grabbedRoles(): Set<Role> {
  return new Set([...pointers.values()].map((p) => p.role))
}

function bindStage(): void {
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || developing) return
    const { x, y } = eventToStage(stage, event.clientX, event.clientY)
    event.preventDefault()
    stage.setPointerCapture(event.pointerId)
    noteSource(event.pointerType)
    window.clearTimeout(releaseTimer)
    if (phase === 'seeded' || phase === 'ready') beginPinch()
    const role = assignRole(x, y, event.shiftKey)
    if (role === 'twist') {
      const mid = midpoint(handles.a, handles.b)
      twistAngle = Math.atan2(y - mid.y, x - mid.x)
    }
    if (role === 'a' && !hitHandle(handles.a, x, y) && pointers.size > 0) {
      setHandle('a', { x, y })
    }
    if (role === 'b' && !hitHandle(handles.b, x, y) && pointers.size > 0) {
      setHandle('b', { x, y })
    }
    const bind: PointerBind = { role, x, y }
    pointers.set(event.pointerId, bind)
    applyPointer(bind, x, y)
    pushSample()
    hintEl.textContent = liveHint()
  }

  const onMove = (event: PointerEvent) => {
    const bind = pointers.get(event.pointerId)
    if (!bind) return
    event.preventDefault()
    const { x, y } = eventToStage(stage, event.clientX, event.clientY)
    applyPointer(bind, x, y)
    if (phase !== 'pinching') beginPinch()
    pushSample()
    hintEl.textContent = liveHint()
  }

  const onUp = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return
    event.preventDefault()
    if (stage.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId)
    }
    pointers.delete(event.pointerId)
    if (![...pointers.values()].some((p) => p.role === 'twist')) twistAngle = null
    if (phase === 'pinching') scheduleRelease()
  }

  stage.addEventListener('pointerdown', onDown)
  stage.addEventListener('pointermove', onMove)
  stage.addEventListener('pointerup', onUp)
  stage.addEventListener('pointercancel', onUp)
  stage.addEventListener('lostpointercapture', (event) => {
    if (pointers.has(event.pointerId)) {
      pointers.delete(event.pointerId)
      if (phase === 'pinching') scheduleRelease()
    }
  })
  stage.addEventListener('contextmenu', (event) => event.preventDefault())

  stage.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      if (developing) return
      noteSource('mouse')
      if (phase === 'seeded' || phase === 'ready') beginPinch()
      const factor = event.ctrlKey ? 0.012 : 0.0024
      const next = distance(handles.a, handles.b) * (1 - event.deltaY * factor)
      handles = applyScale(handles.a, handles.b, next)
      if (event.shiftKey) {
        handles = applyTwist(handles.a, handles.b, event.deltaX * 0.01 + event.deltaY * 0.004)
      }
      pushSample()
      hintEl.textContent = liveHint()
      scheduleRelease()
    },
    { passive: false },
  )

  stage.addEventListener('gesturestart', (event) => {
    event.preventDefault()
    if (developing) return
    noteSource('touch')
    if (phase === 'seeded' || phase === 'ready') beginPinch()
    gestureOrigin = {
      scale: distance(handles.a, handles.b),
      twist: 0,
    }
  })
  stage.addEventListener('gesturechange', (event) => {
    event.preventDefault()
    if (!gestureOrigin || developing) return
    handles = applyScale(handles.a, handles.b, gestureOrigin.scale * event.scale)
    const rot = ((event.rotation || 0) * Math.PI) / 180
    handles = applyTwist(handles.a, handles.b, rot - gestureOrigin.twist)
    gestureOrigin.twist = rot
    pushSample()
    hintEl.textContent = liveHint()
  })
  stage.addEventListener('gestureend', (event) => {
    event.preventDefault()
    gestureOrigin = null
    if (phase === 'pinching') scheduleRelease()
  })
}

function bindKeys(): void {
  window.addEventListener('keydown', (event) => {
    const typing =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    if (typing || developing) return

    if (event.key === 'Escape') {
      event.preventDefault()
      clearPlate()
      resetToy()
      setPhase('ready')
      setStatus('stretch the band — two fingers, or drag the pegs')
      hintEl.textContent = 'mouse: drag pegs · wheel to pinch · shift-drag to twist'
      return
    }

    if (event.key === 'Enter' && phase === 'pinching') {
      event.preventDefault()
      void develop()
      return
    }

    const step = event.shiftKey ? 0.04 : 0.02
    let used = false
    if (event.key === '+' || event.key === '=' || event.key === '-') {
      const dir = event.key === '-' ? -1 : 1
      handles = applyScale(handles.a, handles.b, distance(handles.a, handles.b) + dir * step)
      used = true
    } else if (event.key === '[' || event.key === ']') {
      handles = applyTwist(handles.a, handles.b, event.key === ']' ? 0.08 : -0.08)
      used = true
    } else if (event.key === 'ArrowLeft') {
      handles = translatePair(handles.a, handles.b, -step, 0)
      used = true
    } else if (event.key === 'ArrowRight') {
      handles = translatePair(handles.a, handles.b, step, 0)
      used = true
    } else if (event.key === 'ArrowUp') {
      handles = translatePair(handles.a, handles.b, 0, -step)
      used = true
    } else if (event.key === 'ArrowDown') {
      handles = translatePair(handles.a, handles.b, 0, step)
      used = true
    }

    if (!used) return
    event.preventDefault()
    noteSource('mouse')
    if (phase === 'seeded' || phase === 'ready') beginPinch()
    pushSample()
    hintEl.textContent = liveHint()
    scheduleRelease()
  })
}

function bindPlate(): void {
  copyBtn.addEventListener('click', async () => {
    if (!seed) return
    const ok = await copyText(seed.address)
    copyBtn.textContent = ok ? 'copied' : 'copy failed'
    window.clearTimeout(copyReset)
    copyReset = window.setTimeout(() => {
      copyBtn.textContent = 'copy address'
    }, 1400)
  })
  againBtn.addEventListener('click', () => {
    clearPlate()
    resetToy()
    setPhase('ready')
    setStatus('stretch the band — two fingers, or drag the pegs')
    hintEl.textContent = 'mouse: drag pegs · wheel to pinch · shift-drag to twist'
  })
}

function loop(now: number): void {
  if (phase === 'pinching' && captureStarted && now - captureStarted >= MAX_MS) {
    void develop()
  }
  paintStage(stage, {
    a: handles.a,
    b: handles.b,
    trail: phase === 'ready' ? [] : liveTrail,
    grabbed: grabbedRoles(),
    phase,
    now,
  })
  requestAnimationFrame(loop)
}

function boot(): void {
  bindStage()
  bindKeys()
  bindPlate()
  resetToy()
  setPhase('ready')
  setStatus('stretch the band — two fingers, or drag the pegs')
  requestAnimationFrame(loop)
}

boot()
