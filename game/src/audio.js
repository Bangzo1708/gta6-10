// audio.js — every sound in Port Solano is synthesized live with the Web Audio API:
// a low engine hum that follows the car's speed, a two-tone police siren, a gunshot
// crack, a cash-register pickup chime, a mission-complete jingle and the wash of the
// sea. No audio files, no network — just oscillators and noise buffers.

export function makeAudio() {
  return {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenLfo: null,
    started: false,
  };
}

export function ensureAudio(a) {
  if (a.ctx) {
    if (a.ctx.state === 'suspended') a.ctx.resume();
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    a.ctx = new AC();
    a.master = a.ctx.createGain();
    a.master.gain.value = a.muted ? 0 : 0.5;
    a.master.connect(a.ctx.destination);
    // Engine: a sawtooth through a low-pass, pitched by speed.
    a.engineOsc = a.ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 55;
    a.engineGain = a.ctx.createGain();
    a.engineGain.gain.value = 0;
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    a.engineOsc.connect(lp); lp.connect(a.engineGain); a.engineGain.connect(a.master);
    a.engineOsc.start();
    // Siren: a sine whose pitch wobbles between two tones.
    a.sirenOsc = a.ctx.createOscillator();
    a.sirenOsc.type = 'sine';
    a.sirenOsc.frequency.value = 700;
    a.sirenLfo = a.ctx.createOscillator();
    a.sirenLfo.frequency.value = 0.7;
    const lfoGain = a.ctx.createGain();
    lfoGain.gain.value = 260;
    a.sirenLfo.connect(lfoGain); lfoGain.connect(a.sirenOsc.frequency);
    a.sirenGain = a.ctx.createGain();
    a.sirenGain.gain.value = 0;
    a.sirenOsc.connect(a.sirenGain); a.sirenGain.connect(a.master);
    a.sirenOsc.start(); a.sirenLfo.start();
    a.started = true;
    return true;
  } catch (e) {
    return false;
  }
}

function noiseBuffer(ctx, seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function setEngine(a, speedNorm, on) {
  if (!a.ctx) return;
  const t = a.ctx.currentTime;
  a.engineGain.gain.setTargetAtTime(on ? 0.05 + speedNorm * 0.06 : 0, t, 0.08);
  a.engineOsc.frequency.setTargetAtTime(52 + speedNorm * 130, t, 0.08);
}

export function setSiren(a, on, near) {
  if (!a.ctx) return;
  const t = a.ctx.currentTime;
  a.sirenGain.gain.setTargetAtTime(on ? (near ? 0.05 : 0.02) : 0, t, 0.2);
}

function blip(a, freq, dur, type, vol, when = 0) {
  if (!a.ctx) return;
  const t = a.ctx.currentTime + when;
  const o = a.ctx.createOscillator();
  o.type = type; o.frequency.value = freq;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(a.master);
  o.start(t); o.stop(t + dur + 0.02);
}

export function playShot(a) {
  if (!a.ctx) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = noiseBuffer(a.ctx, 0.12);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  const f = a.ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 900;
  src.connect(f); f.connect(g); g.connect(a.master);
  src.start(t);
}

export function playPickup(a) {
  blip(a, 880, 0.12, 'sine', 0.25);
  blip(a, 1320, 0.18, 'sine', 0.25, 0.09);
}

export function playMissionComplete(a) {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => blip(a, n, 0.22, 'triangle', 0.3, i * 0.13));
}

export function playCrash(a, hard) {
  if (!a.ctx) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = noiseBuffer(a.ctx, hard ? 0.3 : 0.12);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(hard ? 0.5 : 0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (hard ? 0.3 : 0.12));
  const f = a.ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 500;
  src.connect(f); f.connect(g); g.connect(a.master);
  src.start(t);
}

export function playBusted(a) {
  const notes = [392, 330, 262, 196];
  notes.forEach((n, i) => blip(a, n, 0.3, 'sawtooth', 0.14, i * 0.16));
}

export function setMuted(a, muted) {
  a.muted = muted;
  if (a.master) a.master.gain.value = muted ? 0 : 0.5;
}
