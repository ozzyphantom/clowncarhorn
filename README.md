# Clown Car Horn

One button. Press it and a horn honks. There are 28 horns: 3 recordings and 25 synthesized with the Web Audio API. The site is static files on Cloudflare Workers, with no build step.

## Live Site

[clowncarhorn.com](https://clowncarhorn.com)

## Development

```bash
corepack pnpm install
corepack pnpm dev
```

Then open <http://localhost:8787>.

## Deployment

```bash
corepack pnpm run deploy
```

Use `run`. A bare `pnpm deploy` is a different pnpm command.

## HTTPS

The site is HTTPS only.

- `public/_headers` sends `Strict-Transport-Security` with every file. A browser that has seen it uses HTTPS for a year, on every subdomain of clowncarhorn.com.
- `_headers` does not reach the 404, which `src/worker.js` builds. The Worker sets the same header itself. Keep the two values in step.
- The redirect from `http://` is not in this repository. It is the Always Use HTTPS switch on the clowncarhorn.com zone, in the Cloudflare dashboard under SSL/TLS, Edge Certificates.

## Files

| Path | What it is |
|------|------------|
| `public/index.html` | The page |
| `public/style.css` | The button and the layout |
| `public/script.js` | The button, the keyboard and the player |
| `public/sounds.js` | Every horn: the synthesized ones and the list of recordings |
| `public/sounds/` | The three recordings |
| `public/_headers` | Security headers |
| `src/worker.js` | Answers 404 for any path that is not a file |
| `tools/measure.js` | Loudness check for the horns. Not deployed |
| `pnpm-workspace.yaml` | Supply-chain settings for the one dependency, wrangler |

## The button

`public/style.css` draws the button as a 100 mm dome push button, seen from the front and lit from the upper left. It uses no images.

| Part | Selector | What it is |
|------|----------|------------|
| Collar | `.collar` | The black ring fixed to the panel, and the well inside it |
| Plunger | `.arcade-button` | The `<button>`: the press target, the focus ring and the plunger's side wall |
| Cap | `.cap` | The red dome that travels, with the legend, the highlight and the lamp |

- Every measure derives from `--cap`, the diameter of the cap. It grows with the screen up to 280 px, about life size on a desktop screen.
- While the button is held, the cap sinks into its seat and the lamp inside it comes on.
- The press target stays put while the cap moves. The collar is not part of it.
- The colours and measures are the custom properties at the top of the file.

## What a press does

- A press honks once: mouse, touch, pen, Space or Enter. Each finger counts, so two-finger drumming works.
- Each press picks the next horn from a shuffled round. Every horn plays once before any horn repeats.
- A new honk cuts off the one before it.
- Space and Enter honk from anywhere on the page. When focus is on a footer link, the keys belong to the link.
- A click with no press before it also honks. Screen readers and voice control send that.
- The button never stays down. A lost key-up, a context menu, a hidden tab or a window that loses focus all release it.
- If the browser has stopped the audio (a phone call, a locked screen, a background tab), the next press starts it again and plays one honk.
- On an iPhone the horn obeys the ring/silent switch. Silent means silent.

## Horns

Open `/?horn=<name>` to hear one horn only, for example <http://localhost:8787/?horn=ahooga>.

| Name | What it is |
|------|------------|
| `honk-1` | Recording: one high honk |
| `honk-2` | Recording: two low blasts |
| `honk-3` | Recording: two mid honks |
| `classic` | Low sawtooth honk |
| `high` | Higher square-wave honk |
| `double` | Two short honks |
| `sad-trombone` | One falling slide |
| `buzzy` | Two waveforms beating against each other |
| `squeaky` | One short squeak |
| `foghorn` | Low and slow |
| `party` | Party blower |
| `ahooga` | Klaxon: up, hold, down |
| `bulb` | Rubber bulb horn: squeeze and release |
| `beep-beep` | Small car, two taps |
| `scooter` | Thin moped horn |
| `truck` | Big-rig air horn |
| `drive-by` | A car passing with the horn held down |
| `dying` | A horn on a flat battery |
| `nee-naw` | Two-tone fire engine horn |
| `train` | Five-chime locomotive horn |
| `air-horn` | Aerosol can |
| `vuvuzela` | Stadium horn |
| `steam-whistle` | A short toot and a long one |
| `cucaracha` | Musical air horn, "La Cucaracha" (traditional) |
| `shave-and-a-haircut` | The seven-honk knock |
| `ta-da` | Circus fanfare |
| `womp-womp` | Sad trombone, four notes |
| `squeak-toy` | Squeeze and release |

### Add a horn

1. Add one entry to `HORNS` in `public/sounds.js`. Copy a horn that is close to what you want.
2. Open `/?horn=<name>` and press the button until it sounds right.
3. Set its `trim`. Paste `tools/measure.js` into the browser console and copy the `trim wanted` value.

To add a recording, put the MP3 in `public/sounds/` and add it to `RECORDINGS` in `public/sounds.js`. The player skips silence at the start and the end of a recording.

### Loudness

Every horn plays at one loudness. `tools/measure.js` measures the loudest 100 ms of each horn, A-weighted, and prints the `trim` that brings it to -14 dB. A few low or dense horns stop 1 to 4 dB short, because their trim is capped to keep the peak below clipping.

## Dependencies

wrangler is the only one, and it is a development tool. Nothing from npm reaches the browser.

- `pnpm-workspace.yaml` holds back any release for 7 days, refuses dependencies from outside the registry, and runs no install scripts.
- `pnpm-lock.yaml` pins every package and its hash.
- To update: `corepack pnpm update wrangler`, then `corepack pnpm audit`.
