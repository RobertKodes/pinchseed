import { prefersReducedMotion } from './lib/clipboard'
import { distance, midpoint, restHandles, type Handle } from './lib/handles'
import type { PinchSample } from './lib/trail'

export type Phase = 'ready' | 'pinching' | 'seeded'

export type StagePaint = {
  a: Handle
  b: Handle
  trail: readonly PinchSample[]
  grabbed: ReadonlySet<'a' | 'b' | 'mid' | 'twist'>
  phase: Phase
  now: number
}

export function resizeCanvas(canvas: HTMLCanvasElement): { w: number; h: number } {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(2.5, window.devicePixelRatio || 1)
  const w = Math.max(1, Math.round(rect.width * dpr))
  const h = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  return { w, h }
}

export function eventToStage(canvas: HTMLCanvasElement, clientX: number, clientY: number): {
  x: number
  y: number
} {
  const rect = canvas.getBoundingClientRect()
  const x = (clientX - rect.left) / Math.max(1, rect.width)
  const y = (clientY - rect.top) / Math.max(1, rect.height)
  return { x, y }
}

function clayFill(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const field = ctx.createRadialGradient(w * 0.46, h * 0.38, h * 0.06, w * 0.5, h * 0.55, h * 0.95)
  field.addColorStop(0, '#e2a078')
  field.addColorStop(0.38, '#c47854')
  field.addColorStop(0.78, '#9a4e34')
  field.addColorStop(1, '#6e3220')
  ctx.fillStyle = field
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = '#5a2818'
  ctx.lineWidth = Math.max(1, h * 0.0035)
  const rings = 7
  for (let i = 1; i <= rings; i++) {
    ctx.beginPath()
    ctx.ellipse(w * 0.5, h * 0.52, (w * 0.46 * i) / rings, (h * 0.4 * i) / rings, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 0.08
  ctx.fillStyle = '#fff6e8'
  ctx.beginPath()
  ctx.ellipse(w * 0.34, h * 0.28, w * 0.22, h * 0.1, -0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function clayRim(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const t = Math.max(9, Math.round(h * 0.05))
  ctx.save()
  ctx.strokeStyle = '#4a2c1c'
  ctx.lineWidth = t
  ctx.strokeRect(t / 2, t / 2, w - t, h - t)
  ctx.strokeStyle = '#d4a04a'
  ctx.lineWidth = Math.max(1.4, t * 0.16)
  ctx.strokeRect(t * 0.7, t * 0.7, w - t * 1.4, h - t * 1.4)
  ctx.restore()
}

function paintGhost(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  trail: readonly PinchSample[],
  a: Handle,
  b: Handle,
): void {
  if (trail.length < 2) return
  const rest = restHandles()
  const restLen = distance(rest.a, rest.b)
  const mid = midpoint(a, b)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#f6ead4'
  ctx.globalAlpha = 0.22
  ctx.lineWidth = Math.max(1.2, h * 0.006)
  ctx.beginPath()
  for (let i = 0; i < trail.length; i++) {
    const s = trail[i]!
    const t = i / Math.max(1, trail.length - 1)
    const px = mid.x * w + Math.cos(s.twist) * (s.scale / restLen) * w * 0.04
    const py = mid.y * h + Math.sin(s.twist) * (s.scale / restLen) * h * 0.04 - t * h * 0.02
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.restore()
}

function paintSheet(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  a: Handle,
  b: Handle,
  phase: Phase,
  now: number,
): void {
  const ax = a.x * w
  const ay = a.y * h
  const bx = b.x * w
  const by = b.y * h
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const len = Math.hypot(bx - ax, by - ay)
  const rest = distance(restHandles().a, restHandles().b) * Math.min(w, h)
  const tension = Math.min(2.2, len / Math.max(1, rest))
  const slack = Math.max(0, 1.05 - tension)
  const nx = -(by - ay) / Math.max(1, len)
  const ny = (bx - ax) / Math.max(1, len)
  const sag = slack * h * 0.09
  const cx = mx + nx * sag
  const cy = my + ny * sag
  const taut = Math.min(1, Math.max(0, tension - 0.85))

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const folds = 9
  ctx.globalAlpha = 0.22 + taut * 0.12
  ctx.strokeStyle = phase === 'seeded' ? '#f0d48a' : '#f6c8a0'
  ctx.lineWidth = Math.max(1, h * 0.005)
  for (let i = 1; i < folds; i++) {
    const t = i / folds
    const px = ax + (bx - ax) * t
    const py = ay + (by - ay) * t
    const bow = Math.sin(t * Math.PI) * sag * 0.7
    const wave = Math.sin(t * Math.PI * 4 + (phase === 'pinching' ? now * 0.004 : 0)) * h * 0.008
    const fx = px + nx * (bow + wave)
    const fy = py + ny * (bow + wave)
    const half = (0.018 + slack * 0.03 - taut * 0.008) * Math.min(w, h)
    ctx.beginPath()
    ctx.moveTo(fx - nx * half, fy - ny * half)
    ctx.lineTo(fx + nx * half, fy + ny * half)
    ctx.stroke()
  }

  const body = ctx.createLinearGradient(ax, ay, bx, by)
  body.addColorStop(0, '#f06a52')
  body.addColorStop(0.5, taut > 0.45 ? '#f0b45a' : '#e24b3a')
  body.addColorStop(1, '#c8382c')
  ctx.strokeStyle = body
  ctx.globalAlpha = 0.94
  ctx.lineWidth = Math.max(5, h * (0.034 - taut * 0.01))
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.quadraticCurveTo(cx, cy, bx, by)
  ctx.stroke()

  ctx.strokeStyle = '#fff3e0'
  ctx.globalAlpha = 0.28 + slack * 0.12
  ctx.lineWidth = Math.max(1.6, h * 0.008)
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.quadraticCurveTo(cx - nx * 4, cy - ny * 4, bx, by)
  ctx.stroke()
  ctx.restore()
}

function paintPeg(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  peg: Handle,
  grabbed: boolean,
  phase: Phase,
  now: number,
  label: 'a' | 'b',
): void {
  const cx = peg.x * w
  const cy = peg.y * h
  const r = Math.max(10, Math.min(w, h) * 0.048)

  ctx.save()
  ctx.fillStyle = 'rgba(28, 16, 10, 0.28)'
  ctx.beginPath()
  ctx.ellipse(cx + r * 0.08, cy + r * 0.42, r * 0.86, r * 0.28, 0, 0, Math.PI * 2)
  ctx.fill()

  const wood = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
  wood.addColorStop(0, '#7a4a2c')
  wood.addColorStop(0.45, '#4a2c1c')
  wood.addColorStop(1, '#2a1810')
  ctx.fillStyle = wood
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#d4a04a'
  ctx.globalAlpha = 0.55
  ctx.lineWidth = Math.max(1.2, r * 0.08)
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2)
  ctx.stroke()

  ctx.globalAlpha = 0.7
  ctx.fillStyle = '#f0d8a8'
  ctx.beginPath()
  ctx.ellipse(cx - r * 0.28, cy - r * 0.3, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = 0.85
  ctx.fillStyle = label === 'a' ? '#e24b3a' : '#d4a04a'
  ctx.beginPath()
  ctx.arc(cx + r * 0.16, cy + r * 0.1, r * 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  if (grabbed) {
    ctx.save()
    ctx.strokeStyle = 'rgba(226, 75, 58, 0.7)'
    ctx.lineWidth = Math.max(2, r * 0.12)
    ctx.beginPath()
    ctx.arc(cx, cy, r * 1.28, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  } else if (phase === 'ready' && !prefersReducedMotion()) {
    const pulse = 0.55 + Math.sin(now * 0.003 + (label === 'a' ? 0 : 1.2)) * 0.2
    ctx.save()
    ctx.strokeStyle = `rgba(246, 234, 212, ${0.18 + pulse * 0.16})`
    ctx.lineWidth = Math.max(1.4, r * 0.08)
    ctx.setLineDash([Math.max(3, r * 0.2), Math.max(4, r * 0.26)])
    ctx.beginPath()
    ctx.arc(cx, cy, r * (1.38 + pulse * 0.06), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

export function paintStage(canvas: HTMLCanvasElement, scene: StagePaint): void {
  const { w, h } = resizeCanvas(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  clayFill(ctx, w, h)
  paintGhost(ctx, w, h, scene.trail, scene.a, scene.b)
  paintSheet(ctx, w, h, scene.a, scene.b, scene.phase, scene.now)
  paintPeg(ctx, w, h, scene.a, scene.grabbed.has('a'), scene.phase, scene.now, 'a')
  paintPeg(ctx, w, h, scene.b, scene.grabbed.has('b'), scene.phase, scene.now, 'b')
  clayRim(ctx, w, h)
}
