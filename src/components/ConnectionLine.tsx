import React from "react";
import type { Position } from "../types/map";

interface ConnectionLineProps {
  from: Position;
  to: Position;
  isVisited: boolean;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  from,
  to,
  isVisited,
}) => {
  const opacity = isVisited ? 0.8 : 0.3;

  return (
    <mesh position={[(from.x + to.x) / 2, 0.05, (from.z + to.z) / 2]}>
      <boxGeometry
        args={[
          Math.abs(to.x - from.x) || 0.1,
          0.1,
          Math.abs(to.z - from.z) || 0.1,
        ]}
      />
      <meshLambertMaterial color="#8D6E63" transparent opacity={opacity} />
    </mesh>
  );
};

export default ConnectionLine;
