// The rest timer's alert at zero: the short bundled sound (if enabled) and a
// vibration where supported. iOS only lets an audio element play after it was
// started during a user gesture, so `prime` plays it muted during a tap and
// later plays are allowed.
import { REST_DONE_SOUND_URL } from '../../app/pwa';

/** The part of HTMLAudioElement the alert uses. */
export interface AudioLike {
  play(): Promise<void> | void;
  pause(): void;
  currentTime: number;
  muted: boolean;
}

export interface RestAlertDeps {
  /** Creates the audio element (lazily, on first use); null where audio is unavailable. */
  createAudio: () => AudioLike | null;
  /** `navigator.vibrate`, or null where unsupported. */
  vibrate: ((pattern: number[]) => unknown) | null;
}

export interface RestAlert {
  /** Call during a user gesture: unlocks audio playback for later. */
  prime(): void;
  /** Zero reached: play the sound (when `sound`) and vibrate. */
  fire(sound: boolean): void;
  isUnlocked(): boolean;
}

export const VIBRATE_PATTERN = [200, 100, 200];

const ignore = () => {};

export function createRestAlert(deps: RestAlertDeps): RestAlert {
  let audio: AudioLike | null | undefined;
  let unlocked = false;
  let priming = false;
  /** Bumped by every alert, so a prime finishing later does not pause it. */
  let alerts = 0;

  function element(): AudioLike | null {
    if (audio === undefined) {
      try {
        audio = deps.createAudio();
      } catch {
        audio = null;
      }
    }
    return audio;
  }

  return {
    isUnlocked: () => unlocked,

    prime() {
      if (unlocked || priming) return;
      const el = element();
      if (!el) return;
      priming = true;
      const alertsBefore = alerts;
      const done = (ok: boolean) => {
        priming = false;
        if (ok) unlocked = true;
        if (alerts !== alertsBefore) return;
        if (ok) {
          el.pause();
          el.currentTime = 0;
        }
        el.muted = false;
      };
      try {
        el.muted = true;
        Promise.resolve(el.play()).then(
          () => done(true),
          () => done(false),
        );
      } catch {
        done(false);
      }
    },

    fire(sound) {
      alerts += 1;
      if (sound) {
        const el = element();
        if (el) {
          try {
            el.muted = false;
            el.currentTime = 0;
            Promise.resolve(el.play()).catch(ignore);
          } catch {
            // Playback unavailable; the vibration (and the green 0:00) remain.
          }
        }
      }
      try {
        deps.vibrate?.(VIBRATE_PATTERN);
      } catch {
        // Unsupported.
      }
    },
  };
}

function createAudioElement(): AudioLike | null {
  if (typeof Audio === 'undefined') return null;
  const audio = new Audio(REST_DONE_SOUND_URL);
  audio.preload = 'auto';
  return audio;
}

function vibrate(pattern: number[]): unknown {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  return navigator.vibrate(pattern);
}

/** The app's rest alert. */
export const restAlert: RestAlert = createRestAlert({ createAudio: createAudioElement, vibrate });
