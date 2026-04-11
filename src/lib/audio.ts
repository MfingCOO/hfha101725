// src/lib/audio.ts

let audioContext: AudioContext | null = null;

// Function to initialize the AudioContext
// This should be called in response to a user gesture (e.g., a button click)
export const initAudio = async () => {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.error("Error initializing AudioContext:", e);
            audioContext = null;
        }
    }
    // If the context is suspended, try to resume it
    if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
    }
};


// A generic function to play a sound for a given duration
const playSound = (duration: number) => {
    if (audioContext && audioContext.state === 'running') {
      try {
        const now = audioContext.currentTime;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        gainNode.connect(audioContext.destination);
        oscillator.connect(gainNode);
        
        // Use a 'square' wave for a louder, more alert-like sound
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, now);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(1.0, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        
        oscillator.start(now);
        oscillator.stop(now + duration);
        
      } catch(e) {
        console.error("Error playing generated sound:", e);
      }
    } else {
      if (!audioContext) console.warn("Sound blocked: AudioContext not initialized.");
      else if (audioContext.state !== 'running') console.warn(`Sound blocked: AudioContext state is '${audioContext.state}'. A user interaction is required.`);
    }
}

// A standard short beep (100ms)
export const playBeep = () => {
    playSound(0.1);
};

// A longer beep for emphasis (500ms)
export const playLongBeep = () => {
    playSound(0.5);
};
