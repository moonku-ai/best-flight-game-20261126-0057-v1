// main.js — Merpati Senja: Sky Courier. Wires the world, the aircraft, the
// rings, the HUD and the audio into one fixed-timestep game loop.
// Flight model: arcade. Throttle sets a target speed; bank turns the plane;
// pitch trades speed for altitude; stall below min speed; fuel and damage
// turn a sortie into decisions. Deterministic: seeded world, dt = 1/60,
// no wall-clock inside the simulation (only the render loop's accumulator).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildTerrain, runwayDistance } from './terrain.js';
import { buildAircraft, poseAircraft } from './aircraft.js';
import { buildRings } from './rings.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { applyShot } from './shots.js';

const DT = 1 / 60;
const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || CONFIG.seedDefault) || CONFIG.seedDefault;

const canvasHost = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvasHost, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdd8a52, 1300, 6500);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 9000);

const sunLight = new THREE.DirectionalLight(0xffd9a8, 2.4);
sunLight.position.set(-900, 700, -1400);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x8a7a9e, 0.9));
const hemi = new THREE.HemisphereLight(0x8a7ab8, 0x3a2e22, 0.7);
scene.add(hemi);

const { group: world, heightAt } = buildTerrain(SEED);
scene.add(world);
const aircraftParts = buildAircraft();
scene.add(aircraftParts.group);
const ringsApi = buildRings(heightAt);
scene.add(ringsApi.group);

const hud = createHud();
const input = createInput();
const audio = createAudio();
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

// --- Flight state (plain numbers; G.state() exposes a copy) ---
const state = {
  pos: new THREE.Vector3(-180, CONFIG.runway.elevation + 1.3, 0),
  heading: Math.PI / 2,   // east, down the runway
  pitch: 0,
  roll: 0,
  speed: 0,
  throttle: 0,
  fuel: CONFIG.plane.fuelStart,
  damage: 0,
  ringsPassed: 0,
  activeRing: 0,
  score: 0,
  time: 0,
  vs: 0,                  // vertical speed m/s
  groundY: CONFIG.runway.elevation,
  phase: 'ground',        // ground | fly | landed | crashed | done
  cameraMode: params.get('cam') === 'cockpit' ? 'cockpit' : 'chase',
  god: params.get('god') === '1',
  crashReason: '',
  landingSink: 0,
  airTime: 0,             // seconds since takeoff (collision grace after liftoff)
  muted: false,
};

function forwardVector(out) {
  const cp = Math.cos(state.pitch);
  out.set(
    Math.sin(state.heading) * cp,
    Math.sin(state.pitch),
    -Math.cos(state.heading) * cp,
  );
  return out;
}
const tmpFwd = new THREE.Vector3();

function resetFlight() {
  state.pos.set(-180, CONFIG.runway.elevation + 1.3, 0);
  state.heading = Math.PI / 2;
  state.pitch = 0; state.roll = 0;
  state.speed = 0; state.throttle = 0;
  state.fuel = CONFIG.plane.fuelStart; state.damage = 0;
  state.ringsPassed = 0; state.activeRing = 0;
  state.score = 0; state.time = 0; state.vs = 0;
  state.phase = 'ground'; state.crashReason = '';
  for (const r of ringsApi.rings) r.passed = false;
  ringsApi.setActive(0);
  document.getElementById('end-panel').style.display = 'none';
  hud.showMessage('Take off: throttle up with W, lift off with ↑', 4000);
}

function crash(reason) {
  if (state.phase === 'crashed') return;
  state.phase = 'crashed';
  state.crashReason = reason;
  state.speed = 0;
  audio.crash();
  audio.setEngine(0, 0);
  const panel = document.getElementById('end-panel');
  panel.style.display = 'block';
  document.getElementById('end-title').textContent = 'CRASHED';
  document.getElementById('end-detail').textContent =
    `${reason}. Rings ${state.ringsPassed}/${CONFIG.rings.count}. Score ${state.score}. Press R to fly again.`;
  hud.showMessage(reason, 3000);
}

function completeSortie() {
  if (state.phase === 'done') return;
  state.phase = 'done';
  const timeBonus = Math.max(0, Math.round((CONFIG.rings.parSeconds - state.time) * CONFIG.rings.timeBonusPerSecLeft));
  const soft = Math.round(CONFIG.landing.scoreSoftBonus * Math.max(0, 1 - Math.abs(state.landingSink) / CONFIG.landing.maxSink));
  const landingScore = CONFIG.landing.scoreBase + soft;
  state.score += landingScore + timeBonus;
  audio.fanfare();
  audio.setEngine(0, 0);
  const panel = document.getElementById('end-panel');
  panel.style.display = 'block';
  document.getElementById('end-title').textContent = 'SORTIE COMPLETE';
  document.getElementById('end-detail').textContent =
    `Landing +${landingScore} · Time bonus +${timeBonus} · Total score ${state.score} · Time ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}. Press R to fly again.`;
  hud.showMessage(`Landed! +${landingScore + timeBonus} points`, 4000);
}

function update(dt) {
  const edges = input.consumeEdges();
  if (edges.has('KeyR') && (state.phase === 'crashed' || state.phase === 'done' || state.phase === 'landed')) {
    resetFlight();
    return;
  }
  if (edges.has('KeyC')) {
    state.cameraMode = state.cameraMode === 'chase' ? 'cockpit' : 'chase';
    document.getElementById('cockpit-frame').style.display = state.cameraMode === 'cockpit' ? 'block' : 'none';
    aircraftParts.group.visible = state.cameraMode === 'chase';
  }
  if (edges.has('KeyM')) {
    state.muted = audio.toggleMute();
    hud.showMessage(state.muted ? 'Sound off' : 'Sound on', 1200);
  }
  if (edges.has('KeyP')) {
    input.paused = !input.paused;
    hud.showMessage(input.paused ? 'Paused. P to resume' : 'Resumed', 1200);
  }
  if (input.paused) return;
  // A crashed or finished sortie is frozen: no speed, fuel or score drift.
  if (state.phase === 'crashed' || state.phase === 'done') return;

  const k = input.keys;
  const P = CONFIG.plane;

  // --- Throttle ---
  if (k.has('KeyW') && state.fuel > 0) state.throttle = Math.min(1, state.throttle + dt * 0.9);
  if (k.has('KeyS')) state.throttle = Math.max(0, state.throttle - dt * 1.4);
  if (state.fuel <= 0) state.throttle = 0;
  if (k.has('Space')) state.throttle = Math.max(0, state.throttle - dt * 1.8); // airbrake
  if (!state.god && state.phase !== 'ground') {
    state.fuel = Math.max(0, state.fuel - P.fuelDrainPerSec * (0.25 + 0.75 * state.throttle) * dt);
  }

  // --- Stick: pitch + bank targets from keys and mouse ---
  let pitchIn = 0, bankIn = 0;
  if (k.has('ArrowUp')) pitchIn += 1;
  if (k.has('ArrowDown')) pitchIn -= 1;
  if (k.has('ArrowRight')) bankIn += 1;
  if (k.has('ArrowLeft')) bankIn -= 1;
  if (input.mouse.active && performance.now() - input.mouse.lastMove < 2500) {
    bankIn += input.mouse.x * 0.9;
    pitchIn += -input.mouse.y * 0.7;
  }
  pitchIn = Math.max(-1, Math.min(1, pitchIn));
  bankIn = Math.max(-1, Math.min(1, bankIn));
  const maxPitch = (P.maxPitchDeg * Math.PI) / 180;
  const maxBank = (P.maxBankDeg * Math.PI) / 180;
  const pitchTarget = pitchIn * maxPitch * (state.phase === 'ground' ? 0.4 : 1);
  const rollTarget = -bankIn * maxBank;
  state.pitch += (pitchTarget - state.pitch) * Math.min(1, P.pitchRate * 3.2 * dt);
  state.roll += (rollTarget - state.roll) * Math.min(1, P.rollRate * 2.4 * dt);

  // --- Speed: throttle sets a target; drag + climb bleed it off.
  // On rollout the throttle is idle and the brakes do the work.
  let speedTarget;
  if (state.phase === 'landed') {
    state.throttle = Math.max(0, state.throttle - dt * 2);
    speedTarget = 0;
    state.speed += (speedTarget - state.speed) * Math.min(1, 1.2 * dt);
  } else {
    const targetSpeed = P.minSpeed + state.throttle * (P.maxSpeed - P.minSpeed);
    const climbPenalty = Math.max(0, Math.sin(state.pitch)) * 22;
    speedTarget = Math.max(P.minSpeed * 0.6, targetSpeed - climbPenalty);
    // Exponential spool toward the target speed (~63% in ~1.1 s at full throttle).
    state.speed += (speedTarget - state.speed) * Math.min(1, 0.9 * dt);
  }

  // --- Turn: bank turns the heading, faster when fast ---
  const speedFactor = Math.max(0.25, Math.min(1, state.speed / P.cruiseSpeed));
  state.heading -= state.roll * P.turnRate * speedFactor * dt;

  // --- Move ---
  const prevY = state.pos.y;
  if (state.phase === 'ground') {
    state.pos.y = CONFIG.runway.elevation + 1.3;
    state.pos.x += Math.sin(state.heading) * state.speed * dt;
    state.pos.z += -Math.cos(state.heading) * state.speed * dt;
    state.vs = 0;
    if (state.speed >= 26 && pitchIn > 0.25) {
      state.phase = 'fly';
      state.airTime = 0;
      state.pitch = (6 * Math.PI) / 180;
      hud.showMessage('Airborne! Follow the orange ring.', 2500);
    } else if (state.speed >= 30) {
      state.phase = 'fly';
      state.airTime = 0;
      state.pitch = (4 * Math.PI) / 180;
    }
  } else if (state.phase === 'fly') {
    forwardVector(tmpFwd);
    state.pos.addScaledVector(tmpFwd, state.speed * dt);
    // Stall: below min speed the wing quits and the plane sinks.
    if (state.speed < P.minSpeed) {
      state.pos.y -= P.sinkStall * (1 - state.speed / P.minSpeed) * dt;
    }
    state.vs = (state.pos.y - prevY) / dt;
    state.time += dt;
    state.airTime += dt;
  } else if (state.phase === 'landed') {
    state.pos.y = CONFIG.runway.elevation + 1.3;
    state.pos.x += Math.sin(state.heading) * state.speed * dt;
    state.pos.z += -Math.cos(state.heading) * state.speed * dt;
    state.vs = 0;
    state.pitch += (0 - state.pitch) * Math.min(1, 2 * dt);
    state.roll += (0 - state.roll) * Math.min(1, 2 * dt);
    if (state.speed < 2) completeSortie();
  } else {
    return; // crashed / done: frozen
  }

  // --- Ground collision / landing (skipped briefly after takeoff: the
  // liftoff frame still sits at runway height and must not read as a
  // touchdown, and a plane that just left the ground is not landing) ---
  state.groundY = heightAt(state.pos.x, state.pos.z);
  if (state.phase === 'fly' && state.airTime > 1.0) {
    const clearance = state.pos.y - state.groundY;
    const onRunway = runwayDistance(state.pos.x, state.pos.z) < 16;
    if (clearance <= 1.3) {
      const sink = -state.vs;
      const gentle = sink <= CONFIG.landing.maxSink;
      const slow = state.speed <= CONFIG.landing.maxSpeed;
      const level = Math.abs(state.roll) <= (CONFIG.landing.maxBankDeg * Math.PI) / 180;
      if (onRunway && gentle && slow && level) {
        state.phase = 'landed';
        state.landingSink = sink;
        state.pos.y = CONFIG.runway.elevation + 1.3;
        audio.touchdown();
        hud.showMessage('Touchdown!', 2500);
      } else if (onRunway && !gentle && sink <= 9 && slow && level && !state.god) {
        // Hard but survivable: the plane bounces, the airframe takes damage.
        state.damage = Math.min(100, state.damage + 30);
        state.pos.y = state.groundY + 4;
        state.pitch = (2 * Math.PI) / 180;
        state.vs = 2;
        audio.touchdown();
        hud.showMessage(`Hard landing! Damage +30 (${Math.round(state.damage)}%)`, 2500);
        if (state.damage >= 100) crash('Airframe destroyed by repeated hard landings');
      } else if (onRunway && !gentle) {
        crash(`Hard landing. Sank ${sink.toFixed(1)} m/s onto the runway`);
      } else if (onRunway && !slow) {
        crash(`Too fast to land. ${Math.round(state.speed * 1.944)} kt on the runway`);
      } else {
        crash(`Hit the terrain at ${Math.round(state.speed * 1.944)} kt`);
      }
    }
    // --- Rings ---
    const passed = ringsApi.checkPass(state.pos, state.activeRing);
    if (passed) {
      state.ringsPassed++;
      state.score += CONFIG.rings.score;
      audio.ringChime();
      hud.showMessage(`Ring ${state.ringsPassed}/${CONFIG.rings.count} +${CONFIG.rings.score}`, 2200);
      state.activeRing++;
      ringsApi.setActive(state.activeRing);
      if (state.ringsPassed >= CONFIG.rings.count) {
        hud.showMessage('All rings clear. Land on the runway!', 3500);
      }
    }
  }

  // --- World animation + aircraft pose + audio ---
  ringsApi.animate(dt, state.time);
  poseAircraft(aircraftParts, state);
  audio.setEngine(state.phase === 'fly' || state.phase === 'ground' ? state.throttle : 0, state.speed / P.maxSpeed);
}

function updateCamera(dt) {
  forwardVector(tmpFwd);
  // First person hides the canopy glass: the pilot looks over the nose,
  // not through a dome that fills the frame.
  aircraftParts.canopy.visible = state.cameraMode === 'chase';
  if (state.cameraMode === 'cockpit') {
    const off = CONFIG.camera.cockpitOffset;
    const right = new THREE.Vector3(Math.cos(state.heading), 0, Math.sin(state.heading));
    const up = new THREE.Vector3(0, 1, 0);
    camera.position.copy(state.pos)
      .addScaledVector(right, off.x)
      .addScaledVector(up, off.y)
      .addScaledVector(tmpFwd, off.z);
    camera.lookAt(
      state.pos.x + tmpFwd.x * 40,
      state.pos.y + tmpFwd.y * 40,
      state.pos.z + tmpFwd.z * 40,
    );
    return;
  }
  const dist = CONFIG.camera.chaseDistance;
  const desired = new THREE.Vector3(
    state.pos.x - tmpFwd.x * dist,
    state.pos.y - tmpFwd.y * dist + CONFIG.camera.chaseHeight,
    state.pos.z - tmpFwd.z * dist,
  );
  const groundHere = heightAt(desired.x, desired.z) + 3;
  if (desired.y < groundHere) desired.y = groundHere;
  // Snap on spawn / after a pose change so the first frame already frames
  // the aircraft; otherwise damp smoothly toward the chase position.
  if (camera.position.distanceTo(desired) > 80) {
    camera.position.copy(desired);
  } else {
    const lambda = 1 - Math.exp(-5 * dt);
    camera.position.lerp(desired, lambda);
  }
  camera.lookAt(
    state.pos.x + tmpFwd.x * 18,
    state.pos.y + tmpFwd.y * 18 + 1,
    state.pos.z + tmpFwd.z * 18,
  );
}

function render(frameDt = 1 / 60) {
  updateCamera(Math.min(frameDt, 0.05));
  hud.update(state, ringsApi.rings, 1 / 60);
  renderer.render(scene, camera);
}

let accumulator = 0;
let lastNow = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  let frame = (now - lastNow) / 1000;
  lastNow = now;
  if (frame > 0.25) frame = 0.25;
  accumulator += frame;
  let steps = 0;
  while (accumulator >= DT && steps < 5) {
    update(DT);
    accumulator -= DT;
    steps++;
  }
  render(frame);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Shot poses for deterministic screenshots (?shot=) ---
applyShot(state, params.get('shot') || 'play', { ringsApi, heightAt });

// --- Debug hooks (guizang-game-skill): numeric truth over screenshots ---
window.G = {
  version: '1.0.0',
  state() {
    return {
      phase: state.phase,
      x: +state.pos.x.toFixed(1),
      y: +state.pos.y.toFixed(1),
      z: +state.pos.z.toFixed(1),
      headingDeg: +(((state.heading * 180) / Math.PI % 360 + 360) % 360).toFixed(1),
      pitchDeg: +((state.pitch * 180) / Math.PI).toFixed(1),
      rollDeg: +((state.roll * 180) / Math.PI).toFixed(1),
      speedKt: +(state.speed * 1.944).toFixed(1),
      throttle: +state.throttle.toFixed(2),
      fuel: +state.fuel.toFixed(1),
      damage: +state.damage.toFixed(1),
      ringsPassed: state.ringsPassed,
      activeRing: state.activeRing,
      score: state.score,
      timeSec: +state.time.toFixed(1),
      groundY: +state.groundY.toFixed(1),
      clearanceM: +(state.pos.y - state.groundY).toFixed(1),
      cameraMode: state.cameraMode,
    };
  },
  step(n = 60, dt = DT) {
    for (let i = 0; i < n; i++) update(dt);
    render();
    return window.G.state();
  },
  press(...codes) { for (const c of codes) input.keys.add(c); },
  release(...codes) { for (const c of codes) input.keys.delete(c); },
  pose(name) { applyShot(state, name, { ringsApi, heightAt }); render(); return window.G.state(); },
  reset() { resetFlight(); render(); return window.G.state(); },
};
window.__gameReady = true;
