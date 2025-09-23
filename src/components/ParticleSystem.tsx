import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Float32BufferAttribute, Points } from "three";

interface Particle {
  position: [number, number, number];
  velocity: [number, number, number];
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface ParticleSystemProps {
  particles: Particle[];
  onParticleUpdate?: (particle: Particle, index: number) => Particle;
  onParticleDeath?: (index: number) => void;
}

const ParticleSystem: React.FC<ParticleSystemProps> = ({
  particles,
  onParticleUpdate,
  onParticleDeath,
}) => {
  const pointsRef = useRef<Points>(null);
  const groupRef = useRef<Group>(null);

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(particles.length * 3);
    const colors = new Float32Array(particles.length * 3);
    const sizes = new Float32Array(particles.length);

    particles.forEach((particle, i) => {
      const i3 = i * 3;
      positions[i3] = particle.position[0];
      positions[i3 + 1] = particle.position[1];
      positions[i3 + 2] = particle.position[2];

      // Convert hex color to RGB
      const hex = particle.color.replace("#", "");
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;

      colors[i3] = r;
      colors[i3 + 1] = g;
      colors[i3 + 2] = b;

      sizes[i] = particle.size;
    });

    return { positions, colors, sizes };
  }, [particles]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    const geometry = pointsRef.current.geometry;
    const positionAttribute = geometry.getAttribute(
      "position"
    ) as Float32BufferAttribute;
    const colorAttribute = geometry.getAttribute(
      "color"
    ) as Float32BufferAttribute;
    const sizeAttribute = geometry.getAttribute(
      "size"
    ) as Float32BufferAttribute;

    particles.forEach((particle, i) => {
      // Update particle position
      particle.position[0] += particle.velocity[0] * delta;
      particle.position[1] += particle.velocity[1] * delta;
      particle.position[2] += particle.velocity[2] * delta;

      // Update particle life
      particle.life -= delta;

      if (particle.life <= 0) {
        onParticleDeath?.(i);
        return;
      }

      // Apply gravity
      particle.velocity[1] -= 9.8 * delta;

      // Update positions
      positionAttribute.setXYZ(
        i,
        particle.position[0],
        particle.position[1],
        particle.position[2]
      );

      // Update colors based on life
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = lifeRatio;

      const hex = particle.color.replace("#", "");
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;

      colorAttribute.setXYZ(i, r * alpha, g * alpha, b * alpha);

      // Update size
      sizeAttribute.setX(i, particle.size * lifeRatio);

      // Call custom update function
      if (onParticleUpdate) {
        const updatedParticle = onParticleUpdate(particle, i);
        Object.assign(particle, updatedParticle);
      }
    });

    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
    sizeAttribute.needsUpdate = true;
  });

  if (particles.length === 0) return null;

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.1}
          transparent
          opacity={0.8}
          vertexColors
          sizeAttenuation
        />
      </points>
    </group>
  );
};

export default ParticleSystem;
