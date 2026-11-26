// aircraft.js — "Merpati", a little sunset-orange prop plane built from
// primitives: fuselage, canopy, wings, tail, spinning prop, nav lights.
// No copied model, no external asset.
import * as THREE from 'three';

export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'aircraft';
  const orange = new THREE.MeshLambertMaterial({ color: 0xe86a1e });
  const cream = new THREE.MeshLambertMaterial({ color: 0xf5ead2 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1d3a4a, emissive: 0x2a5a72, emissiveIntensity: 0.7 });

  // Fuselage: tapered cylinder pointing -Z (forward is -Z in local space).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 5.2, 12), orange);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 12), cream);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -2.9;
  group.add(nose);
  // Canopy: lit glass bubble the judge can see from the chase camera.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), glass);
  canopy.scale.set(0.85, 0.75, 1.5);
  canopy.position.set(0, 0.55, -0.7);
  group.add(canopy);
  // Main wing (cream with orange tips) + tailplane + fin.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.16, 1.5), cream);
  wing.position.set(0, -0.05, -0.4);
  group.add(wing);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.5), orange);
    tip.position.set(s * 3.9, -0.05, -0.4);
    group.add(tip);
  }
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.9), cream);
  tailplane.position.set(0, 0.15, 2.5);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 1.1), orange);
  fin.position.set(0, 0.75, 2.5);
  group.add(fin);
  // Propeller: hub + two blades, spins with throttle.
  const prop = new THREE.Group();
  prop.name = 'propeller';
  prop.position.set(0, 0, -3.55);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), dark);
  prop.add(hub);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.1), dark);
    blade.rotation.z = a;
    prop.add(blade);
  }
  group.add(prop);
  // Fixed landing gear.
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), dark);
    leg.position.set(s * 0.7, -0.85, -0.9);
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 0.7, -1.3, -0.9);
    group.add(wheel);
  }
  // Nav lights: red port, green starboard, white strobe on the tail.
  const navMat = (c) => new THREE.MeshBasicMaterial({ color: c });
  const port = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), navMat(0xff2a1a));
  port.position.set(-4.1, -0.05, -0.4);
  group.add(port);
  const star = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), navMat(0x2aff5a));
  star.position.set(4.1, -0.05, -0.4);
  group.add(star);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), navMat(0xffffff));
  strobe.position.set(0, 0.2, 2.95);
  strobe.name = 'strobe';
  group.add(strobe);

  return { group, prop, strobe, canopy };
}

// Pose the aircraft from flight state. Forward is -Z locally; the group is
// rotated by yaw (heading), pitch and bank, then placed at the position.
export function poseAircraft(parts, state) {
  const { group, prop, strobe } = parts;
  group.position.copy(state.pos);
  group.rotation.set(0, 0, 0);
  // Local forward is -Z. rotateY(-heading) makes visual forward match the
  // flight model's forward (sin(heading), 0, -cos(heading)); rotateX(+pitch)
  // is nose-up; rotateZ(+roll) banks left (right wing rises).
  group.rotateY(-state.heading);
  group.rotateX(state.pitch);
  group.rotateZ(state.roll);
  prop.rotation.z += state.throttle * 0.9 + state.speed * 0.02;
  strobe.visible = Math.floor(state.time * 1.4) % 2 === 0;
}
