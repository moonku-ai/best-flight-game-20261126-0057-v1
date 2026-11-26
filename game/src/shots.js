// shots.js — deterministic starting poses for screenshots and playtests.
// ?shot=start puts the plane on the runway; ?shot=play drops it mid-flight
// on the ring course (the cover pose); ?shot=end sets up final approach.
// All poses are functions of the seeded world, never of wall-clock time.
import { CONFIG } from './config.js';

export function applyShot(state, name, ctx) {
  const { ringsApi, heightAt } = ctx;
  const P = CONFIG.plane;
  const clearRings = (passedCount) => {
    for (let i = 0; i < ringsApi.rings.length; i++) {
      ringsApi.rings[i].passed = i < passedCount;
    }
    state.ringsPassed = passedCount;
    state.activeRing = passedCount;
    ringsApi.setActive(passedCount);
  };

  if (name === 'start') {
    state.pos.set(-180, CONFIG.runway.elevation + 1.3, 0);
    state.heading = Math.PI / 2;
    state.pitch = 0; state.roll = 0;
    state.speed = 0; state.throttle = 0;
    state.phase = 'ground';
    clearRings(0);
    state.score = 0; state.time = 0;
  } else if (name === 'end') {
    // Final approach from the east, aligned with the runway, gear down.
    state.pos.set(650, 55, 0);
    state.heading = -Math.PI / 2; // west, toward the runway
    state.pitch = (-4 * Math.PI) / 180;
    state.roll = 0;
    state.speed = 34;
    state.throttle = 0.35;
    state.phase = 'fly';
    clearRings(CONFIG.rings.count);
    state.score = CONFIG.rings.count * CONFIG.rings.score;
    state.time = 150;
  } else {
    // 'play' (default): airborne on the ring course, 260 m out from ring 3,
    // rings 1-2 already passed, throttle up, chase camera behind the plane.
    const r3 = ringsApi.rings[2].centre;
    const r2 = ringsApi.rings[1].centre;
    const dx = r3.x - r2.x, dz = r3.z - r2.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    state.pos.set(r3.x - ux * 260, r3.y - 6, r3.z - uz * 260);
    state.heading = Math.atan2(ux, -uz);
    state.pitch = 0; state.roll = 0;
    state.speed = 46;
    state.throttle = 0.7;
    state.phase = 'fly';
    clearRings(2);
    state.score = 2 * CONFIG.rings.score;
    state.time = 42;
  }
  state.fuel = P.fuelStart;
  state.damage = 0;
  state.vs = 0;
  state.airTime = state.phase === 'fly' ? 99 : 0;
  state.groundY = heightAt(state.pos.x, state.pos.z);
  document.getElementById('end-panel').style.display = 'none';
  return state;
}
