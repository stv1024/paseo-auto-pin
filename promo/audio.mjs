// Synthesizes the promo soundtrack as a 48 kHz stereo WAV, timed to promo.html.
// Usage: node promo/audio.mjs [out.wav]
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SR = 48000, DUR = 17;
const N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N);
const TAU = Math.PI * 2;
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

function add(t0, len, fn, pan = 0, gain = 1) {
  const s0 = Math.floor(t0 * SR), n = Math.floor(len * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n && s0 + i < N; i++) {
    if (s0 + i < 0) continue;
    const v = fn(i / SR, i / n);
    L[s0 + i] += v * gl; R[s0 + i] += v * gr;
  }
}

// Pad: two chords, detuned saws through a moving one-pole lowpass
const CHORDS = [[0, 8.4, [45, 52, 57, 59, 64]], [8.2, 17, [41, 48, 53, 57, 64, 67]]];
for (const [a, b, notes] of CHORDS) {
  notes.forEach((m, k) => {
    for (const det of [-0.07, 0.07]) {
      let y = 0, ph = rnd();
      const f = hz(m + det);
      add(a, b - a, (t, p) => {
        ph = (ph + f / SR) % 1;
        const saw = ph * 2 - 1;
        const abs = a + t;
        const cutoff = 300 + 1500 * Math.min(1, abs / 14) + 250 * Math.sin(abs * 1.3 + k);
        y += (1 - Math.exp(-TAU * cutoff / SR)) * (saw - y);
        const envA = Math.min(1, t / (a === 0 ? 1.6 : 0.5)), envR = Math.min(1, (b - a - t) / 0.9);
        return y * envA * envR;
      }, det * 5 + (k % 2 ? .25 : -.25), 0.022);
    }
  });
}

// Pulse: soft kick on the beat (100 bpm) from scene 2, with a sidechain-ish feel
const BEAT = 60 / 100;
for (let t = 2.4; t < 13.9; t += BEAT) {
  add(t, 0.45, (x) => Math.sin(TAU * (48 * x + 90 * (1 - Math.exp(-x * 30)) / 30)) * Math.exp(-x * 9), 0, 0.28);
}
// Hats on offbeats
for (let t = 2.4 + BEAT / 2; t < 13.9; t += BEAT) {
  let hp = 0, prev = 0;
  add(t, 0.08, (x) => { const n = rnd(); hp = 0.9 * (hp + n - prev); prev = n; return hp * Math.exp(-x * 60); }, 0.3, 0.035);
}

// Whooshes: band-swept noise rising into each scene change
function whoosh(tHit, len = 0.7, gain = 0.16) {
  let lp = 0, lp2 = 0;
  add(tHit - len, len + 0.25, (x, p) => {
    const q = Math.min(1, x / len);
    const cutoff = 200 + 5000 * q * q;
    const a = 1 - Math.exp(-TAU * cutoff / SR);
    lp += a * (rnd() - lp); lp2 += a * (lp - lp2);
    const env = x < len ? q * q : Math.exp(-(x - len) * 18);
    return (lp - lp2) * env * 3;
  }, 0, gain);
}
[1.3, 2.45, 6.95, 11.3, 14.05].forEach((t) => whoosh(t));

// UI clicks
[3.5, 7.85, 8.85, 9.35, 9.9].forEach((t) => {
  add(t, 0.05, (x) => (Math.sin(TAU * 2400 * x) * 0.6 + rnd() * 0.4) * Math.exp(-x * 140), 0.1, 0.12);
});

// Chimes: pin lands (5.4) and logo reveal (14.1)
function chime(t0, notes, gain) {
  notes.forEach((m, i) => add(t0 + i * 0.07, 2.4, (x) =>
    (Math.sin(TAU * hz(m) * x) + 0.3 * Math.sin(TAU * hz(m) * 2.01 * x)) * Math.exp(-x * 2.2) * Math.min(1, x * 400),
  i % 2 ? 0.35 : -0.35, gain));
}
chime(5.38, [76, 83, 88], 0.05);
chime(14.1, [69, 76, 81, 88, 93], 0.05);
// Impact under the logo
add(14.05, 1.6, (x) => Math.sin(TAU * (38 * x + 60 * (1 - Math.exp(-x * 20)) / 20)) * Math.exp(-x * 3.2), 0, 0.4);

// Simple stereo delay for space, then master fade + soft clip
const D = Math.floor(0.3 * SR);
for (let i = D; i < N; i++) { L[i] += R[i - D] * 0.22; R[i] += L[i - D] * 0.22; }
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, f = Math.min(1, t / 0.3, (DUR - t) / 0.8);
  L[i] = Math.tanh(L[i] * 1.4 * f); R[i] = Math.tanh(R[i] * 1.4 * f);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;

const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4);
}
const out = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "soundtrack.wav");
writeFileSync(out, buf);
console.log(`wrote ${out}`);
