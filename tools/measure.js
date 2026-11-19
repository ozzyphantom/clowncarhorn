// Loudness check for the horns. Development only; nothing here is deployed.
//
// Run `corepack pnpm dev`, open http://localhost:8787 and paste this file into
// the browser console. It renders every horn offline and prints its length,
// peak, loudness and the `trim` that brings it to TARGET. Copy the trims into
// public/sounds.js.
//
// Loudness is the loudest 100 ms of the A-weighted signal, in dB below full
// scale. A-weighting follows the ear: a foghorn needs more level than a squeak
// to sound as loud. `trim` is capped so that the peak stays under CAP.
(async () => {
    const TARGET = -14;
    const CAP = 0.9;
    const RATE = 48000;
    const { HORNS, RECORDINGS, sound } = await import(`/sounds.js?measure=${Date.now()}`);

    // In-place radix-2 FFT.
    function fft(re, im, inverse) {
        const n = re.length;
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                [re[i], re[j]] = [re[j], re[i]];
                [im[i], im[j]] = [im[j], im[i]];
            }
        }
        for (let size = 2; size <= n; size <<= 1) {
            const angle = ((inverse ? 2 : -2) * Math.PI) / size;
            const stepRe = Math.cos(angle);
            const stepIm = Math.sin(angle);
            for (let i = 0; i < n; i += size) {
                let wRe = 1;
                let wIm = 0;
                for (let k = 0; k < size / 2; k++) {
                    const a = i + k;
                    const b = a + size / 2;
                    const vRe = re[b] * wRe - im[b] * wIm;
                    const vIm = re[b] * wIm + im[b] * wRe;
                    re[b] = re[a] - vRe;
                    im[b] = im[a] - vIm;
                    re[a] += vRe;
                    im[a] += vIm;
                    [wRe, wIm] = [wRe * stepRe - wIm * stepIm, wRe * stepIm + wIm * stepRe];
                }
            }
        }
        if (inverse) {
            for (let i = 0; i < n; i++) {
                re[i] /= n;
                im[i] /= n;
            }
        }
    }

    // IEC 61672 A-weighting as a linear gain, 0 dB at 1 kHz.
    function aWeight(f) {
        if (f < 10) return 0;
        const f2 = f * f;
        return (1.2589 * 12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
    }

    const dB = (v) => 20 * Math.log10(Math.max(v, 1e-9));

    function measure(samples) {
        const n = 1 << Math.ceil(Math.log2(samples.length));
        const re = new Float64Array(n);
        const im = new Float64Array(n);
        re.set(samples);
        fft(re, im, false);
        for (let i = 0; i <= n / 2; i++) {
            const gain = aWeight((i * RATE) / n);
            re[i] *= gain;
            im[i] *= gain;
            if (i && i < n / 2) {
                re[n - i] *= gain;
                im[n - i] *= gain;
            }
        }
        fft(re, im, true);

        const frame = RATE / 100; // 10 ms
        const frames = Math.floor(samples.length / frame);
        const energy = new Float64Array(frames);
        let peak = 0;
        let lastLoud = 0;
        for (let i = 0; i < frames; i++) {
            let plain = 0;
            for (let j = i * frame; j < (i + 1) * frame; j++) {
                peak = Math.max(peak, Math.abs(samples[j]));
                plain += samples[j] * samples[j];
                energy[i] += re[j] * re[j];
            }
            if (Math.sqrt(plain / frame) > 0.003) lastLoud = i + 1;
        }
        let loudest = 0;
        for (let i = 0; i + 10 <= frames; i++) {
            let sum = 0;
            for (let j = i; j < i + 10; j++) sum += energy[j];
            loudest = Math.max(loudest, sum / (10 * frame));
        }
        return { seconds: lastLoud / 100, peak, loudness: dB(Math.sqrt(loudest)) };
    }

    async function renderHorn(horn) {
        const offline = new OfflineAudioContext(1, RATE * 3, RATE);
        sound(horn, offline, offline.destination, 0);
        return (await offline.startRendering()).getChannelData(0);
    }

    async function decodeRecording(name) {
        const bytes = await (await fetch(`/sounds/${name}.mp3`)).arrayBuffer();
        const buffer = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(bytes);
        const mono = new Float32Array(buffer.length);
        for (let c = 0; c < buffer.numberOfChannels; c++) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
        }
        return mono;
    }

    const rows = {};
    const add = (name, current, samples) => {
        const { seconds, peak, loudness } = measure(samples);
        const trim = Math.min(10 ** ((TARGET - loudness) / 20), CAP / peak);
        rows[name] = {
            'ends at (s)': +seconds.toFixed(2),
            peak: +peak.toFixed(2),
            loudness: +loudness.toFixed(1),
            'trim now': current,
            'trim wanted': +trim.toFixed(2),
            'loudness then': +(loudness + dB(trim)).toFixed(1),
        };
    };
    for (const [name, trim] of RECORDINGS) add(name, trim, await decodeRecording(name));
    for (const horn of HORNS) add(horn.name, horn.trim, await renderHorn(horn));
    console.table(rows);
})();
