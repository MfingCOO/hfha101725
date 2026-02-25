import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// This interface defines the shape of our state.
interface ProtocolTimerState {
  isModalOpen: boolean;
  isActive: boolean;
  startTime: number | null; // The timestamp when the timer was last (re)started.
  pausedElapsed: number;  // The total accumulated time in seconds when the timer is paused.
}

// This interface defines the actions that can be performed on the state.
interface ProtocolTimerActions {
  openModal: () => void;
  closeModal: () => void;
  start: () => void;     // Starts (or resumes) the timer.
  pause: () => void;     // Pauses the timer.
  reset: () => void;     // Resets the timer to its initial state.
}

// This is the initial, clean state for the timer.
const initialState: ProtocolTimerState = {
    isModalOpen: false,
    isActive: false,
    startTime: null,
    pausedElapsed: 0,
};

/**
 * A persistent global store for the 75/20/20 protocol timer.
 * This store ensures the timer's state survives re-renders, navigation, and page reloads.
 */
export const useProtocolTimerStore = create<ProtocolTimerState & ProtocolTimerActions>()(
  persist(
    (set, get) => ({
      ...initialState,
      openModal: () => set({ isModalOpen: true }),
      closeModal: () => set({ ...initialState }), // On close, reset the entire state to its initial values.
      start: () => {
        // To start or resume, we set the timer as active and record the current time.
        set({
          isActive: true,
          startTime: Date.now(),
        });
      },
      pause: () => {
        const { isActive, startTime, pausedElapsed } = get();
        // Only do something if the timer is currently running.
        if (!isActive || !startTime) return;

        // Calculate how much time has passed since the last start/resume.
        const elapsedSinceStart = (Date.now() - startTime) / 1000;

        // Add this elapsed time to our total paused time and mark as inactive.
        set({
          isActive: false,
          startTime: null,
          pausedElapsed: pausedElapsed + elapsedSinceStart,
        });
      },
      reset: () => {
        // To reset, clear all timer-related state but don't close the modal.
        set({
          isActive: false,
          startTime: null,
          pausedElapsed: 0,
        });
      },
    }),
    {
      name: 'protocol-timer-storage', // A unique name for the item in localStorage.
    }
  )
);
