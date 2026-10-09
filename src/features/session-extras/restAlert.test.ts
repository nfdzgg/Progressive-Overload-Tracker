import { describe, expect, it, vi } from 'vitest';
import { createRestAlert, VIBRATE_PATTERN, type AudioLike } from './restAlert';

/** A fake audio element recording what was done to it. */
function fakeAudio(playResult: () => Promise<void> = () => Promise.resolve()) {
  const audio = {
    currentTime: 0,
    muted: false,
    play: vi.fn(() => playResult()),
    pause: vi.fn(),
    log: [] as string[],
  };
  audio.play.mockImplementation(() => {
    audio.log.push(audio.muted ? 'play muted' : 'play');
    return playResult();
  });
  audio.pause.mockImplementation(() => {
    audio.log.push('pause');
  });
  return audio;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('rest alert', () => {
  it('at zero plays the sound and vibrates', () => {
    const audio = fakeAudio();
    const vibrate = vi.fn();
    const alert = createRestAlert({ createAudio: () => audio, vibrate });
    audio.currentTime = 0.4;
    alert.fire(true);
    expect(audio.log).toEqual(['play']);
    expect(audio.currentTime).toBe(0);
    expect(vibrate).toHaveBeenCalledWith(VIBRATE_PATTERN);
  });

  it('with the sound off only vibrates', () => {
    const createAudio = vi.fn(() => fakeAudio());
    const vibrate = vi.fn();
    const alert = createRestAlert({ createAudio, vibrate });
    alert.fire(false);
    expect(createAudio).not.toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('works where vibration or audio is not supported', () => {
    expect(() =>
      createRestAlert({ createAudio: () => null, vibrate: null }).fire(true),
    ).not.toThrow();
  });

  it('swallows a rejected play (autoplay blocked) and a throwing vibrate', async () => {
    const audio = fakeAudio(() => Promise.reject(new Error('NotAllowedError')));
    const vibrate = vi.fn(() => {
      throw new Error('nope');
    });
    const alert = createRestAlert({ createAudio: () => audio, vibrate });
    expect(() => alert.fire(true)).not.toThrow();
    await flush();
    expect(vibrate).toHaveBeenCalled();
  });

  it('prime unlocks the element during a gesture with a muted play, once', async () => {
    const audio = fakeAudio();
    const createAudio = vi.fn((): AudioLike => audio);
    const alert = createRestAlert({ createAudio, vibrate: null });
    alert.prime();
    alert.prime(); // in flight: no second play
    expect(audio.log).toEqual(['play muted']);
    await flush();
    expect(audio.log).toEqual(['play muted', 'pause']);
    expect(audio.muted).toBe(false);
    expect(audio.currentTime).toBe(0);
    expect(alert.isUnlocked()).toBe(true);

    alert.prime(); // already unlocked
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(createAudio).toHaveBeenCalledTimes(1);

    alert.fire(true);
    expect(audio.log).toEqual(['play muted', 'pause', 'play']);
  });

  it('a failed prime can be retried on the next gesture', async () => {
    let allow = false;
    const audio = fakeAudio(() =>
      allow ? Promise.resolve() : Promise.reject(new Error('NotAllowedError')),
    );
    const alert = createRestAlert({ createAudio: () => audio, vibrate: null });
    alert.prime();
    await flush();
    expect(alert.isUnlocked()).toBe(false);
    expect(audio.muted).toBe(false);
    allow = true;
    alert.prime();
    await flush();
    expect(alert.isUnlocked()).toBe(true);
  });

  it('an alert during a prime is not paused by it', async () => {
    const audio = fakeAudio();
    const alert = createRestAlert({ createAudio: () => audio, vibrate: null });
    alert.prime();
    alert.fire(true);
    await flush();
    expect(audio.log).toEqual(['play muted', 'play']);
    expect(audio.muted).toBe(false);
  });
});
