import React, { useState, useEffect } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

interface FloatingTextProps {
  text: string;
  position: [number, number, number];
  color?: string;
  duration?: number;
  onComplete?: () => void;
}

export const FloatingText: React.FC<FloatingTextProps> = ({
  text,
  position,
  color = "#FFFFFF",
  duration = 2000,
  onComplete,
}) => {
  const [opacity, setOpacity] = useState(1);
  const [yOffset, setYOffset] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpacity(0);
      setTimeout(() => onComplete?.(), 500);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  useFrame(() => {
    setYOffset((prev) => prev + 0.01);
  });

  return (
    <Text
      position={[position[0], position[1] + yOffset, position[2]]}
      fontSize={0.5}
      color={
        opacity < 1
          ? `${color}${Math.floor(opacity * 255)
              .toString(16)
              .padStart(2, "0")}`
          : color
      }
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.02}
      outlineColor="#000000"
    >
      {text}
    </Text>
  );
};

interface ScreenShakeProps {
  intensity: number;
  duration: number;
  onComplete?: () => void;
}

export const ScreenShake: React.FC<ScreenShakeProps> = ({
  intensity,
  duration,
  onComplete,
}) => {
  const [shakeOffset, setShakeOffset] = useState<[number, number, number]>([
    0, 0, 0,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShakeOffset([0, 0, 0]);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  useFrame(() => {
    const shakeX = (Math.random() - 0.5) * intensity;
    const shakeY = (Math.random() - 0.5) * intensity;
    const shakeZ = (Math.random() - 0.5) * intensity;
    setShakeOffset([shakeX, shakeY, shakeZ]);
  });

  return (
    <group position={shakeOffset}>
      {/* This will be applied to the camera or main scene */}
    </group>
  );
};

interface DamageIndicatorProps {
  damage: number;
  position: [number, number, number];
  onComplete?: () => void;
}

export const DamageIndicator: React.FC<DamageIndicatorProps> = ({
  damage,
  position,
  onComplete,
}) => {
  return (
    <FloatingText
      text={`-${damage}`}
      position={position}
      color="#FF0000"
      duration={1500}
      onComplete={onComplete}
    />
  );
};

interface HealIndicatorProps {
  healing: number;
  position: [number, number, number];
  onComplete?: () => void;
}

export const HealIndicator: React.FC<HealIndicatorProps> = ({
  healing,
  position,
  onComplete,
}) => {
  return (
    <FloatingText
      text={`+${healing}`}
      position={position}
      color="#00FF00"
      duration={1500}
      onComplete={onComplete}
    />
  );
};

interface ScoreIndicatorProps {
  score: number;
  position: [number, number, number];
  onComplete?: () => void;
}

export const ScoreIndicator: React.FC<ScoreIndicatorProps> = ({
  score,
  position,
  onComplete,
}) => {
  return (
    <FloatingText
      text={`+${score}`}
      position={position}
      color="#FFD700"
      duration={2000}
      onComplete={onComplete}
    />
  );
};

interface LevelUpIndicatorProps {
  position: [number, number, number];
  onComplete?: () => void;
}

export const LevelUpIndicator: React.FC<LevelUpIndicatorProps> = ({
  position,
  onComplete,
}) => {
  return (
    <FloatingText
      text="LEVEL UP!"
      position={position}
      color="#00FFFF"
      duration={3000}
      onComplete={onComplete}
    />
  );
};

interface ComboIndicatorProps {
  combo: number;
  position: [number, number, number];
  onComplete?: () => void;
}

export const ComboIndicator: React.FC<ComboIndicatorProps> = ({
  combo,
  position,
  onComplete,
}) => {
  return (
    <FloatingText
      text={`${combo}x COMBO!`}
      position={position}
      color="#FF00FF"
      duration={2000}
      onComplete={onComplete}
    />
  );
};

interface EffectManagerProps {
  effects: Array<{
    id: string;
    type: "damage" | "heal" | "score" | "levelup" | "combo" | "custom";
    value?: number;
    text?: string;
    position: [number, number, number];
    color?: string;
    duration?: number;
  }>;
  onEffectComplete: (id: string) => void;
}

export const EffectManager: React.FC<EffectManagerProps> = ({
  effects,
  onEffectComplete,
}) => {
  return (
    <group>
      {effects.map((effect) => {
        const commonProps = {
          position: effect.position,
          onComplete: () => onEffectComplete(effect.id),
        };

        switch (effect.type) {
          case "damage":
            return (
              <DamageIndicator
                key={effect.id}
                damage={effect.value || 0}
                {...commonProps}
              />
            );
          case "heal":
            return (
              <HealIndicator
                key={effect.id}
                healing={effect.value || 0}
                {...commonProps}
              />
            );
          case "score":
            return (
              <ScoreIndicator
                key={effect.id}
                score={effect.value || 0}
                {...commonProps}
              />
            );
          case "levelup":
            return <LevelUpIndicator key={effect.id} {...commonProps} />;
          case "combo":
            return (
              <ComboIndicator
                key={effect.id}
                combo={effect.value || 0}
                {...commonProps}
              />
            );
          case "custom":
            return (
              <FloatingText
                key={effect.id}
                text={effect.text || ""}
                color={effect.color}
                duration={effect.duration}
                {...commonProps}
              />
            );
          default:
            return null;
        }
      })}
    </group>
  );
};
