/**
 * 60秒のシンプルで明るいBGM
 * ウクレレ + 手拍子だけ
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_RATE = 44100;
const DURATION = 60;
const NUM_SAMPLES = SAMPLE_RATE * DURATION;
const BPM = 140;
const BEAT = 60 / BPM;

function noteToFreq(note, octave) {
  const notes = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return 440 * Math.pow(2, (notes[note] + (octave - 4) * 12 - 9) / 12);
}

// Karplus-Strong 弦シミュレーション
class PluckedString {
  constructor(freq, brightness = 0.45) {
    this.period = Math.round(SAMPLE_RATE / freq);
    this.buffer = new Float32Array(this.period);
    this.pos = 0;
    this.b = brightness;
    for (let i = 0; i < this.period; i++) {
      this.buffer[i] = Math.random() * 2 - 1;
    }
  }
  process() {
    const cur = this.buffer[this.pos];
    const next = this.buffer[(this.pos + 1) % this.period];
    this.buffer[this.pos] = (cur * this.b + next * (1 - this.b)) * 0.996;
    this.pos = (this.pos + 1) % this.period;
    return cur;
  }
}

// 手拍子
function clap(t, seed) {
  if (t < 0 || t > 0.06) return 0;
  const env = Math.exp(-t * 50);
  const n = Math.floor(t * SAMPLE_RATE + seed);
  return (Math.sin(n * 12.9898 + n * 78.233) * 43758.5453 % 1 * 2 - 1) * env * 0.12;
}

// C → F → G → C
const chords = [
  { notes: [["C", 4], ["E", 4], ["G", 4], ["C", 5]], dur: 4 * BEAT },
  { notes: [["F", 4], ["A", 4], ["C", 5], ["F", 5]], dur: 4 * BEAT },
  { notes: [["G", 4], ["B", 4], ["D", 5], ["G", 5]], dur: 4 * BEAT },
  { notes: [["C", 4], ["E", 4], ["G", 4], ["C", 5]], dur: 4 * BEAT },
];
const CYCLE_DUR = chords.reduce((s, c) => s + c.dur, 0);

function generateBGM() {
  const left = new Float32Array(NUM_SAMPLES);
  const right = new Float32Array(NUM_SAMPLES);

  const ukeStrings = [];
  let lastStrumBeat = -1;

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    let sampleL = 0;
    let sampleR = 0;

    // フェードイン/アウト
    let vol = 1;
    if (t < 1) vol = t;
    if (t > DURATION - 2.5) vol = (DURATION - t) / 2.5;

    // コード位置
    const cycleTime = t % CYCLE_DUR;
    let chordIdx = 0;
    let elapsed = 0;
    for (let c = 0; c < chords.length; c++) {
      if (cycleTime < elapsed + chords[c].dur) { chordIdx = c; break; }
      elapsed += chords[c].dur;
    }
    const chord = chords[chordIdx];

    // --- ウクレレ: 毎拍ストラム ---
    const currentBeat = Math.floor(t / BEAT);
    if (currentBeat !== lastStrumBeat) {
      lastStrumBeat = currentBeat;
      const beatInBar = currentBeat % 4;
      const strumVol = (beatInBar === 0) ? 0.14 : (beatInBar === 2) ? 0.11 : 0.08;
      for (let s = 0; s < chord.notes.length; s++) {
        const [n, o] = chord.notes[s];
        ukeStrings.push({
          string: new PluckedString(noteToFreq(n, o)),
          start: i + s * Math.floor(SAMPLE_RATE * 0.008),
          vol: strumVol,
          pan: 0.3 + s * 0.13,
        });
      }
    }

    // ウクレレ発音
    for (let s = ukeStrings.length - 1; s >= 0; s--) {
      const uk = ukeStrings[s];
      if (i >= uk.start) {
        if ((i - uk.start) / SAMPLE_RATE > 0.7) { ukeStrings.splice(s, 1); continue; }
        const sample = uk.string.process() * uk.vol;
        sampleL += sample * (1 - uk.pan);
        sampleR += sample * uk.pan;
      }
    }

    // --- 手拍子: 2拍目と4拍目 ---
    const beatPos = t % BEAT;
    const beatNum = Math.floor(t / BEAT) % 4;
    if (beatNum === 1 || beatNum === 3) {
      const c = clap(beatPos, beatNum * 100);
      sampleL += c;
      sampleR += c;
    }

    left[i] = sampleL * vol;
    right[i] = sampleR * vol;
  }

  return { left, right };
}

function encodeWav(left, right) {
  const numSamples = left.length;
  const dataSize = numSamples * 4;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), offset); offset += 2;
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), offset); offset += 2;
  }
  return buffer;
}

console.log("BGM生成中...");
const { left, right } = generateBGM();
const wavBuffer = encodeWav(left, right);
const outputPath = path.join(__dirname, "..", "public", "bgm.wav");
fs.writeFileSync(outputPath, wavBuffer);
console.log(`完了: ${outputPath} (${(wavBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
