'use client';

let audioContext: AudioContext | null = null;
let isSetup = false;

export const initAudio = () => {
  if (typeof window === 'undefined' || isSetup) {
    return;
  }
  isSetup = true;

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioContext();

    const resumeContext = () => {
        if (audioContext?.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log("AudioContext resumed by user gesture.");
            }).catch(e => console.error("AudioContext resume failed:", e));
        }
    };

    document.addEventListener('click', resumeContext, { once: true });
    document.addEventListener('touchstart', resumeContext, { once: true });
    document.addEventListener('keydown', resumeContext, { once: true });

  } catch (error) {
    console.error("Failed to initialize AudioContext:", error);
  }
};

const playSound = (duration: number) => {
  if (audioContext && audioContext.state === 'running') {
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const now = audioContext.currentTime;

      oscillator.type = 'sine';
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
