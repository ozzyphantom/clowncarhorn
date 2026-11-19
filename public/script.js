// clowncarhorn.com: one button, one horn at a time.
//
// The audio side has four rules. Each one closes a way the horn used to go
// quiet or get stuck.
//   1. A press never schedules sound on an AudioContext that is not running.
//      It asks the context to run and remembers that a honk is wanted. Sound
//      scheduled on a stopped clock piles up and fires all at once later.
//   2. Any gesture that can start audio nudges a stopped context. Browsers
//      stop a context on their own: a phone call, a locked screen, a tab in
//      the background.
//   3. A new honk cuts the previous one off.
//   4. A context that claims to run while its clock stands still is replaced.

import { HORNS, RECORDINGS, sound } from './sounds.js';

const VOLUME = 0.8;        // master level
const FADE = 0.004;        // seconds; time constant for cutting a horn off
const ATTACK = 0.008;      // seconds; fade-in of a horn that replaces another, so the two never sum into clipping
const PATIENCE = 2000;     // ms a press waits for audio to start before it is dropped
const REBUILD_GAP = 10000; // ms between attempts to replace a dead AudioContext
const noop = () => {};

let ctx = null;     // the live AudioContext; created on the first press
let bus = null;     // master gain
let voice = null;   // the horn that is sounding: { out, sources }
let wanted = 0;     // time of the latest press still waiting for sound; 0 when none is
let waiting = 0;    // time of the first press that found the context stopped; 0 once it runs
let builtAt = 0;    // time the live AudioContext was created
let watchdog = 0;   // timer id, see watch()

// ---------- Which horn ----------

// ?horn=<name> plays that horn only. README.md lists the names.
const solo = new URLSearchParams(location.search).get('horn');
const known = HORNS.map((horn) => horn.name).concat(RECORDINGS.map(([name]) => name));
const inPlay = (name) => !known.includes(solo) || name === solo;

const pool = HORNS.filter((horn) => inPlay(horn.name));
let bag = [];
let last = null;

// Every horn plays once, in random order, before any horn repeats.
function next() {
    if (!bag.length) {
        bag = pool.slice();
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        // Never the same horn twice in a row, across a refill either.
        if (bag.length > 1 && bag[bag.length - 1] === last) bag.unshift(bag.pop());
    }
    last = bag.pop();
    return last;
}

// ---------- Recordings ----------

const undecoded = []; // [name, trim, ArrayBuffer]: fetched, waiting for an AudioContext

for (const [name, trim] of RECORDINGS) {
    if (!inPlay(name)) continue;
    fetch(`sounds/${name}.mp3`)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
        .then((bytes) => {
            undecoded.push([name, trim, bytes]);
            if (ctx) decode();
        })
        .catch(noop); // a missing recording leaves the synthesized horns
}

function decode() {
    while (undecoded.length) {
        const [name, trim, bytes] = undecoded.pop();
        try {
            // Callbacks for old Safari, which returns no promise here.
            const pending = ctx.decodeAudioData(bytes, (buffer) => addRecording(name, trim, buffer), noop);
            if (pending && pending.catch) pending.catch(noop);
        } catch (_) { /* undecodable: skip it */ }
    }
}

// A decoded AudioBuffer works on any AudioContext, so recordings survive a rebuild.
function addRecording(name, trim, buffer) {
    const span = audible(buffer);
    if (!span) return;
    const horn = { name, trim, build: (kit) => kit.sample(buffer, span.offset, span.length) };
    pool.push(horn);
    bag.splice(Math.floor(Math.random() * (bag.length + 1)), 0, horn); // joins the round in progress
}

// Where the sound is. A recording can open or close with silence, and a
// silent lead-in makes a press feel dead.
function audible(buffer) {
    const channels = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
    let peak = 0;
    for (const data of channels) {
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    }
    if (peak < 0.001) return null;
    let first = buffer.length;
    let end = 0;
    for (const data of channels) {
        let i = 0;
        while (i < data.length && Math.abs(data[i]) < peak * 0.02) i++;
        let j = data.length - 1;
        while (j > 0 && Math.abs(data[j]) < peak * 0.003) j--;
        first = Math.min(first, i);
        end = Math.max(end, j);
    }
    const offset = Math.max(0, first / buffer.sampleRate - 0.004);
    const stop = Math.min(buffer.duration, end / buffer.sampleRate + 0.03);
    return { offset, length: Math.max(0.05, stop - offset) };
}

// ---------- Playing ----------

// Make a fresh AudioContext, closing the old one. False when the browser has none to give.
function build() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (ctx) {
        ctx.onstatechange = null;
        try {
            Promise.resolve(ctx.close()).catch(noop);
        } catch (_) { /* already closed */ }
    }
    ctx = bus = voice = null;
    waiting = 0;
    if (!AudioCtx) return false;
    try {
        ctx = new AudioCtx();
    } catch (_) {
        return false;
    }
    builtAt = performance.now();
    bus = ctx.createGain();
    bus.gain.value = VOLUME;
    bus.connect(ctx.destination);
    ctx.onstatechange = flush;
    decode();
    return true;
}

// Ask a stopped context to run. Only works inside a user gesture.
function wake() {
    try {
        // Older iOS unlocks audio on a start() call, not on resume() alone.
        const tick = ctx.createBufferSource();
        tick.buffer = ctx.createBuffer(1, 1, 22050);
        tick.connect(ctx.destination);
        tick.start(0);
    } catch (_) { /* resume() below is the part that matters */ }
    try {
        const resumed = ctx.resume();
        if (resumed && resumed.then) resumed.then(flush, noop);
    } catch (_) { /* refused; the next gesture tries again */ }
}

function honk() {
    const now = performance.now();
    // Presses have gone unanswered and the context still will not run: stop trusting it.
    const dead = ctx && ctx.state !== 'running' && waiting && now - waiting > PATIENCE && now - builtAt > REBUILD_GAP;
    if ((!ctx || ctx.state === 'closed' || dead) && !build()) return;
    wanted = now;
    if (ctx.state === 'running') {
        flush();
        return;
    }
    if (!waiting) waiting = now;
    wake();
}

// Play the honk that is waiting, if the context runs and the press is recent.
function flush() {
    if (!ctx || ctx.state !== 'running') return;
    waiting = 0;
    if (!wanted) return;
    const fresh = performance.now() - wanted < PATIENCE;
    wanted = 0;
    const horn = fresh && next();
    if (!horn) return;
    play(horn);
    watch();
}

function play(horn) {
    const now = ctx.currentTime;
    const out = ctx.createGain();
    if (voice) {
        hush(voice, now);
        out.gain.setValueAtTime(0, now);
        out.gain.linearRampToValueAtTime(horn.trim, now + ATTACK);
    } else {
        out.gain.setValueAtTime(horn.trim, now);
    }
    out.connect(bus);
    const { sources } = sound(horn, ctx, out, now);
    const mine = { out, sources };
    let sounding = sources.length;
    for (const source of sources) {
        source.onended = () => {
            if (--sounding) return;
            out.disconnect();
            if (voice === mine) voice = null;
        };
    }
    voice = mine;
}

// Fade a horn out fast and stop everything it scheduled, started or not.
function hush({ out, sources }, now) {
    out.gain.cancelScheduledValues(now);
    out.gain.setTargetAtTime(0, now, FADE);
    for (const source of sources) {
        try {
            source.stop(now + FADE * 8);
        } catch (_) { /* it had already ended */ }
    }
}

// A context can say "running" while its clock stands still, after a sleep or
// an audio device change. Nothing scheduled on it will sound. Half a second
// after each honk, check that the clock moved. If it did not, start over and
// honk again.
function watch() {
    const checked = ctx;
    const audioTime = ctx.currentTime;
    const pressedAt = performance.now();
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
        if (checked !== ctx || ctx.state !== 'running' || document.hidden) return;
        if (ctx.currentTime > audioTime || performance.now() - builtAt < REBUILD_GAP) return;
        if (!build()) return;
        wanted = pressedAt;
        if (ctx.state === 'running') flush();
        else wake();
    }, 500);
}

// Browsers let audio start on some events and not others: a touch counts when
// the finger lifts, not when it lands. So each gesture that can carry that
// permission also nudges a stopped context, and a waiting honk plays then.
for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
    document.addEventListener(type, () => {
        if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') wake();
    }, { capture: true, passive: true });
}

// ---------- The button ----------

const button = document.getElementById('honk-btn');
const held = new Set(); // what holds the button down: 'pointer:<id>' or 'key:<code>'
let releasedAt = 0;     // time the last hold ended

function press(id) {
    held.add(id);
    button.classList.add('active');
    honk();
}

function release(id) {
    if (!held.delete(id)) return;
    releasedAt = performance.now();
    if (!held.size) button.classList.remove('active');
}

function releaseAll() {
    if (held.size) releasedAt = performance.now();
    held.clear();
    button.classList.remove('active');
}

// Mouse, touch and pen. Every finger honks, so two-finger drumming works.
button.addEventListener('pointerdown', (e) => {
    if (e.button === 0) press('pointer:' + e.pointerId);
});
window.addEventListener('pointerup', (e) => release('pointer:' + e.pointerId));
window.addEventListener('pointercancel', (e) => release('pointer:' + e.pointerId));

// A click with no press before it comes from assistive technology (VoiceOver,
// Voice Control, switch access) or from a browser without pointer events.
button.addEventListener('click', () => {
    if (held.size || performance.now() - releasedAt < 700) return;
    honk();
    button.classList.add('active');
    setTimeout(() => {
        if (!held.size) button.classList.remove('active');
    }, 120);
});

// Space and Enter honk from anywhere on the page, except when focus is on a
// link or another control. Its own keys win there.
document.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Spacebar' && e.key !== 'Enter') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target && target !== button && target.closest('a, button, input, select, textarea')) return;
    e.preventDefault(); // no page scroll, and no second honk from the button's own click
    if (!e.repeat) press('key:' + e.code);
});
document.addEventListener('keyup', (e) => release('key:' + e.code));

// A release can go missing: the window loses focus mid-press, a context menu
// opens, the tab is hidden. Never leave the button looking pressed.
window.addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
});
button.addEventListener('contextmenu', releaseAll);
