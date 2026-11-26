// terrain.js — the island of Pulau Senja: heightfield, sea, sunset sky,
// clouds, the coastal town, the airfield and its runway.
// heightAt(x, z) is the single source of truth: the render mesh samples it
// and the flight model collides against it, so they can never disagree.
import * as THREE from 'three';
import { fbm2, mulberry32 } from './random.js';
import { CONFIG, runwayDistance } from './config.js';

export { runwayDistance } from './config.js';

const RUNWAY = CONFIG.runway;

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function smoothstep(a, b, v) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function makeHeightAt(seed) {
  return function heightAt(x, z) {
    const r = Math.hypot(x, z);
    // Island mask: full height inside, sinking below the sea outside.
    const mask = 1 - smoothstep(CONFIG.islandRadius * 0.55, CONFIG.islandRadius * 1.05, r);
    let h = 6 + fbm2(x * 0.0016, z * 0.0016, seed, 4) * 34 * mask;
    h += Math.max(0, fbm2(x * 0.004 + 9, z * 0.004, seed + 7, 3)) * 26 * mask;
    // A river valley carving from the hills down to the western bay.
    const riverX = -420 + Math.sin(z * 0.0011) * 260;
    const riverD = Math.abs(x - riverX);
    h -= 9 * (1 - smoothstep(0, 90, riverD)) * mask;
    // Flatten the airfield so the runway sits on honest ground.
    const d = runwayDistance(x, z);
    const flat = 1 - smoothstep(120, 300, d);
    h = h * (1 - flat) + RUNWAY.elevation * flat;
    // Sea floor outside the island.
    if (mask <= 0) h = Math.min(h, -4 - (r - CONFIG.islandRadius) * 0.01);
    return h;
  };
}

function terrainColor(h, slope, out) {
  // Sunset-lit island palette: sand, meadow, deep green, rock.
  if (h < 2.2) out.setRGB(0.87, 0.78, 0.55);          // beach sand
  else if (h < 14) out.setRGB(0.42, 0.62, 0.30);      // low meadow
  else if (h < 34) out.setRGB(0.24, 0.48, 0.22);      // forested hill
  else if (h < 52) out.setRGB(0.38, 0.42, 0.28);      // high scrub
  else out.setRGB(0.45, 0.42, 0.40);                  // rock
  if (slope > 0.55) out.lerp(new THREE.Color(0.42, 0.38, 0.34), 0.6);
  return out;
}

export function buildTerrain(seed) {
  const heightAt = makeHeightAt(seed);
  const group = new THREE.Group();
  group.name = 'terrain';

  // --- Heightfield mesh (128x128 segments over 4200 m) ---
  const size = CONFIG.worldSize, seg = 128;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const hx = heightAt(x + 6, z) - heightAt(x - 6, z);
    const hz = heightAt(x, z + 6) - heightAt(x, z - 6);
    const slope = Math.hypot(hx, hz) / 12;
    terrainColor(h, slope, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  terrain.name = 'island';
  group.add(terrain);

  // --- Sea ---
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 9000),
    new THREE.MeshLambertMaterial({ color: 0x1d4e6b, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = CONFIG.seaLevel;
  sea.name = 'sea';
  group.add(sea);

  // --- Sunset sky dome (gradient + sun glow, GLSL) ---
  const skyGeo = new THREE.SphereGeometry(6000, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2b3a67) },
      midColor: { value: new THREE.Color(0xe8734a) },
      botColor: { value: new THREE.Color(0x7a4a6b) },
      sunDir: { value: new THREE.Vector3(-0.55, 0.28, -0.79).normalize() },
    },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir;
      uniform vec3 topColor, midColor, botColor, sunDir;
      void main(){
        float h = clamp(vDir.y, -0.08, 1.0);
        vec3 col = mix(midColor, topColor, smoothstep(0.02, 0.55, h));
        col = mix(botColor, col, smoothstep(-0.08, 0.06, vDir.y));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.75, 0.45) * pow(s, 90.0) * 1.4;   // sun disc
        col += vec3(1.0, 0.55, 0.25) * pow(s, 8.0) * 0.28;   // haze
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'sky';
  group.add(sky);

  // --- Sun billboard (warm disc the camera can see) ---
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(150, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }),
  );
  sun.position.set(-3300, 1050, -4700);
  sun.lookAt(0, 0, 0);
  sun.name = 'sun';
  group.add(sun);

  // --- Clouds: instanced puffs drifting slowly ---
  const rng = mulberry32(seed + 31);
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xffe0c8, emissive: 0x8a5a44, emissiveIntensity: 0.55, transparent: true, opacity: 0.9 });
  const puffs = new THREE.InstancedMesh(puffGeo, puffMat, 150);
  const dummy = new THREE.Object3D();
  let pi = 0;
  for (let cl = 0; cl < 42 && pi < 150; cl++) {
    const cx = (rng() - 0.5) * 3400, cz = (rng() - 0.5) * 3400, cy = 260 + rng() * 160;
    const n = 3 + Math.floor(rng() * 2);
    for (let k = 0; k < n && pi < 150; k++, pi++) {
      dummy.position.set(cx + (rng() - 0.5) * 90, cy + (rng() - 0.5) * 14, cz + (rng() - 0.5) * 40);
      const s = 26 + rng() * 30;
      dummy.scale.set(s, s * 0.42, s * 0.7);
      dummy.updateMatrix();
      puffs.setMatrixAt(pi, dummy.matrix);
    }
  }
  puffs.count = pi;
  puffs.name = 'clouds';
  group.add(puffs);

  // --- Runway: asphalt strip, centre dashes, threshold bars, numbers ---
  const rw = new THREE.Group();
  rw.name = 'runway';
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.length, RUNWAY.width),
    new THREE.MeshLambertMaterial({ color: 0x2e3138 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = RUNWAY.elevation + 0.15;
  rw.add(strip);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f2e8 });
  for (let d = -RUNWAY.length / 2 + 24; d < RUNWAY.length / 2 - 12; d += 32) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(d, RUNWAY.elevation + 0.3, 0);
    rw.add(dash);
  }
  for (const side of [-1, 1]) {
    for (let b = 0; b < 4; b++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.2), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(side * (RUNWAY.length / 2 - 14), RUNWAY.elevation + 0.3, -9 + b * 6);
      rw.add(bar);
    }
  }
  group.add(rw);

  // --- Windsocks (one at each runway end, cones point downwind) ---
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 9, 8),
      new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
    );
    pole.position.set(side * (RUNWAY.length / 2 + 26), RUNWAY.elevation + 4.5, 26);
    group.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 4.2, 10, 1, true),
      new THREE.MeshLambertMaterial({ color: 0xff7a1a, side: THREE.DoubleSide }),
    );
    sock.rotation.z = Math.PI / 2 - 0.35;
    sock.position.set(side * (RUNWAY.length / 2 + 26) - 2.2, RUNWAY.elevation + 8.6, 26);
    sock.name = 'windsock';
    group.add(sock);
  }

  // --- Hangars beside the runway ---
  const hangarMat = new THREE.MeshLambertMaterial({ color: 0x8a94a6 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5d6b7d });
  for (const [hx, hz] of [[-60, 52], [-10, 56], [44, 52]]) {
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 22), hangarMat);
    hangar.position.set(hx, RUNWAY.elevation + 6, hz);
    group.add(hangar);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 30, 12, 1, false, 0, Math.PI), roofMat);
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.set(hx, RUNWAY.elevation + 12, hz);
    group.add(roof);
  }

  // --- Coastal town: houses with pitched roofs, around the bay east ---
  const houseBodies = new THREE.InstancedMesh(
    new THREE.BoxGeometry(10, 7, 9),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    46,
  );
  const houseRoofs = new THREE.InstancedMesh(
    new THREE.ConeGeometry(7.5, 4.5, 4),
    new THREE.MeshLambertMaterial({ color: 0xb5502e }),
    46,
  );
  const wallColors = [0xf2e3c6, 0xe8d8b0, 0xdfe8f0, 0xf0d0c0, 0xe6dcc8];
  const townRng = mulberry32(seed + 77);
  let hi = 0;
  for (let i = 0; i < 90 && hi < 46; i++) {
    const x = 560 + townRng() * 420, z = -420 + townRng() * 520;
    const h = heightAt(x, z);
    if (h < 3 || h > 26) continue;
    dummy.position.set(x, h + 3.5, z);
    dummy.rotation.set(0, townRng() * Math.PI, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    houseBodies.setMatrixAt(hi, dummy.matrix);
    houseBodies.setColorAt(hi, new THREE.Color(wallColors[i % wallColors.length]));
    dummy.position.y = h + 9.2;
    dummy.updateMatrix();
    houseRoofs.setMatrixAt(hi, dummy.matrix);
    hi++;
  }
  houseBodies.count = hi; houseRoofs.count = hi;
  houseBodies.name = 'town-houses'; houseRoofs.name = 'town-roofs';
  group.add(houseBodies); group.add(houseRoofs);

  // --- Lighthouse on the eastern point ---
  const lh = new THREE.Group();
  lh.name = 'lighthouse';
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5.5, 26, 12),
    new THREE.MeshLambertMaterial({ color: 0xf5f2e8 }),
  );
  tower.position.y = 13;
  lh.add(tower);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.8, 6, 12),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  band.position.y = 13;
  lh.add(band);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.y = 28;
  lh.add(lamp);
  lh.position.set(1080, heightAt(1080, -620), -620);
  group.add(lh);

  // --- Trees: instanced trunks + canopies on the hills ---
  const treeRng = mulberry32(seed + 123);
  const treeCount = 260;
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.5, 0.8, 5, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
    treeCount,
  );
  const canopies = new THREE.InstancedMesh(
    new THREE.ConeGeometry(4.2, 11, 8),
    new THREE.MeshLambertMaterial({ color: 0x2c5a26 }),
    treeCount,
  );
  let ti = 0;
  for (let i = 0; i < 1200 && ti < treeCount; i++) {
    const x = (treeRng() - 0.5) * 2600, z = (treeRng() - 0.5) * 2600;
    const h = heightAt(x, z);
    if (h < 12 || h > 46 || runwayDistance(x, z) < 180) continue;
    const s = 0.8 + treeRng() * 0.9;
    dummy.position.set(x, h + 2.5 * s, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunks.setMatrixAt(ti, dummy.matrix);
    dummy.position.y = h + (5 + 5.5) * s - 2.5 * s;
    dummy.updateMatrix();
    canopies.setMatrixAt(ti, dummy.matrix);
    ti++;
  }
  trunks.count = ti; canopies.count = ti;
  trunks.name = 'trees-trunks'; canopies.name = 'trees-canopies';
  group.add(trunks); group.add(canopies);

  return { group, heightAt };
}
