#!/usr/bin/env node
// Writes the short rest-timer chime (two soft sine tones) as a 16-bit mono WAV.
// Bundled and precached so it plays offline. Run once; output is committed.
import { writeFileSync } from 'node:fs';

const rate = 22050;
const tones = [
  { freq: 880, start: 0, dur: 0.14 },
  { freq: 1318.5, start: 0.18, dur: 0.22 },
];
const total = 0.45;
const samples = new Int16Array(Math.round(rate * total));
for (const { freq, start, dur } of tones) {
  const first = Math.round(start * rate);
  const count = Math.round(dur * rate);
  for (let i = 0; i < count; i += 1) {
    const t = i / rate;
    const attack = Math.min(1, t / 0.01);
    const release = Math.min(1, (dur - t) / 0.08);
    const env = Math.max(0, Math.min(attack, release));
    samples[first + i] += Math.round(Math.sin(2 * Math.PI * freq * t) * env * 0.45 * 32767);
  }
}
const data = Buffer.from(samples.buffer);
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
writeFileSync('public/sounds/rest-done.wav', Buffer.concat([header, data]));
console.log('wrote public/sounds/rest-done.wav');
