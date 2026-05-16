import { useCallback, useRef } from 'react';

interface SoundEffect {
  name: string;
  frequency: number;
  duration: number;
  type: 'sine' | 'square' | 'sawtooth' | 'triangle';
  volume: number;
}

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const SOUND_EFFECTS: Record<string, SoundEffect> = {
  itemPickup: {
    name: 'Item Pickup',
    frequency: 800,
    duration: 0.2,
    type: 'sine',
    volume: 0.3,
  },
  itemUse: {
    name: 'Item Use',
    frequency: 600,
    duration: 0.3,
    type: 'square',
    volume: 0.4,
  },
  puzzleComplete: {
    name: 'Puzzle Complete',
    frequency: 1000,
    duration: 0.5,
    type: 'sine',
    volume: 0.5,
  },
  chestOpen: {
    name: 'Chest Open',
    frequency: 400,
    duration: 0.8,
    type: 'sawtooth',
    volume: 0.4,
  },
  enemyHit: {
    name: 'Enemy Hit',
    frequency: 200,
    duration: 0.1,
    type: 'square',
    volume: 0.3,
  },
  enemyDeath: {
    name: 'Enemy Death',
    frequency: 150,
    duration: 0.4,
    type: 'sawtooth',
    volume: 0.5,
  },
  playerDamage: {
    name: 'Player Damage',
    frequency: 100,
    duration: 0.3,
    type: 'square',
    volume: 0.6,
  },
  secretDiscover: {
    name: 'Secret Discover',
    frequency: 1200,
    duration: 0.6,
    type: 'sine',
    volume: 0.4,
  },
  bossDefeat: {
    name: 'Boss Defeat',
    frequency: 2000,
    duration: 1.0,
    type: 'sine',
    volume: 0.7,
  },
  levelUp: {
    name: 'Level Up',
    frequency: 1500,
    duration: 0.8,
    type: 'triangle',
    volume: 0.6,
  },
  shopPurchase: {
    name: 'Shop Purchase',
    frequency: 900,
    duration: 0.3,
    type: 'sine',
    volume: 0.3,
  },
  preview: {
    name: 'Preview',
    frequency: 700,
    duration: 0.2,
    type: 'sine',
    volume: 0.2,
  },
};

export const useSoundEffects = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextConstructor =
        window.AudioContext || (window as WebkitWindow).webkitAudioContext;
      if (!AudioContextConstructor) return;
      audioContextRef.current = new AudioContextConstructor();
    }
  }, []);

  const playSound = useCallback((soundName: string) => {
    const sound = SOUND_EFFECTS[soundName];
    if (!sound) return;

    initAudioContext();
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(sound.frequency, audioContext.currentTime);
    oscillator.type = sound.type;

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(sound.volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + sound.duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + sound.duration);
  }, [initAudioContext]);

  const playSequence = useCallback((soundNames: string[], delay: number = 0.1) => {
    soundNames.forEach((soundName, index) => {
      setTimeout(() => {
        playSound(soundName);
      }, index * delay * 1000);
    });
  }, [playSound]);

  const playRandomPitch = useCallback((soundName: string, pitchVariation: number = 0.2) => {
    const sound = SOUND_EFFECTS[soundName];
    if (!sound) return;

    initAudioContext();
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const pitchVariationAmount = (Math.random() - 0.5) * pitchVariation;
    const frequency = sound.frequency * (1 + pitchVariationAmount);

    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = sound.type;

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(sound.volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + sound.duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + sound.duration);
  }, [initAudioContext]);

  return {
    playSound,
    playSequence,
    playRandomPitch,
    soundEffects: SOUND_EFFECTS,
  };
};
