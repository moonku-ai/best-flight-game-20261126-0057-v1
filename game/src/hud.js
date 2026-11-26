// hud.js — the instrument panel: airspeed, altitude, heading, throttle,
// fuel, damage, ring count, timer, score, attitude indicator, minimap and
// the steer-to-ring arrow. All DOM + 2D canvas, updated from flight state.
import { CONFIG, RING_COURSE } from './config.js';

function el(id) { return document.getElementById(id); }
function fmt(n, d = 0) { return n.toFixed(d); }

export function createHud() {
  const refs = {
    speed: el('hud-speed'), alt: el('hud-alt'), vsi: el('hud-vsi'),
    heading: el('hud-heading'), throttle: el('hud-throttle'),
    fuel: el('hud-fuel'), damage: el('hud-damage'),
    rings: el('hud-rings'), timer: el('hud-timer'), score: el('hud-score'),
    objective: el('hud-objective'), message: el('hud-message'),
    ringDist: el('hud-ringdist'), compass: el('compass-canvas'),
    attitude: el('attitude-canvas'), minimap: el('minimap-canvas'),
    banner: el('hud-banner'), phase: el('hud-phase'),
  };
  let messageUntil = 0;
  let lastObjective = '';

  function showMessage(text, ms = 2200) {
    refs.message.textContent = text;
    refs.message.style.opacity = '1';
    messageUntil = performance.now() + ms;
  }

  function drawCompass(headingDeg) {
    const c = refs.compass;
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(8,14,24,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = -60; d <= 60; d += 5) {
      const deg = ((Math.round(headingDeg) + d) % 360 + 360) % 360;
      const x = w / 2 + (d / 60) * (w / 2 - 8);
      if (d % 15 === 0) {
        ctx.strokeStyle = '#ffd27a';
        ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, 16); ctx.stroke();
        ctx.fillStyle = '#ffd27a';
        ctx.fillText(labels[deg] ?? String(deg), x, 30);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 13); ctx.stroke();
      }
    }
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath(); ctx.moveTo(w / 2 - 5, 0); ctx.lineTo(w / 2 + 5, 0); ctx.lineTo(w / 2, 6); ctx.fill();
  }

  function drawAttitude(pitchDeg, rollDeg) {
    const c = refs.attitude;
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height, cx = w / 2, cy = h / 2, R = w / 2 - 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate((-rollDeg * Math.PI) / 180);
    const py = (pitchDeg / 30) * R;
    ctx.fillStyle = '#2f6db3'; ctx.fillRect(-R - 4, -R - 4 - py, (R + 4) * 2, R + 4 + py);
    ctx.fillStyle = '#8a6a45'; ctx.fillRect(-R - 4, -py, (R + 4) * 2, R + 4 + py);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-R, -py); ctx.lineTo(R, -py); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 16, cy); ctx.lineTo(cx - 4, cy); ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 16, cy); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawMinimap(state, rings) {
    const c = refs.minimap;
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const S = 3400; // metres across the map
    const px = (x) => w / 2 + (x / S) * w;
    const pz = (z) => h / 2 + (z / S) * h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(10,22,36,0.72)';
    ctx.fillRect(0, 0, w, h);
    // Island blob (approx circle) + sea.
    ctx.fillStyle = '#1d4e6b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3f6b34';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, (1500 / S) * w, 0, Math.PI * 2); ctx.fill();
    // Runway.
    ctx.strokeStyle = '#f5f2e8'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px(-CONFIG.runway.length / 2), pz(0));
    ctx.lineTo(px(CONFIG.runway.length / 2), pz(0));
    ctx.stroke();
    // Rings: passed green, next orange, rest blue.
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      ctx.fillStyle = r.passed ? '#2aff7a' : (i === state.activeRing ? '#ff9a1e' : '#5aa2ff');
      ctx.beginPath(); ctx.arc(px(r.centre.x), pz(r.centre.z), i === state.activeRing ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Plane arrow, rotated by heading (heading 0 = north = -Z on the map).
    ctx.save();
    ctx.translate(px(state.pos.x), pz(state.pos.z));
    ctx.rotate(state.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('N', 4, 12);
  }

  function update(state, rings, dt) {
    const kt = state.speed * 1.944;
    const ft = (state.pos.y - state.groundY) * 3.281;
    const headingDeg = ((state.heading * 180) / Math.PI % 360 + 360) % 360;
    refs.speed.textContent = `${fmt(kt)} kt`;
    refs.alt.textContent = `${fmt(Math.max(0, ft))} ft`;
    refs.vsi.textContent = `${state.vs >= 0 ? '+' : ''}${fmt(state.vs * 196.85)} ft/m`;
    refs.heading.textContent = `${String(Math.round(headingDeg)).padStart(3, '0')}°`;
    refs.throttle.style.width = `${Math.round(state.throttle * 100)}%`;
    refs.fuel.style.width = `${Math.max(0, state.fuel)}%`;
    refs.fuel.style.background = state.fuel < 20 ? '#ff5a3c' : '#37c978';
    refs.damage.style.width = `${Math.min(100, state.damage)}%`;
    refs.rings.textContent = `${state.ringsPassed}/${CONFIG.rings.count}`;
    const t = Math.floor(state.time);
    refs.timer.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    refs.score.textContent = String(state.score);
    const active = rings[state.activeRing];
    if (active) {
      const d = Math.round(state.pos.distanceTo(active.centre));
      refs.ringDist.textContent = `NEXT RING ${d} m`;
    } else {
      refs.ringDist.textContent = 'LAND ON THE RUNWAY';
    }
    const objective = state.phase === 'done'
      ? 'Sortie complete. Press R to fly again'
      : state.phase === 'crashed'
        ? 'Crashed. Press R to try again'
        : state.ringsPassed < CONFIG.rings.count
          ? `Fly through ring ${state.ringsPassed + 1} of ${CONFIG.rings.count}`
          : 'All rings clear. Land on the runway';
    if (objective !== lastObjective) {
      refs.objective.textContent = objective;
      lastObjective = objective;
    }
    refs.phase.textContent = state.cameraMode === 'cockpit' ? 'COCKPIT' : 'CHASE';
    if (performance.now() > messageUntil) refs.message.style.opacity = '0';
    drawCompass(headingDeg);
    drawAttitude((state.pitch * 180) / Math.PI, (state.roll * 180) / Math.PI);
    drawMinimap(state, rings);
  }

  return { update, showMessage, banner: refs.banner };
}
