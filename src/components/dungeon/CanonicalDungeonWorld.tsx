import React, { memo, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import {
  canonicalDungeonToGeometry,
  type CanonicalConnectionGate,
  type CanonicalFloorTile,
  type CanonicalRoomAssetAnchor,
  type CanonicalTraversalEndpoint,
  type CanonicalTraversalLink,
  type CanonicalWallSegment,
} from "../../adapters/canonicalGeometryAdapter";
import { canTraverseDungeonConnection } from "../../dungeon-core/model";
import type { Dungeon, DungeonRunState } from "../../dungeon-core/types";

export interface CanonicalDungeonWorldProps {
  readonly dungeon: Dungeon;
  readonly onOpenConnection: (connectionId: string) => void;
  readonly onTraverse: (roomId: string) => void;
  readonly runState: DungeonRunState;
  readonly wallsEnabled?: boolean;
}

const lastTraversalAt = new Map<string, number>();
const TRAVERSAL_COOLDOWN_MS = 900;

const CanonicalDungeonWorld: React.FC<CanonicalDungeonWorldProps> = memo(({
  dungeon,
  onOpenConnection,
  onTraverse,
  runState,
  wallsEnabled = true,
}) => {
  const geometry = useMemo(
    () => canonicalDungeonToGeometry(dungeon),
    [dungeon],
  );
  const cellSize = dungeon.config.world.cellSize;
  const wallHeight = Math.min(
    dungeon.config.world.floorHeight * 0.48,
    cellSize,
  );
  const wallThickness = Math.max(0.12, cellSize * 0.05);
  const floorThickness = Math.max(0.16, cellSize * 0.05);
  const closedGates = useMemo(
    () => geometry.connectionGates.filter((gate) =>
      !canTraverseDungeonConnection(
        dungeon,
        runState,
        gate.connectionId,
        gate.fromRoomId,
      )
      && !canTraverseDungeonConnection(
        dungeon,
        runState,
        gate.connectionId,
        gate.toRoomId,
      )),
    [dungeon, geometry.connectionGates, runState],
  );

  return (
    <group name="canonical-dungeon-world">
      <FloorInstances
        cellSize={cellSize}
        floorThickness={floorThickness}
        tiles={geometry.floorTiles}
      />
      {wallsEnabled && (
        <WallInstances
          cellSize={cellSize}
          wallHeight={wallHeight}
          wallThickness={wallThickness}
          walls={geometry.walls}
        />
      )}
      <RigidBody type="fixed" colliders={false} friction={1} name="canonical-geometry-colliders">
        {geometry.floorTiles.map((tile) => (
          <CuboidCollider
            args={[cellSize / 2, floorThickness / 2, cellSize / 2]}
            key={`floor-collider:${tile.id}`}
            position={[
              tile.position.x,
              tile.position.y - floorThickness / 2,
              tile.position.z,
            ]}
          />
        ))}
        {wallsEnabled && geometry.walls.map((wall) => (
          <CuboidCollider
            args={wall.axis === "x"
              ? [cellSize / 2, wallHeight / 2, wallThickness / 2]
              : [wallThickness / 2, wallHeight / 2, cellSize / 2]}
            key={`wall-collider:${wall.id}`}
            position={[wall.position.x, wall.position.y, wall.position.z]}
          />
        ))}
        {closedGates.map((gate) => (
          <CuboidCollider
            args={gate.axis === "x"
              ? [cellSize / 2, wallHeight / 2, wallThickness / 2]
              : [wallThickness / 2, wallHeight / 2, cellSize / 2]}
            key={`gate-collider:${gate.id}`}
            position={[gate.position.x, gate.position.y, gate.position.z]}
          />
        ))}
      </RigidBody>
      {closedGates.map((gate) => (
        <ClosedGate
          cellSize={cellSize}
          gate={gate}
          key={gate.id}
          onOpen={onOpenConnection}
          wallHeight={wallHeight}
          wallThickness={wallThickness}
        />
      ))}
      {geometry.assetAnchors.map((anchor) => (
        <RoomAssetMarker anchor={anchor} key={anchor.id} />
      ))}
      {geometry.traversalLinks.flatMap((link) => [
        <TraversalPad
          active={canTraverseDungeonConnection(
            dungeon,
            runState,
            link.connectionId,
            link.from.roomId,
          )}
          endpoint={link.from}
          key={`${link.connectionId}:from`}
          link={link}
          onOpen={onOpenConnection}
          onTraverse={onTraverse}
          side="from"
          target={link.to}
        />,
        <TraversalPad
          active={canTraverseDungeonConnection(
            dungeon,
            runState,
            link.connectionId,
            link.to.roomId,
          )}
          endpoint={link.to}
          key={`${link.connectionId}:to`}
          link={link}
          onOpen={onOpenConnection}
          onTraverse={onTraverse}
          side="to"
          target={link.from}
        />,
      ])}
    </group>
  );
});

CanonicalDungeonWorld.displayName = "CanonicalDungeonWorld";

function FloorInstances({
  cellSize,
  floorThickness,
  tiles,
}: {
  readonly cellSize: number;
  readonly floorThickness: number;
  readonly tiles: readonly CanonicalFloorTile[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    tiles.forEach((tile, index) => {
      transform.position.set(
        tile.position.x,
        tile.position.y - floorThickness / 2,
        tile.position.z,
      );
      transform.scale.set(cellSize, floorThickness, cellSize);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, materialColor(tile.materialKey, tile.kind === "room" ? 0.42 : 0.3, color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [cellSize, floorThickness, tiles]);

  return (
    <instancedMesh
      args={[undefined, undefined, tiles.length]}
      name="canonical-floor-visuals"
      receiveShadow
      ref={ref}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.92} metalness={0.02} vertexColors />
    </instancedMesh>
  );
}

function WallInstances({
  cellSize,
  wallHeight,
  wallThickness,
  walls,
}: {
  readonly cellSize: number;
  readonly wallHeight: number;
  readonly wallThickness: number;
  readonly walls: readonly CanonicalWallSegment[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    walls.forEach((wall, index) => {
      transform.position.set(wall.position.x, wall.position.y, wall.position.z);
      transform.scale.set(
        wall.axis === "x" ? cellSize : wallThickness,
        wallHeight,
        wall.axis === "x" ? wallThickness : cellSize,
      );
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, materialColor(wall.materialKey, 0.28, color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [cellSize, wallHeight, wallThickness, walls]);

  return (
    <instancedMesh
      args={[undefined, undefined, walls.length]}
      castShadow
      name="canonical-wall-visuals"
      receiveShadow
      ref={ref}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.86} metalness={0.04} vertexColors />
    </instancedMesh>
  );
}

function ClosedGate({
  cellSize,
  gate,
  onOpen,
  wallHeight,
  wallThickness,
}: {
  readonly cellSize: number;
  readonly gate: CanonicalConnectionGate;
  readonly onOpen: (connectionId: string) => void;
  readonly wallHeight: number;
  readonly wallThickness: number;
}) {
  const handleOpen = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onOpen(gate.connectionId);
  }, [gate.connectionId, onOpen]);
  return (
    <mesh
      castShadow
      name={gate.id}
      onClick={handleOpen}
      position={[gate.position.x, gate.position.y, gate.position.z]}
      receiveShadow
      scale={gate.axis === "x"
        ? [cellSize, wallHeight, wallThickness * 1.1]
        : [wallThickness * 1.1, wallHeight, cellSize]}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={gate.kind === "secret" ? "#5d3a78" : gate.kind === "breakable" ? "#7b4531" : "#783b3b"}
        emissive={gate.kind === "secret" ? "#250e36" : "#240808"}
        emissiveIntensity={0.35}
        roughness={0.75}
      />
    </mesh>
  );
}

function RoomAssetMarker({ anchor }: { readonly anchor: CanonicalRoomAssetAnchor }) {
  if (!["start", "gate", "reward-leaf", "boss", "end"].includes(anchor.role)) {
    return null;
  }
  const color = roleColor(anchor.role);
  return (
    <mesh
      name={anchor.id}
      position={[anchor.position.x, anchor.position.y + 0.34, anchor.position.z]}
      rotation={[0, anchor.rotationY, 0]}
      scale={anchor.role === "boss" ? 0.55 : 0.34}
    >
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
    </mesh>
  );
}

function TraversalPad({
  active,
  endpoint,
  link,
  onOpen,
  onTraverse,
  side,
  target,
}: {
  readonly active: boolean;
  readonly endpoint: CanonicalTraversalEndpoint;
  readonly link: CanonicalTraversalLink;
  readonly onOpen: (connectionId: string) => void;
  readonly onTraverse: (roomId: string) => void;
  readonly side: "from" | "to";
  readonly target: CanonicalTraversalEndpoint;
}) {
  const traverse = useCallback(() => {
    if (!active || typeof window === "undefined") return;
    const now = globalThis.performance.now();
    const previous = lastTraversalAt.get(link.connectionId) ?? -Infinity;
    if (now - previous < TRAVERSAL_COOLDOWN_MS) return;
    lastTraversalAt.set(link.connectionId, now);
    onTraverse(target.roomId);
    window.dispatchEvent(new CustomEvent("playerTeleport", {
      detail: {
        position: [target.position.x, target.position.y + 1.5, target.position.z],
        rotation: [0, 0, 0],
        source: "canonical-traversal",
      },
    }));
  }, [active, link.connectionId, onTraverse, target]);

  return (
    <RigidBody
      colliders={false}
      name={`traversal-pad:${link.connectionId}:${side}`}
      position={[endpoint.position.x, endpoint.position.y, endpoint.position.z]}
      type="fixed"
    >
      <CuboidCollider
        args={[0.8, 0.75, 0.8]}
        onIntersectionEnter={(event) => {
          if (event.other.rigidBodyObject?.name === "canonical-player") traverse();
        }}
        position={[0, 0.75, 0]}
        sensor
      />
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          if (active) traverse();
          else onOpen(link.connectionId);
        }}
        position={[0, 0.05, 0]}
      >
        <cylinderGeometry args={[0.75, 0.85, 0.1, 16]} />
        <meshStandardMaterial
          color={active ? traversalColor(link.kind) : "#7b2525"}
          emissive={active ? traversalColor(link.kind) : "#260505"}
          emissiveIntensity={active ? 0.8 : 0.25}
        />
      </mesh>
    </RigidBody>
  );
}

function materialColor(key: string, lightness: number, target: THREE.Color): THREE.Color {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  target.setHSL((hash >>> 0) / 0xffffffff, 0.28, lightness);
  return target;
}

function roleColor(role: CanonicalRoomAssetAnchor["role"]): string {
  if (role === "start") return "#54d88b";
  if (role === "boss") return "#d64a4a";
  if (role === "end") return "#f0d05c";
  if (role === "gate") return "#d28a42";
  return "#65b8e8";
}

function traversalColor(kind: CanonicalTraversalLink["kind"]): string {
  return kind === "portal" ? "#9c60ff" : "#4cc9d8";
}

export default CanonicalDungeonWorld;
