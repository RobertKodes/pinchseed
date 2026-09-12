# pinchseed

Pinch, spread, or twist. Hash the stretch. Get a Solana-ish address out.

Live: **https://robertkodes.github.io/pinchseed/**

Sibling to [tossseed](https://github.com/RobertKodes/tossseed) (flight), [keyseed](https://github.com/RobertKodes/keyseed) (cadence), [tiltseed](https://github.com/RobertKodes/tiltseed) (tilt), [micseed](https://github.com/RobertKodes/micseed) (hearing), [camseed](https://github.com/RobertKodes/camseed) (light), and [drawseed](https://github.com/RobertKodes/drawseed) (ink). A rubber band you can grab is the input. Not a wallet, not an explorer, not a fee/slot costume.

## Design thesis

A clay slab on a dark desk — potter’s wheel, rubber band, two wooden pegs.
The band is coral. Twist it and the sheet folds like a bellows. The address arrives like a callsign, stamped in mono.
No Inter, no purple, no cards, no hero: stretch, lift, take a seed.

Type: **Fraunces** (desk face) + **IBM Plex Mono** (callsign). Fallbacks are Palatino / Courier New.

| token | hex | job |
| --- | --- | --- |
| `desk` | `#1c1410` | dark field |
| `slab` | `#c47854` | clay playfield |
| `oak` | `#4a2c1c` | pegs / rim |
| `rubber` | `#e24b3a` | the band |
| `brass` | `#d4a04a` | chips / lamp |
| `ivory` | `#f6ead4` | warm ink |
| `soot` | `#8a7058` | mute labels |

## How it works

1. **Two contacts** on the slab. On a phone: pinch, spread, or twist with two fingers. The grab is the whole control.
2. **Desktop fallback:** two wooden pegs. Drag either peg, drag the band to slide it, **scroll-wheel** to pinch/spread (trackpad pinch arrives as `ctrl+wheel`), **shift-drag** to twist. `+` / `-` scale, `[` / `]` rotate, arrows nudge.
3. Distance (scale) and relative angle (twist) are sampled over the gesture. That window is resampled to **48 poses**, prefixed with a `pinchseed` domain, then **SHA-256** (Web Crypto). Tempo does not change the hash — the path does.
4. The 32-byte digest is **base58**-encoded (Solana alphabet). That string is 32–44 chars — a PDA-*looking* preview, not `findProgramAddress` with a program id.
5. Copy the callsign. **Pinch again** puts the pegs back on the slab.

No wallet, no signing, no RPC. This is a *preview* seed from the pinch. It is not a real program-derived PDA. Do not send funds to a rubber band.

## Local

```bash
npm i
npm run dev
```

The app is built at `/pinchseed/` (GitHub Pages project path). Production check:

```bash
npm run build && npm run preview
```

Tests (hash + base58 + gesture-trail stability):

```bash
npm test
```

## Pages

`vite.config.ts` sets `base: '/pinchseed/'`. Push to `main` runs `.github/workflows/pages.yml`, which builds and force-pushes `dist/` (plus `.nojekyll`) to the `gh-pages` branch via `peaceiris/actions-gh-pages`.

Manual republish:

```bash
npm run pages
```

If https://robertkodes.github.io/pinchseed/ 404s, flip **Settings → Pages → Deploy from a branch → `gh-pages` / `/` (root)** once. Same source as tossseed, keyseed, tiltseed, micseed, camseed, and drawseed.

## What this refuses

No wallet connect, no signing seeds, no trading, no scoreboard. The hash is a preview seed from a stretch, not a keypair.
