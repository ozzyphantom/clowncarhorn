document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('honk-btn');
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Ensure AudioContext is resumed on first interaction (browser policy)
    function ensureContext() {
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    // --- Load MP3 samples as AudioBuffers ---
    const sampleFiles = [
        'sounds/honk-1.mp3',
        'sounds/honk-2.mp3',
        'sounds/honk-3.mp3'
    ];

    const sampleBuffers = []; // Will hold decoded AudioBuffers

    Promise.all(
        sampleFiles.map(url =>
            fetch(url)
                .then(r => r.arrayBuffer())
                .then(buf => audioCtx.decodeAudioData(buf))
        )
    ).then(buffers => {
        sampleBuffers.push(...buffers);
    });

    // Play a pre-decoded AudioBuffer — near-zero latency
    function playSample(buffer) {
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        const gain = audioCtx.createGain();
        gain.gain.value = 1.0;
        source.connect(gain).connect(audioCtx.destination);
        source.start(0);
    }

    // --- Synthesized horn sounds ---
    // Each function creates a unique clown-horn-style sound using oscillators

    function synthClassicHonk() {
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(180, t + 0.15);
        osc.frequency.exponentialRampToValueAtTime(260, t + 0.25);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
    }

    function synthHighHonk() {
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(520, t + 0.08);
        osc.frequency.exponentialRampToValueAtTime(350, t + 0.3);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
    }

    function synthDoubleHonk() {
        const t = audioCtx.currentTime;
        [0, 0.15].forEach(offset => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, t + offset);
            osc.frequency.exponentialRampToValueAtTime(200, t + offset + 0.12);
            gain.gain.setValueAtTime(0.4, t + offset);
            gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.15);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(t + offset);
            osc.stop(t + offset + 0.15);
        });
    }

    function synthSadTrombone() {
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(350, t);
        osc.frequency.linearRampToValueAtTime(150, t + 0.6);
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.65);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.65);
    }

    function synthBuzzyHonk() {
        const t = audioCtx.currentTime;
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(185, t);
        osc2.frequency.setValueAtTime(187, t); // Slight detune for buzzy effect
        osc1.frequency.exponentialRampToValueAtTime(250, t + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(253, t + 0.1);
        osc1.frequency.exponentialRampToValueAtTime(160, t + 0.35);
        osc2.frequency.exponentialRampToValueAtTime(162, t + 0.35);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.4);
        osc2.stop(t + 0.4);
    }

    function synthSqueakyHonk() {
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.2);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
    }

    function synthFoghorn() {
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, t);
        osc2.frequency.setValueAtTime(81, t);
        osc.frequency.linearRampToValueAtTime(75, t + 0.6);
        osc2.frequency.linearRampToValueAtTime(76, t + 0.6);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
        gain.gain.setValueAtTime(0.4, t + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc2.start(t);
        osc.stop(t + 0.7);
        osc2.stop(t + 0.7);
    }

    function synthPartyHorn() {
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.3);
        osc.frequency.linearRampToValueAtTime(580, t + 0.5);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
        gain.gain.setValueAtTime(0.35, t + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.55);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.55);
    }

    // All synth functions
    const synthSounds = [
        synthClassicHonk,
        synthHighHonk,
        synthDoubleHonk,
        synthSadTrombone,
        synthBuzzyHonk,
        synthSqueakyHonk,
        synthFoghorn,
        synthPartyHorn
    ];

    // Play a random sound — either a sample or a synth
    function playRandomSound() {
        ensureContext();
        const totalOptions = sampleBuffers.length + synthSounds.length;
        const pick = Math.floor(Math.random() * totalOptions);

        if (pick < sampleBuffers.length) {
            playSample(sampleBuffers[pick]);
        } else {
            synthSounds[pick - sampleBuffers.length]();
        }
    }

    // --- Interaction Handlers ---

    button.addEventListener('mousedown', (e) => {
        playRandomSound();
    });

    button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        button.classList.add('active');
        playRandomSound();
    }, { passive: false });

    button.addEventListener('touchend', () => button.classList.remove('active'));
    button.addEventListener('touchcancel', () => button.classList.remove('active'));

    document.addEventListener('keydown', (e) => {
        if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
            e.preventDefault();
            button.classList.add('active');
            playRandomSound();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
            button.classList.remove('active');
        }
    });
});
