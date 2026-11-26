// audio.js — all sound is synthesised with WebAudio: no audio files, no
// network. Engine hum follows throttle, rings chime, landings thud.
// Everything is guarded: no AudioContext until a user gesture, and every
// call is a no-op when sound is unavailable or muted.
export function createAudio() {
  let ctx = null;
  let engineOsc = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    } catch {
      return false;
    }
    try {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 110;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      started = true;
    } catch {
      return false;
    }
    return true;
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch { /* sound is decoration, never fatal */ }
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      return muted;
    },
    setEngine(throttle, speed01) {
      if (!ctx || !started || muted) return;
      try {
        const f = 52 + throttle * 85 + speed01 * 22;
        engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
        engineOsc2.frequency.setTargetAtTime(f * 2.01, ctx.currentTime, 0.08);
        engineFilter.frequency.setTargetAtTime(320 + throttle * 900, ctx.currentTime, 0.1);
        engineGain.gain.setTargetAtTime(0.028 + throttle * 0.05, ctx.currentTime, 0.1);
      } catch { /* ignore */ }
    },
    ringChime() {
      blip(880, 0.35, 'sine', 0.16);
      blip(1318, 0.5, 'sine', 0.12, 0.09);
    },
    touchdown() {
      blip(140, 0.25, 'sine', 0.22);
      blip(70, 0.3, 'triangle', 0.18, 0.02);
    },
    crash() {
      if (!ctx || muted) return;
      try {
        const dur = 0.5;
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = 0.3;
        src.connect(g); g.connect(ctx.destination);
        src.start();
      } catch { /* ignore */ }
    },
    fanfare() {
      blip(523, 0.3, 'sine', 0.14);
      blip(659, 0.3, 'sine', 0.14, 0.12);
      blip(784, 0.6, 'sine', 0.16, 0.24);
    },
  };
}
