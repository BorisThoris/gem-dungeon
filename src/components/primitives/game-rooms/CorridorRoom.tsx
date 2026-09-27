import React from "react";
import { RigidBody } from "@react-three/rapier";
interface CorridorRoomProps {
  size?: number; // standard room size
}

const CorridorRoom: React.FC<CorridorRoomProps> = ({ size = 10 }) => {
  // Keep corridor within the standard room footprint
  const length = size * 0.9;
  const width = size * 0.5;

  return (
    <RigidBody type="fixed" colliders="cuboid">
      {/* Narrow platform floor inside the square room */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[length, 0.2, width]} />
        <meshStandardMaterial color="#666666" />
      </mesh>

      {/* Long side walls inside shell to emphasize corridor */}
      <mesh position={[0, 1, -width / 2]} castShadow>
        <boxGeometry args={[length, 2, 0.15]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, 1, width / 2]} castShadow>
        <boxGeometry args={[length, 2, 0.15]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
    </RigidBody>
  );
};

export default CorridorRoom;
