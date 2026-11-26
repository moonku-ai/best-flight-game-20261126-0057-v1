// rings.js — the ring course: glowing torus gates, one active at a time.
// Passing the active ring scores, bursts particles and lights the next one.
import * as THREE from 'three';
import { CONFIG, RING_COURSE } from './config.js';

export function buildRings(heightAt) {
  const group = new THREE.Group();
  group.name = 'rings';
  const rings = RING_COURSE.map((def, i) => {
    const y = Math.max(def.y, heightAt(def.x, def.z) + 42);
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(CONFIG.rings.radius, 0.55, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0x3a7bd5, transparent: true, opacity: 0.55 }),
    );
    mesh.position.set(def.x, y, def.z);
    mesh.name = `ring-${i + 1}`;
    // Face the ring toward the previous gate so the pilot flies through it.
    const prev = i === 0
      ? { x: 0, z: 0, y: 30 }
      : { x: RING_COURSE[i - 1].x, z: RING_COURSE[i - 1].z, y: Math.max(RING_COURSE[i - 1].y, 60) };
    mesh.lookAt(prev.x, prev.y, prev.z);
    group.add(mesh);
    // A small beacon light floating above each ring, visible from afar.
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x9ecbff }),
    );
    beacon.position.set(def.x, y + CONFIG.rings.radius + 3, def.z);
    group.add(beacon);
    return { index: i, mesh, beacon, centre: new THREE.Vector3(def.x, y, def.z), passed: false };
  });

  // Particle burst pool: one THREE.Points cloud, reused for every ring pass.
  const BURST = 90;
  const burstGeo = new THREE.BufferGeometry();
  const burstPos = new Float32Array(BURST * 3);
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
  const burstMat = new THREE.PointsMaterial({
    color: 0xffc46b, size: 0.8, transparent: true, opacity: 0.95, sizeAttenuation: true,
  });
  const burst = new THREE.Points(burstGeo, burstMat);
  burst.name = 'ring-burst';
  burst.frustumCulled = false;
  group.add(burst);
  const burstVel = new Float32Array(BURST * 3);
  let burstLife = 0;

  function fireBurst(centre) {
    for (let i = 0; i < BURST; i++) {
      burstPos[i * 3] = centre.x; burstPos[i * 3 + 1] = centre.y; burstPos[i * 3 + 2] = centre.z;
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      const sp = 10 + Math.random() * 16;
      burstVel[i * 3] = Math.cos(a) * Math.cos(b) * sp;
      burstVel[i * 3 + 1] = Math.sin(b) * sp;
      burstVel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * sp;
    }
    burstGeo.attributes.position.needsUpdate = true;
    burstLife = 1;
  }

  function updateBurst(dt) {
    if (burstLife <= 0) { burstMat.opacity = 0; return; }
    burstLife -= dt * 1.5;
    for (let i = 0; i < BURST; i++) {
      burstPos[i * 3] += burstVel[i * 3] * dt;
      burstPos[i * 3 + 1] += burstVel[i * 3 + 1] * dt;
      burstPos[i * 3 + 2] += burstVel[i * 3 + 2] * dt;
      burstVel[i * 3 + 1] -= 12 * dt;
    }
    burstGeo.attributes.position.needsUpdate = true;
    burstMat.opacity = Math.max(0, burstLife);
  }

  function setActive(activeIndex) {
    for (const r of rings) {
      if (r.passed) {
        r.mesh.material.color.set(0x2aff7a);
        r.mesh.material.opacity = 0.35;
        r.beacon.material.color.set(0x2aff7a);
      } else if (r.index === activeIndex) {
        r.mesh.material.color.set(0xff9a1e);
        r.mesh.material.opacity = 0.95;
        r.beacon.material.color.set(0xff9a1e);
      } else {
        r.mesh.material.color.set(0x3a7bd5);
        r.mesh.material.opacity = 0.55;
        r.beacon.material.color.set(0x9ecbff);
      }
    }
  }

  // Returns the ring just passed, or null. Only the active ring can be passed.
  function checkPass(pos, activeIndex) {
    const r = rings[activeIndex];
    if (!r || r.passed) return null;
    if (pos.distanceTo(r.centre) < CONFIG.rings.passDistance) {
      r.passed = true;
      fireBurst(r.centre);
      return r;
    }
    return null;
  }

  function animate(dt, time) {
    for (const r of rings) {
      if (!r.passed) {
        r.mesh.rotation.z += dt * 0.15;
        const s = 1 + Math.sin(time * 2 + r.index) * 0.02;
        r.mesh.scale.set(s, s, s);
        r.beacon.position.y = r.centre.y + CONFIG.rings.radius + 3 + Math.sin(time * 1.5 + r.index) * 1.2;
      }
    }
    updateBurst(dt);
  }

  setActive(0);
  return { group, rings, setActive, checkPass, animate };
}
