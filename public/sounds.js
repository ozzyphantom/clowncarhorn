// Every horn on clowncarhorn.com. Most are synthesized: a few oscillators and
// filters scheduled on the Web Audio API, no dependencies. Three are recordings.
//
// To add a horn, add one entry to HORNS. `build` receives a Kit and describes
// the sound relative to time zero. The Kit records every source it starts, so
// the player in script.js can cut a horn short and knows when it ends. `trim`
// scales a horn so it is as loud as the others; README.md says how to set it.

// The recordings: [file name in sounds/ without .mp3, trim].
export const RECORDINGS = [['honk-1', 0.72], ['honk-2', 1.76], ['honk-3', 0.76]];

const RELEASE = 0.015; // seconds of fade added to every envelope, so nothing ends on a click

// 'A4' → 440, 'Bb3' → 233.08, 'F#4' → 369.99
const STEPS = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
export function hz(note) {
    const [, letter, accidental, octave] = /^([A-G])([#b]?)(\d)$/.exec(note);
    const steps = STEPS[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) + (octave - 4) * 12;
    return 440 * 2 ** (steps / 12);
}

// A breakpoint list is [[seconds, value], ...]. A third item changes how the
// value is reached: 'exp' for an exponential ramp, 'step' for a jump. The
// default is a straight line.

// Sustained blast: rise, hold, fall.
const blast = (length, attack = 0.012, release = 0.05) => [[0, 0], [attack, 1], [length - release, 1], [length, 0]];

// Multiply every value in a breakpoint list. Turns a pitch bend into Hz.
const times = (points, factor) => points.map(([time, value, how]) => [time, value * factor, how]);

// One second of white noise per sample rate, looped by Kit.noise().
const hissBuffers = new Map();
function hiss(ctx) {
    const rate = ctx.sampleRate;
    if (!hissBuffers.has(rate)) {
        const buffer = ctx.createBuffer(1, rate, rate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        hissBuffers.set(rate, buffer);
    }
    return hissBuffers.get(rate);
}

class Kit {
    constructor(ctx, out, when) {
        this.ctx = ctx;
        this.out = out;
        this.when = when;
        this.sources = [];
        this.end = when;
    }

    // Schedule a constant or a breakpoint list on an AudioParam.
    set(param, start, shape, factor = 1) {
        if (typeof shape === 'number') {
            param.setValueAtTime(shape * factor, start);
            return;
        }
        shape.forEach(([time, value, how], i) => {
            if (i === 0 || how === 'step') param.setValueAtTime(value * factor, start + time);
            else if (how === 'exp') param.exponentialRampToValueAtTime(value * factor, start + time);
            else param.linearRampToValueAtTime(value * factor, start + time);
        });
    }

    // Loudness envelope with an optional filter in front of it. Sources
    // connect to `input` and stop at `stop`.
    chain(start, env, level, filter) {
        const stop = start + env[env.length - 1][0] + RELEASE;
        const amp = this.ctx.createGain();
        this.set(amp.gain, start, env, level);
        amp.gain.linearRampToValueAtTime(0, stop);
        amp.connect(this.out);
        let input = amp;
        if (filter) {
            input = this.ctx.createBiquadFilter();
            input.type = filter.type;
            input.Q.value = filter.q;
            this.set(input.frequency, start, filter.freq);
            input.connect(amp);
        }
        this.end = Math.max(this.end, stop);
        return { input, stop };
    }

    run(source, start, stop) {
        source.start(start);
        source.stop(stop);
        this.sources.push(source);
    }

    // One pitch: an oscillator, or several detuned ones, through one envelope.
    //   at       start, in seconds after the horn begins
    //   type     oscillator waveform
    //   freq     Hz: a number or a breakpoint list
    //   env      loudness breakpoints; the last one sets the length
    //   level    scales env
    //   detune   one oscillator per entry, in cents
    //   filter   { type, freq, q }; freq is a number or a breakpoint list
    //   vibrato  { rate, depth }; depth in cents, a number or a breakpoint list
    tone({ at = 0, type = 'sawtooth', freq, env, level = 1, detune = [0], filter, vibrato }) {
        const start = this.when + at;
        const { input, stop } = this.chain(start, env, level, filter);
        let wobble;
        if (vibrato) {
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = vibrato.rate;
            wobble = this.ctx.createGain();
            this.set(wobble.gain, start, vibrato.depth);
            lfo.connect(wobble);
            this.run(lfo, start, stop);
        }
        for (const cents of detune) {
            const osc = this.ctx.createOscillator();
            osc.type = type;
            this.set(osc.frequency, start, freq);
            osc.detune.value = cents;
            if (wobble) wobble.connect(osc.detune);
            osc.connect(input);
            this.run(osc, start, stop);
        }
    }

    // Hiss through a filter: steam and air.
    noise({ at = 0, env, level = 1, filter }) {
        const start = this.when + at;
        const { input, stop } = this.chain(start, env, level, filter);
        const source = this.ctx.createBufferSource();
        source.buffer = hiss(this.ctx);
        source.loop = true;
        source.connect(input);
        this.run(source, start, stop);
    }

    // A recording, or the audible part of one.
    sample(buffer, offset = 0, length = buffer.duration - offset) {
        const { input, stop } = this.chain(this.when, [[0, 1], [length - RELEASE, 1]], 1);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(input);
        source.start(this.when, offset);
        source.stop(stop);
        this.sources.push(source);
    }
}

// Schedule `horn` on `ctx`, into the node `out`, starting at `when`.
export function sound(horn, ctx, out, when) {
    const kit = new Kit(ctx, out, when);
    horn.build(kit);
    return { sources: kit.sources, end: kit.end };
}

// Timbres, taken from the spectra of the three recordings in sounds/.
const BULB = { type: 'bandpass', freq: 1600, q: 1.1 };    // rubber-bulb horn: reed at 500-800 Hz, loudest near 1.6 kHz
const CAR = { type: 'bandpass', freq: 650, q: 0.8 };      // electric car horn: weak fundamental, strong 400-900 Hz
const TRUMPET = { type: 'bandpass', freq: 1500, q: 0.8 }; // musical air horn

// Air horns start flat while the pressure builds and sag as it runs out.
const air = (length) => [[0, 0.93], [0.07, 1], [length - 0.17, 1], [length, 0.9]];

export const HORNS = [
    // The original eight.
    {
        name: 'classic',
        trim: 1.88,
        build(k) {
            k.tone({ freq: [[0, 220], [0.15, 180, 'exp'], [0.25, 260, 'exp']], env: [[0, 0.5], [0.4, 0.01, 'exp']] });
        },
    },
    {
        name: 'high',
        trim: 1.38,
        build(k) {
            k.tone({ type: 'square', freq: [[0, 440], [0.08, 520, 'exp'], [0.3, 350, 'exp']], env: [[0, 0.35], [0.35, 0.01, 'exp']] });
        },
    },
    {
        name: 'double',
        trim: 2.37,
        build(k) {
            for (const at of [0, 0.15]) {
                k.tone({ at, freq: [[0, 300], [0.12, 200, 'exp']], env: [[0, 0.4], [0.15, 0.01, 'exp']] });
            }
        },
    },
    {
        name: 'sad-trombone',
        trim: 1.97,
        build(k) {
            k.tone({ type: 'triangle', freq: [[0, 350], [0.6, 150]], env: [[0, 0.45], [0.65, 0.01, 'exp']] });
        },
    },
    {
        name: 'buzzy',
        trim: 1.76,
        build(k) {
            // Two waveforms two hertz apart beat against each other.
            const env = [[0, 0.3], [0.4, 0.01, 'exp']];
            k.tone({ freq: [[0, 185], [0.1, 250, 'exp'], [0.35, 160, 'exp']], env });
            k.tone({ type: 'square', freq: [[0, 187], [0.1, 253, 'exp'], [0.35, 162, 'exp']], env });
        },
    },
    {
        name: 'squeaky',
        trim: 1.62,
        build(k) {
            k.tone({ type: 'sine', freq: [[0, 800], [0.05, 1200, 'exp'], [0.2, 600, 'exp']], env: [[0, 0.3], [0.25, 0.01, 'exp']] });
        },
    },
    {
        name: 'foghorn',
        trim: 1.3,
        build(k) {
            const env = [[0, 0], [0.05, 0.4], [0.4, 0.4], [0.7, 0.01, 'exp']];
            k.tone({ freq: [[0, 80], [0.6, 75]], env });
            k.tone({ freq: [[0, 81], [0.6, 76]], env });
        },
    },
    {
        name: 'party',
        trim: 1.32,
        build(k) {
            k.tone({ freq: [[0, 400], [0.3, 600], [0.5, 580]], env: [[0, 0], [0.02, 0.35], [0.35, 0.35], [0.55, 0.01, 'exp']] });
        },
    },

    // Car and street.
    {
        name: 'ahooga',
        trim: 0.51,
        build(k) {
            // Klaxon: the motor spins up through "ah", holds "OO", runs down through "gah".
            k.tone({
                freq: [[0, 110], [0.1, 190, 'exp'], [0.2, 415, 'exp'], [0.58, 425], [0.9, 120, 'exp']],
                detune: [0, 12],
                env: [[0, 0], [0.015, 0.8], [0.2, 1], [0.6, 1], [0.86, 0.35], [0.92, 0]],
                filter: { type: 'bandpass', freq: [[0, 500], [0.2, 1500], [0.58, 1500], [0.9, 450]], q: 0.9 },
            });
        },
    },
    {
        name: 'bulb',
        trim: 0.76,
        build(k) {
            // Rubber bulb: a hard honk on the squeeze, a softer one as the bulb refills.
            k.tone({ freq: [[0, 600], [0.03, 660, 'exp'], [0.2, 630]], env: [[0, 0], [0.008, 1], [0.15, 0.85], [0.21, 0]], filter: BULB });
            k.tone({ at: 0.27, freq: [[0, 545], [0.16, 520]], env: [[0, 0], [0.02, 0.6], [0.11, 0.5], [0.18, 0]], filter: BULB });
        },
    },
    {
        name: 'beep-beep',
        trim: 0.53,
        build(k) {
            // Small car: two tones a major third apart, two quick taps.
            for (const at of [0, 0.2]) {
                for (const freq of [313, 393]) k.tone({ at, freq, env: blast(0.13, 0.004, 0.025), filter: CAR });
            }
        },
    },
    {
        name: 'scooter',
        trim: 0.72,
        build(k) {
            // Moped: thin, nasal and a little unsteady.
            k.tone({
                type: 'square',
                freq: [[0, 590], [0.02, 640, 'exp'], [0.34, 625]],
                env: blast(0.36, 0.005, 0.03),
                filter: { type: 'bandpass', freq: 2600, q: 1.6 },
                vibrato: { rate: 31, depth: 22 },
            });
        },
    },
    {
        name: 'truck',
        trim: 0.24,
        build(k) {
            // Big rig: two low trumpets a minor third apart.
            for (const freq of [185, 220]) {
                k.tone({
                    freq: times(air(0.92), freq),
                    detune: [-6, 6],
                    env: [[0, 0], [0.05, 1], [0.75, 1], [0.92, 0]],
                    filter: { type: 'lowpass', freq: [[0, 900], [0.08, 2600], [0.75, 2600], [0.92, 700]], q: 0.8 },
                });
            }
        },
    },
    {
        name: 'drive-by',
        trim: 0.61,
        build(k) {
            // A car passing with the horn held down: louder, then lower.
            const doppler = [[0, 1.05], [0.45, 1.045], [0.62, 0.955], [1.1, 0.95]];
            for (const freq of [313, 393]) {
                k.tone({
                    freq: times(doppler, freq),
                    env: [[0, 0], [0.45, 0.6], [0.53, 1], [0.62, 0.6], [1.1, 0]],
                    filter: { type: 'bandpass', freq: [[0, 700], [0.53, 800], [1.1, 450]], q: 0.8 },
                });
            }
        },
    },
    {
        name: 'dying',
        trim: 0.81,
        build(k) {
            // Flat battery: the horn sags, flutters and gives up.
            k.tone({
                freq: [[0, 430], [0.15, 410], [1, 130, 'exp'], [1.25, 70, 'exp']],
                env: [[0, 0], [0.01, 1], [0.5, 0.85], [1, 0.5], [1.25, 0]],
                filter: { type: 'bandpass', freq: [[0, 1400], [1.25, 400]], q: 0.9 },
                vibrato: { rate: 9, depth: [[0, 0], [0.3, 10], [1.25, 90]] },
            });
        },
    },
    {
        name: 'nee-naw',
        trim: 0.28,
        build(k) {
            // Two-tone horn of a European fire engine: D5, A4, D5, A4.
            [587, 440, 587, 440].forEach((freq, i) => {
                k.tone({ at: i * 0.3, type: 'square', freq, env: blast(0.3, 0.015, 0.02), filter: { type: 'lowpass', freq: 2400, q: 0.7 } });
            });
        },
    },

    // Big and loud.
    {
        name: 'train',
        trim: 0.21,
        build(k) {
            // Five-chime locomotive horn. The trumpets speak a few milliseconds apart.
            ['D#4', 'F#4', 'G#4', 'B4', 'D#5'].forEach((note, i) => {
                k.tone({
                    at: i * 0.012,
                    freq: times([[0, 0.95], [0.1, 1], [1.05, 1], [1.4, 0.93]], hz(note)),
                    env: [[0, 0], [0.07, 1], [1.05, 1], [1.4, 0]],
                    filter: { type: 'lowpass', freq: [[0, 800], [0.1, 2400], [1.05, 2400], [1.4, 600]], q: 0.7 },
                });
            });
        },
    },
    {
        name: 'air-horn',
        trim: 0.31,
        build(k) {
            // Aerosol can: piercing, out of tune with itself, dying as the can empties.
            k.tone({
                freq: times([[0, 0.9], [0.03, 1], [0.6, 1], [0.8, 0.82]], 465),
                detune: [-14, 0, 13],
                env: [[0, 0], [0.01, 1], [0.62, 1], [0.8, 0]],
                filter: { type: 'bandpass', freq: 2100, q: 0.6 },
            });
        },
    },
    {
        name: 'vuvuzela',
        trim: 0.85,
        build(k) {
            // Stadium horn: one buzzing B-flat that wavers with the breath behind it.
            k.tone({
                freq: [[0, 205], [0.07, 235, 'exp'], [0.5, 231], [0.9, 236], [1.05, 222]],
                env: [[0, 0], [0.05, 1], [0.9, 0.9], [1.1, 0]],
                filter: { type: 'bandpass', freq: 900, q: 0.6 },
                vibrato: { rate: 23, depth: 9 },
            });
        },
    },
    {
        name: 'steam-whistle',
        trim: 0.27,
        build(k) {
            // Three pipes and the hiss of steam. A short toot, then a long one.
            const toot = (at, length) => {
                const bend = [[0, 0.9], [0.09, 1, 'exp'], [length - 0.1, 1], [length, 0.93]];
                for (const note of ['A4', 'C5', 'E5']) {
                    k.tone({ at, type: 'triangle', freq: times(bend, hz(note)), env: [[0, 0], [0.05, 1], [length - 0.1, 0.9], [length, 0]] });
                }
                k.noise({ at, env: [[0, 0], [0.02, 1], [length - 0.1, 0.7], [length, 0]], level: 0.2, filter: { type: 'bandpass', freq: 3000, q: 0.5 } });
            };
            toot(0, 0.2);
            toot(0.3, 0.75);
        },
    },

    // Tunes and fanfares.
    {
        name: 'cucaracha',
        trim: 0.62,
        build(k) {
            // Musical air horn. "La Cucaracha" is a traditional tune in the public domain.
            const beat = 0.105;
            const phrase = [['G4', 0, 0.8], ['G4', 1, 0.8], ['G4', 2, 0.8], ['C5', 3, 2.4], ['E5', 5.5, 2.2]];
            for (const start of [0, 8.2]) {
                for (const [note, at, length] of phrase) {
                    k.tone({ at: (start + at) * beat, freq: hz(note), env: blast(length * beat, 0.008, 0.03), filter: TRUMPET });
                }
            }
        },
    },
    {
        name: 'shave-and-a-haircut',
        trim: 0.79,
        build(k) {
            // The knock everyone answers: five honks, a rest, two more.
            const eighth = 0.105;
            const tune = [['C5', 0, 2], ['G4', 2, 1], ['G4', 3, 1], ['A4', 4, 2], ['G4', 6, 2], ['B4', 10, 2], ['C5', 12, 2]];
            for (const [note, at, length] of tune) {
                k.tone({ at: at * eighth, freq: hz(note), env: blast(length * eighth * 0.78, 0.008, 0.03), filter: BULB });
            }
        },
    },
    {
        name: 'ta-da',
        trim: 0.14,
        build(k) {
            // Circus fanfare: a short pickup, then the big chord with a late shake.
            const brass = (at, length, notes, vibrato) => {
                for (const note of notes) {
                    k.tone({
                        at,
                        freq: hz(note),
                        detune: [-6, 6],
                        env: [[0, 0], [0.02, 1], [length - 0.08, 0.85], [length, 0]],
                        filter: { type: 'lowpass', freq: [[0, 500], [0.04, 3400], [0.14, 2300], [length, 1500]], q: 1.2 },
                        vibrato,
                    });
                }
            };
            brass(0, 0.12, ['G4', 'C5', 'E5']);
            brass(0.17, 0.8, ['C5', 'E5', 'G5', 'C6'], { rate: 5.5, depth: [[0, 0], [0.3, 0], [0.6, 14]] });
        },
    },
    {
        name: 'womp-womp',
        trim: 0.62,
        build(k) {
            // Sad trombone, the long version: three falling "wah"s and a last one that sags.
            [['D4', 0, 0.3], ['C#4', 0.33, 0.3], ['C4', 0.66, 0.3], ['B3', 0.99, 0.85]].forEach(([note, at, length], i) => {
                const f = hz(note);
                const last = i === 3;
                k.tone({
                    at,
                    freq: last ? [[0, f], [length * 0.35, f], [length, f * 0.88]] : [[0, f * 1.01], [length, f * 0.985]],
                    env: [[0, 0], [0.03, 1], [length - 0.08, 0.8], [length, 0]],
                    // The "wah": the mute opens, then closes.
                    filter: { type: 'lowpass', freq: [[0, 350], [0.09, 1500], [length, 450]], q: 2.5 },
                    vibrato: last ? { rate: 5.5, depth: [[0, 0], [0.25, 18]] } : undefined,
                });
            });
        },
    },

    // Small and silly.
    {
        name: 'squeak-toy',
        trim: 0.34,
        build(k) {
            // Squeezed, the pitch shoots up. Let go, and it falls back.
            for (const [harmonic, level] of [[1, 1], [2, 0.3]]) {
                k.tone({ type: 'sine', freq: times([[0, 900], [0.09, 1500, 'exp']], harmonic), env: [[0, 0], [0.01, 1], [0.07, 0.8], [0.1, 0]], level });
                k.tone({ at: 0.16, type: 'sine', freq: times([[0, 1300], [0.12, 750, 'exp']], harmonic), env: [[0, 0], [0.01, 0.7], [0.09, 0.5], [0.13, 0]], level });
            }
        },
    },
];
