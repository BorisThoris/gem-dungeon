import { useState, useEffect, useCallback } from 'react';

interface GameSettings {
  graphics: {
    quality: 'low' | 'medium' | 'high';
    shadows: boolean;
    particles: boolean;
    effects: boolean;
  };
  audio: {
    masterVolume: number;
    sfxVolume: number;
    musicVolume: number;
    mute: boolean;
  };
  controls: {
    mouseSensitivity: number;
    invertY: boolean;
    autoRun: boolean;
  };
  gameplay: {
    difficulty: 'easy' | 'normal' | 'hard' | 'nightmare';
    autoSave: boolean;
    showTutorials: boolean;
    debugMode: boolean;
  };
}

const DEFAULT_SETTINGS: GameSettings = {
  graphics: {
    quality: 'medium',
    shadows: true,
    particles: true,
    effects: true,
  },
  audio: {
    masterVolume: 0.8,
    sfxVolume: 0.8,
    musicVolume: 0.6,
    mute: false,
  },
  controls: {
    mouseSensitivity: 1.0,
    invertY: false,
    autoRun: false,
  },
  gameplay: {
    difficulty: 'normal',
    autoSave: true,
    showTutorials: true,
    debugMode: false,
  },
};

export const useSettings = () => {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('ghostDungeonSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('ghostDungeonSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [settings]);

  const updateSettings = useCallback((newSettings: Partial<GameSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const updateGraphics = useCallback((graphics: Partial<GameSettings['graphics']>) => {
    setSettings(prev => ({
      ...prev,
      graphics: { ...prev.graphics, ...graphics }
    }));
  }, []);

  const updateAudio = useCallback((audio: Partial<GameSettings['audio']>) => {
    setSettings(prev => ({
      ...prev,
      audio: { ...prev.audio, ...audio }
    }));
  }, []);

  const updateControls = useCallback((controls: Partial<GameSettings['controls']>) => {
    setSettings(prev => ({
      ...prev,
      controls: { ...prev.controls, ...controls }
    }));
  }, []);

  const updateGameplay = useCallback((gameplay: Partial<GameSettings['gameplay']>) => {
    setSettings(prev => ({
      ...prev,
      gameplay: { ...prev.gameplay, ...gameplay }
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const exportSettings = useCallback(() => {
    try {
      const dataStr = JSON.stringify(settings, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ghost-dungeon-settings.json';
      link.click();
      
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('Failed to export settings:', error);
      return false;
    }
  }, [settings]);

  const importSettings = useCallback((file: File) => {
    return new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          setSettings({ ...DEFAULT_SETTINGS, ...imported });
          resolve(true);
        } catch (error) {
          console.error('Failed to import settings:', error);
          resolve(false);
        }
      };
      reader.readAsText(file);
    });
  }, []);

  return {
    settings,
    updateSettings,
    updateGraphics,
    updateAudio,
    updateControls,
    updateGameplay,
    resetSettings,
    exportSettings,
    importSettings,
  };
};
