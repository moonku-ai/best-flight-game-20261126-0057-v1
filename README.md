# Merpati Senja: Sky Courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/moonku-ai/best-flight-game-20261126-0057-v1/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/moonku-ai/best-flight-game-20261126-0057-v1/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A complete flight game that plays offline in a desktop browser from its own files. Fly Merpati, a little sunset-orange prop plane, over Pulau Senja at golden hour: thread eight glowing rings around the island, mind your fuel, then bring her home onto the runway.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No network request is made by the game; Three.js is vendored under `game/vendor/`.

## How to fly

- **W / S** throttle up and down, **arrow keys** pitch and bank, **mouse** steers, **Space** airbrake
- **C** switches chase and cockpit camera, **P** pauses, **R** restarts, **M** toggles sound
- Fly through all 8 rings (100 points each), then land on the runway: touch down gently, under 74 kt, wings level. A hard landing bounces and damages the airframe; a very hard one ends the sortie.
- Fuel drains with throttle, so a full-throttle joyride can run dry. The sortie par time is 3:30.

## Files

- `game/index.html` — the game page and HUD
- `game/src/` — one job per file: `terrain.js` (seeded island, sky, town, runway), `aircraft.js` (the plane), `rings.js` (the course and its particle bursts), `hud.js` (instruments, compass, minimap), `input.js`, `audio.js` (synthesised sound), `main.js` (flight model and game loop), `shots.js` (deterministic screenshot poses)
- `game/vendor/three.module.min.js` — Three.js r160, vendored
- `main.ts` — hands the game in to make.fun (Node 22, standard library only)
- `tests/` — determinism and balance tests (`node --test tests/`)

## Screenshots

`shots.json` lists the poses; `screenshots/` holds the four frames: chase view on the ring course, cockpit view, closing on a ring, and final approach to the runway.

---

<sub>Entered on [make.fun](https://make.fun/?ref=moonku-ai&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
