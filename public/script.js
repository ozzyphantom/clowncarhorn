document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('honk-btn');
    
    // List of sound files
    const sounds = [
        'sounds/honk-1.mp3',
        'sounds/honk-2.mp3',
        'sounds/honk-3.mp3'
    ];
    
    // Preload audio objects
    const audioPool = sounds.map(src => {
        const audio = new Audio(src);
        audio.preload = 'auto';
        return audio;
    });
    
    // Function to play a random sound
    function playRandomSound() {
        const randomIndex = Math.floor(Math.random() * audioPool.length);
        const originalAudio = audioPool[randomIndex];
        
        // Clone the node to allow overlapping playback of the same sound
        // This is crucial for rapid tapping "chaos"
        const soundToPlay = originalAudio.cloneNode();
        soundToPlay.volume = 1.0;
        
        soundToPlay.play().catch(e => {
            console.log('Audio play failed (user interaction needed first):', e);
        });
        
        // Cleanup when done (optional but good for long sessions)
        soundToPlay.onended = () => {
            soundToPlay.remove();
        };
    }
    
    // Interaction Handlers
    function triggerHonk(e) {
        // Prevent default behavior to avoid double-firing on some touch devices
        // but we need to be careful not to block scrolling if not on the button active area,
        // though for a button click it's fine.
        if (e.type === 'touchstart') {
            e.preventDefault(); // preventing default click emulation
            button.classList.add('active');
        }
        
        playRandomSound();
        
        // Visual feedback animation class (if not handled by CSS :active)
        // We add a temporary class if we want to force the state, 
        // but CSS :active handles mouse. For touch, we might need manual handling 
        // if we prevented default.
    }
    
    function releaseHonk(e) {
        if (e.type === 'touchend') {
            button.classList.remove('active');
        }
    }

    // Mouse
    button.addEventListener('mousedown', () => playRandomSound());
    
    // Touch
    // We bind touchstart to trigger immediate sound
    button.addEventListener('touchstart', triggerHonk, { passive: false });
    button.addEventListener('touchend', releaseHonk);
    button.addEventListener('touchcancel', releaseHonk);

    // Keyboard (Space/Enter)
    document.addEventListener('keydown', (e) => {
        if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
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
