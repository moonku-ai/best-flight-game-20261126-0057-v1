// determinism.test.mjs — the parts of Merpati Senja that must be exactly
// reproducible: seeded randomness, the ring course and the runway geometry.
// Run: node --test tests/determinism.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, noise2, fbm2 } from '../game/src/random.js';
import { CONFIG, RING_COURSE, runwayDistance } from '../game/src/config.js';

test('mulberry32: same seed, same stream', () => {
  const a = mulberry32(7), b = mulberry32(7);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
  const c = mulberry32(8);
  assert.notEqual(a(), c());
});

test('noise2 and fbm2 are pure functions of their inputs', () => {
  assert.equal(noise2(12.5, -40.2, 7), noise2(12.5, -40.2, 7));
  assert.notEqual(noise2(12.5, -40.2, 7), noise2(12.5, -40.2, 8));
  assert.equal(fbm2(3.1, 8.7, 7), fbm2(3.1, 8.7, 7));
  assert.ok(fbm2(3.1, 8.7, 7) >= -1 && fbm2(3.1, 8.7, 7) <= 1);
});

test('ring course: 8 rings, each reachable from the previous', () => {
  assert.equal(RING_COURSE.length, CONFIG.rings.count);
  let prev = { x: 0, z: 0 };
  for (const r of RING_COURSE) {
    const leg = Math.hypot(r.x - prev.x, r.z - prev.z);
    assert.ok(leg > 150 && leg < 900, `leg ${leg}m should be flyable in seconds`);
    prev = r;
  }
});

test('runway: strip centred at origin, distance function sane', () => {
  assert.equal(runwayDistance(0, 0), 0);
  assert.equal(runwayDistance(500, 0), 500 - CONFIG.runway.length / 2);
  assert.equal(runwayDistance(0, 40), 40);
});

test('balance: fuel outlasts a par sortie, rings beat a direct landing', () => {
  const cruiseDrain = CONFIG.plane.fuelDrainPerSec * (0.25 + 0.75 * 0.7);
  const fuelSeconds = 100 / cruiseDrain;
  assert.ok(fuelSeconds > CONFIG.rings.parSeconds, `fuel ${fuelSeconds}s must cover par ${CONFIG.rings.parSeconds}s`);
  const ringScore = CONFIG.rings.count * CONFIG.rings.score;
  const landingOnly = CONFIG.landing.scoreBase + CONFIG.landing.scoreSoftBonus;
  assert.ok(ringScore > landingOnly * 2, 'skipping the rings must not pay');
});
