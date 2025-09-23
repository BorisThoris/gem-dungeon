import React from "react";
import MapRenderer from "./MapRenderer";

interface MapContainerProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  centerMap?: boolean;
  gridSize?: number;
  roomSize?: number;
}

const MapContainer: React.FC<MapContainerProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  centerMap = true,
  gridSize = 7,
  roomSize = 10,
}) => {
  // Calculate center offset if centering is enabled
  const centerOffset = centerMap
    ? ([
        -((gridSize - 1) / 2) * roomSize, // Center X
        0, // Y stays at 0
        -((gridSize - 1) / 2) * roomSize, // Center Z
      ] as [number, number, number])
    : ([0, 0, 0] as [number, number, number]);

  const finalPosition: [number, number, number] = [
    position[0] + centerOffset[0],
    position[1] + centerOffset[1],
    position[2] + centerOffset[2],
  ];

  return (
    <group position={finalPosition} rotation={rotation} scale={scale}>
      <MapRenderer />
    </group>
  );
};

export default MapContainer;
