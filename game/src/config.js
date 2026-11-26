// config.js — one place for every tuning number of Merpati Senja.
// Balance targets (see balance-check notes in the progress file):
// a full sortie takes ~3-4 minutes; fuel lasts ~5 minutes at cruise so a
// careless full-throttle run can run dry; rings pay 100, landing up to 300.
export const CONFIG = {
  seedDefault: 7,
  worldSize: 4200,          // terrain plane, metres across
  islandRadius: 1500,       // island falls into the sea beyond this
  seaLevel: 0,
  runway: {
    // Runway strip, centred at the origin, running east-west (along X).
    x: 0, z: 0, length: 420, width: 30, headingDeg: 90, elevation: 4,
  },
  plane: {
    minSpeed: 16,           // below this the wing stops flying
    maxSpeed: 78,           // flat-out, full throttle, level
    cruiseSpeed: 46,
    accel: 14,              // m/s^2 toward target speed
    turnRate: 0.55,         // yaw rad/s at full bank
    pitchRate: 0.45,
    rollRate: 1.9,
    maxBankDeg: 55,
    maxPitchDeg: 28,
    sinkStall: 9,           // m/s sink when stalled
    fuelDrainPerSec: 0.32,  // %/s at full throttle (cruise ~0.19)
    fuelStart: 100,
    damageCrashTerrain: 100,
  },
  rings: {
    count: 8,
    radius: 9,              // torus ring radius, metres
    passDistance: 8.5,      // plane within this of centre counts
    score: 100,
    timeBonusPerSecLeft: 2, // bonus at landing, per second under par
    parSeconds: 210,
  },
  landing: {
    maxSink: 5.5,           // m/s — harder than this on touchdown = crash
    maxSpeed: 38,
    maxBankDeg: 14,
    scoreBase: 150,
    scoreSoftBonus: 150,    // extra for a gentle touchdown
  },
  camera: {
    chaseDistance: 13,
    chaseHeight: 4.2,
    cockpitOffset: { x: 0, y: 1.75, z: 0.1 },
  },
};

// Distance from (x,z) to the runway centre segment (along X at z=0).
// Pure geometry: lives here so tests can use it without Three.js.
export function runwayDistance(x, z) {
  const cx = Math.max(-CONFIG.runway.length / 2, Math.min(CONFIG.runway.length / 2, x));
  return Math.hypot(x - cx, z);
}
export const RING_COURSE = [
  { x: 320, z: -40, y: 70 },
  { x: 620, z: -260, y: 90 },
  { x: 780, z: -640, y: 120 },
  { x: 420, z: -980, y: 140 },
  { x: -80, z: -1060, y: 130 },
  { x: -560, z: -820, y: 110 },
  { x: -760, z: -420, y: 90 },
  { x: -520, z: -80, y: 70 },
];
