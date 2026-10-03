/**
 * Calm sounds made in the browser with the Web Audio API: rain, café, forest,
 * sea, fireplace and slow generative music. Nothing is downloaded and there is
 * no third-party audio, so there is nothing to license.
 */

export const SOUNDSCAPES = ['rain', 'cafe', 'forest', 'sea', 'fire'] as const;
export type Soundscape = typeof SOUNDSCAPES[number];
export const MUSIC_PIECES = ['morning', 'evening', 'waves'] as const;
export type MusicPiece = typeof MUSIC_PIECES[number];

export type SoundVoice = { output: GainNode; stop: () => void };

type NoiseColor = 'white' | 'pink' | 'brown';
const noiseCache = new WeakMap<BaseAudioContext, Partial<Record<NoiseColor, AudioBuffer>>>();

/** Ten seconds of looping noise; pink and brown are softer and closer to nature. */
export function noiseBuffer(ctx: BaseAudioContext, color: NoiseColor): AudioBuffer {
  const cached = noiseCache.get(ctx) ?? {};
  if (cached[color]) return cached[color]!;
  const length = ctx.sampleRate * 10;
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (color === 'white') data[i] = white * 0.5;
      else if (color === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852; b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }
  }
  cached[color] = buffer;
  noiseCache.set(ctx, cached);
  return buffer;
}

function noiseSource(ctx: BaseAudioContext, color: NoiseColor): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, color);
  source.loop = true;
  source.loopStart = Math.random() * 5;
  return source;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

/** A slow wobble added to an AudioParam (gain, frequency…). */
function lfo(ctx: BaseAudioContext, target: AudioParam, rate: number, depth: number): OscillatorNode {
  const osc = ctx.createOscillator();
  const amount = ctx.createGain();
  osc.frequency.value = rate;
  amount.gain.value = depth;
  osc.connect(amount).connect(target);
  osc.start();
  return osc;
}

type Scheduler = { stop: () => void };

/** Calls `play` at random moments between min and max seconds. */
function every(minSeconds: number, maxSeconds: number, play: () => void): Scheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const next = () => {
    if (stopped) return;
    timer = setTimeout(() => { play(); next(); }, (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000);
  };
  next();
  return { stop: () => { stopped = true; if (timer) clearTimeout(timer); } };
}

function burst(ctx: AudioContext, output: AudioNode, options: { frequency: number; q: number; duration: number; level: number; pan?: number }) {
  const source = noiseSource(ctx, 'white');
  const band = filter(ctx, 'bandpass', options.frequency, options.q);
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner();
  panner.pan.value = options.pan ?? (Math.random() * 2 - 1) * 0.6;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(options.level, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
  source.connect(band).connect(gain).connect(panner).connect(output);
  source.start(now);
  source.stop(now + options.duration + 0.05);
}

function chirp(ctx: AudioContext, output: AudioNode) {
  const base = 2200 + Math.random() * 2200;
  const notes = 2 + Math.floor(Math.random() * 4);
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.random() * 1.6 - 0.8;
  panner.connect(output);
  for (let i = 0; i < notes; i += 1) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + i * (0.11 + Math.random() * 0.06);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), start);
    osc.frequency.exponentialRampToValueAtTime(base * (1.15 + Math.random() * 0.3), start + 0.07);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.05, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
    osc.connect(gain).connect(panner);
    osc.start(start);
    osc.stop(start + 0.12);
  }
}

function clink(ctx: AudioContext, output: AudioNode) {
  const base = 2600 + Math.random() * 1500;
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.random() * 1.4 - 0.7;
  panner.connect(output);
  [1, 2.76, 5.4].forEach((ratio, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.frequency.value = base * ratio;
    gain.gain.setValueAtTime(0.025 / (index + 1), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5 / (index + 1));
    osc.connect(gain).connect(panner);
    osc.start(now);
    osc.stop(now + 0.6);
  });
}

export function createSoundscape(ctx: AudioContext, kind: Soundscape): SoundVoice {
  const output = ctx.createGain();
  output.gain.value = 1;
  const sources: AudioScheduledSourceNode[] = [];
  const schedulers: Scheduler[] = [];
  const layer = (color: NoiseColor, nodes: AudioNode[], level: number) => {
    const source = noiseSource(ctx, color);
    const gain = ctx.createGain();
    gain.gain.value = level;
    let previous: AudioNode = source;
    for (const node of nodes) { previous.connect(node); previous = node; }
    previous.connect(gain).connect(output);
    source.start();
    sources.push(source);
    return gain;
  };

  if (kind === 'rain') {
    layer('pink', [filter(ctx, 'highpass', 500), filter(ctx, 'lowpass', 7000)], 0.55);
    const patter = layer('white', [filter(ctx, 'bandpass', 3200, 0.9)], 0.06);
    sources.push(lfo(ctx, patter.gain, 0.23, 0.03));
    schedulers.push(every(0.05, 0.25, () => burst(ctx, output, { frequency: 2500 + Math.random() * 3000, q: 4, duration: 0.03, level: 0.05 + Math.random() * 0.05 })));
  } else if (kind === 'sea') {
    const surf = layer('brown', [filter(ctx, 'lowpass', 900)], 0.35);
    sources.push(lfo(ctx, surf.gain, 0.09, 0.3));
    const foam = filter(ctx, 'bandpass', 1400, 0.5);
    const hiss = layer('pink', [foam], 0.08);
    sources.push(lfo(ctx, hiss.gain, 0.09, 0.07));
    sources.push(lfo(ctx, foam.frequency, 0.045, 500));
  } else if (kind === 'fire') {
    layer('brown', [filter(ctx, 'lowpass', 350)], 0.5);
    const roar = layer('pink', [filter(ctx, 'bandpass', 700, 0.6)], 0.04);
    sources.push(lfo(ctx, roar.gain, 0.4, 0.02));
    schedulers.push(every(0.08, 0.6, () => burst(ctx, output, { frequency: 1800 + Math.random() * 3500, q: 1.5, duration: 0.01 + Math.random() * 0.03, level: 0.12 + Math.random() * 0.2 })));
  } else if (kind === 'forest') {
    const windBand = filter(ctx, 'bandpass', 450, 0.4);
    const wind = layer('pink', [windBand], 0.22);
    sources.push(lfo(ctx, wind.gain, 0.07, 0.12));
    sources.push(lfo(ctx, windBand.frequency, 0.05, 180));
    layer('pink', [filter(ctx, 'highpass', 4000)], 0.025);
    schedulers.push(every(1.8, 6.5, () => chirp(ctx, output)));
  } else {
    // Café: a murmur of voices, a low room hum and the odd cup.
    for (const centre of [380, 620, 900]) {
      const band = filter(ctx, 'bandpass', centre, 1.2);
      const voices = layer('pink', [band], 0.11);
      sources.push(lfo(ctx, voices.gain, 2.5 + Math.random() * 3, 0.06));
      sources.push(lfo(ctx, band.frequency, 0.3 + Math.random() * 0.4, 90));
    }
    layer('brown', [filter(ctx, 'lowpass', 180)], 0.18);
    schedulers.push(every(3, 9, () => clink(ctx, output)));
  }

  return {
    output,
    stop: () => {
      schedulers.forEach((scheduler) => scheduler.stop());
      sources.forEach((source) => { try { source.stop(); } catch { /* already stopped */ } });
      output.disconnect();
    },
  };
}

/** A soft room so the music notes have a tail. */
function reverb(ctx: AudioContext, seconds = 3.2): ConvolverNode {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
  }
  const node = ctx.createConvolver();
  node.buffer = impulse;
  return node;
}

const PIECES: Record<MusicPiece, { root: number; scale: number[]; chords: number[][]; tempo: number; bell: OscillatorType }> = {
  // Frequencies from semitone offsets around a root note.
  morning: { root: 261.63, scale: [0, 2, 4, 7, 9, 12, 14, 16], chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [2, 5, 9]], tempo: 9, bell: 'sine' },
  evening: { root: 220, scale: [0, 3, 5, 7, 10, 12, 15], chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], tempo: 11, bell: 'triangle' },
  waves: { root: 196, scale: [0, 2, 5, 7, 9, 12, 14], chords: [[0, 7, 12], [5, 9, 12], [-3, 4, 9], [2, 7, 11]], tempo: 13, bell: 'sine' },
};

const note = (root: number, semitones: number) => root * Math.pow(2, semitones / 12);

/** Slow generative music: soft pad chords and sparse bell notes in one scale. */
export function createMusic(ctx: AudioContext, piece: MusicPiece): SoundVoice {
  const spec = PIECES[piece];
  const output = ctx.createGain();
  const room = reverb(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  const dry = ctx.createGain();
  dry.gain.value = 0.5;
  dry.connect(output);
  room.connect(wet).connect(output);
  const bus = ctx.createGain();
  bus.connect(dry);
  bus.connect(room);
  const tone = filter(ctx, 'lowpass', 1400, 0.3);
  tone.connect(bus);

  let chordIndex = 0;
  let stopped = false;
  const timers: Array<ReturnType<typeof setTimeout>> = [];

  const playChord = () => {
    if (stopped) return;
    const chord = spec.chords[chordIndex % spec.chords.length];
    chordIndex += 1;
    const start = ctx.currentTime + 0.05;
    const length = spec.tempo;
    for (const offset of chord) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = note(spec.root / 2, offset);
        osc.detune.value = detune;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.018, start + length * 0.4);
        gain.gain.linearRampToValueAtTime(0, start + length * 1.15);
        osc.connect(gain).connect(tone);
        osc.start(start);
        osc.stop(start + length * 1.2);
      }
    }
    timers.push(setTimeout(playChord, length * 1000));
  };

  const playBell = () => {
    if (stopped) return;
    const start = ctx.currentTime + 0.02;
    const frequency = note(spec.root, spec.scale[Math.floor(Math.random() * spec.scale.length)]);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.random() * 1.2 - 0.6;
    osc.type = spec.bell;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.06, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 3.5);
    osc.connect(gain).connect(panner).connect(bus);
    osc.start(start);
    osc.stop(start + 3.6);
    timers.push(setTimeout(playBell, (1.6 + Math.random() * 3.4) * 1000));
  };

  playChord();
  timers.push(setTimeout(playBell, 1500));

  return {
    output,
    stop: () => {
      stopped = true;
      timers.forEach((timer) => clearTimeout(timer));
      output.disconnect();
    },
  };
}
