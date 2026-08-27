import React, { useEffect, useMemo, useState } from "react";
import type {
  Dungeon,
  DungeonConnection,
  DungeonRoom,
  GridCell,
  MissionRole,
} from "../dungeon-core/types";
import useMapStore from "../store/mapStore";

interface MinimapProps {
  readonly isVisible?: boolean;
  readonly onToggle?: (visible: boolean) => void;
}

interface FloorView {
  readonly height: number;
  readonly minX: number;
  readonly minZ: number;
  readonly width: number;
}

const Minimap: React.FC<MinimapProps> = ({ isVisible = true, onToggle }) => {
  const dungeon = useMapStore((state) => state.currentDungeon);
  const runState = useMapStore((state) => state.dungeonRunState);
  const [visible, setVisible] = useState(isVisible);
  const [expanded, setExpanded] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState(0);

  useEffect(() => setVisible(isVisible), [isVisible]);
  useEffect(() => {
    if (runState) setSelectedFloor(runState.currentFloor);
  }, [runState]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        setExpanded((value) => !value);
      } else if (event.key.toLowerCase() === "m") {
        setVisible((value) => {
          onToggle?.(!value);
          return !value;
        });
      } else if (event.key === "Escape") {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onToggle]);

  const floorView = useMemo(
    () => dungeon ? getFloorView(dungeon, selectedFloor) : null,
    [dungeon, selectedFloor],
  );

  if (!visible) {
    return (
      <button
        aria-label="Show canonical minimap"
        onClick={() => {
          setVisible(true);
          onToggle?.(true);
        }}
        style={toggleButtonStyle}
        type="button"
      >
        Map
      </button>
    );
  }

  return (
    <aside
      aria-label="Canonical dungeon map"
      data-dungeon-seed={dungeon?.replay.seed}
      style={expanded ? expandedContainerStyle : minimapContainerStyle}
    >
      <div style={headerStyle}>
        <div>
          <strong>Dungeon</strong>
          <div style={subtleTextStyle}>
            {dungeon ? `seed ${dungeon.replay.seed}` : "waiting for canonical data"}
          </div>
        </div>
        <div style={buttonRowStyle}>
          <button
            aria-label={expanded ? "Collapse map" : "Expand map"}
            onClick={() => setExpanded((value) => !value)}
            style={iconButtonStyle}
            type="button"
          >
            {expanded ? "−" : "+"}
          </button>
          <button
            aria-label="Hide map"
            onClick={() => {
              setVisible(false);
              onToggle?.(false);
            }}
            style={iconButtonStyle}
            type="button"
          >
            ×
          </button>
        </div>
      </div>

      {dungeon && runState && floorView ? (
        <>
          <div style={floorSelectorStyle}>
            {Array.from({ length: dungeon.floors }, (_, floor) => (
              <button
                aria-pressed={selectedFloor === floor}
                key={floor}
                onClick={() => setSelectedFloor(floor)}
                style={selectedFloor === floor ? activeFloorButtonStyle : floorButtonStyle}
                type="button"
              >
                F{floor + 1}{runState.currentFloor === floor ? " •" : ""}
              </button>
            ))}
          </div>
          <CanonicalFloorSvg
            dungeon={dungeon}
            expanded={expanded}
            floor={selectedFloor}
            floorView={floorView}
            visitedRoomIds={runState.visitedRoomIds}
          />
          <div style={footerStyle}>
            <span>{runState.visitedRoomIds.size}/{dungeon.rooms.length} visited</span>
            <span>{dungeon.metrics.cycleRank} loops</span>
            <span>{dungeon.metrics.corridorLength.total} route cells</span>
          </div>
        </>
      ) : (
        <div style={emptyStyle}>
          No alternate map is reconstructed. Generate or restore a canonical dungeon first.
        </div>
      )}
    </aside>
  );
};

function CanonicalFloorSvg({
  dungeon,
  expanded,
  floor,
  floorView,
  visitedRoomIds,
}: {
  readonly dungeon: Dungeon;
  readonly expanded: boolean;
  readonly floor: number;
  readonly floorView: FloorView;
  readonly visitedRoomIds: ReadonlySet<string>;
}) {
  const rooms = dungeon.rooms.filter((room) => room.transform.origin.floor === floor);
  const currentRoomId = useMapStore((state) => state.currentRoomId);
  const cellStroke = 0.055;
  return (
    <svg
      aria-label={`Exact canonical footprint map for floor ${floor + 1}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      style={{
        background: "#080c12",
        border: "1px solid #314158",
        borderRadius: 8,
        display: "block",
        height: expanded ? "calc(100% - 116px)" : 205,
        minHeight: expanded ? 300 : 205,
        width: "100%",
      }}
      viewBox={`${floorView.minX} ${floorView.minZ} ${floorView.width} ${floorView.height}`}
    >
      <g aria-label="routed corridors">
        {dungeon.connections.flatMap((connection) =>
          (connection.corridor?.cells ?? [])
            .filter((cell) => cell.floor === floor)
            .map((cell) => (
              <rect
                fill={connectionColor(connection)}
                height={0.7}
                key={`${connection.id}:${cell.x}:${cell.z}`}
                opacity={connection.secret ? 0.28 : 0.62}
                width={0.7}
                x={cell.x + 0.15}
                y={cell.z + 0.15}
              />
            )),
        )}
      </g>
      <g aria-label="exact room footprints">
        {rooms.flatMap((room) => {
          const visited = visitedRoomIds.has(room.id);
          const current = currentRoomId === room.id;
          return room.footprint.cells.map((cell) => (
            <rect
              fill={roomColor(room)}
              height={0.9}
              key={`${room.id}:${cell.x}:${cell.z}`}
              opacity={current ? 1 : visited ? 0.82 : 0.15}
              rx={0.08}
              stroke={current ? "#ffffff" : "#101722"}
              strokeWidth={current ? 0.13 : cellStroke}
              width={0.9}
              x={cell.x + 0.05}
              y={cell.z + 0.05}
            />
          ));
        })}
      </g>
      <g aria-label="explicit non-corridor connections">
        {dungeon.connections.map((connection) => (
          <ConnectionOverlay
            connection={connection}
            dungeon={dungeon}
            floor={floor}
            key={connection.id}
          />
        ))}
      </g>
      {expanded && rooms.map((room) => {
        const center = roomCenter(room);
        return (
          <text
            fill="#e7edf6"
            fontSize={0.38}
            key={`label:${room.id}`}
            opacity={visitedRoomIds.has(room.id) ? 0.88 : 0.3}
            textAnchor="middle"
            x={center.x}
            y={center.z + 0.13}
          >
            {roomLabel(room)}
          </text>
        );
      })}
    </svg>
  );
}

function ConnectionOverlay({
  connection,
  dungeon,
  floor,
}: {
  readonly connection: DungeonConnection;
  readonly dungeon: Dungeon;
  readonly floor: number;
}) {
  if (connection.kind !== "portal" && connection.vertical === null) return null;
  const from = getSocketCell(dungeon, connection.from.roomId, connection.from.socketId);
  const to = getSocketCell(dungeon, connection.to.roomId, connection.to.socketId);
  if (!from || !to) return null;
  if (connection.kind === "portal" && from.floor === floor && to.floor === floor) {
    return (
      <line
        stroke="#bd78ff"
        strokeDasharray="0.25 0.2"
        strokeWidth={0.14}
        x1={from.x + 0.5}
        x2={to.x + 0.5}
        y1={from.z + 0.5}
        y2={to.z + 0.5}
      />
    );
  }
  const endpoint = from.floor === floor ? from : to.floor === floor ? to : null;
  if (!endpoint) return null;
  const destinationFloor = endpoint === from ? to.floor : from.floor;
  return (
    <g>
      <circle
        cx={endpoint.x + 0.5}
        cy={endpoint.z + 0.5}
        fill={connection.kind === "portal" ? "#bd78ff" : "#55d9e8"}
        r={0.25}
        stroke="#ffffff"
        strokeWidth={0.06}
      />
      <text
        fill="#ffffff"
        fontSize={0.28}
        textAnchor="middle"
        x={endpoint.x + 0.5}
        y={endpoint.z + 0.6}
      >
        {destinationFloor > floor ? "↑" : "↓"}
      </text>
    </g>
  );
}

function getFloorView(dungeon: Dungeon, floor: number): FloorView | null {
  const cells = [
    ...dungeon.rooms.flatMap((room) => room.footprint.cells),
    ...dungeon.connections.flatMap((connection) => connection.corridor?.cells ?? []),
  ].filter((cell) => cell.floor === floor);
  if (cells.length === 0) return null;
  const padding = 1;
  const minX = Math.min(...cells.map((cell) => cell.x)) - padding;
  const maxX = Math.max(...cells.map((cell) => cell.x)) + 1 + padding;
  const minZ = Math.min(...cells.map((cell) => cell.z)) - padding;
  const maxZ = Math.max(...cells.map((cell) => cell.z)) + 1 + padding;
  return { height: maxZ - minZ, minX, minZ, width: maxX - minX };
}

function getSocketCell(
  dungeon: Dungeon,
  roomId: string,
  socketId: string,
): GridCell | null {
  return dungeon.rooms
    .find((room) => room.id === roomId)
    ?.sockets.find((socket) => socket.id === socketId)
    ?.cell ?? null;
}

function roomCenter(room: DungeonRoom): { x: number; z: number } {
  return {
    x: room.footprint.cells.reduce((sum, cell) => sum + cell.x + 0.5, 0)
      / room.footprint.cells.length,
    z: room.footprint.cells.reduce((sum, cell) => sum + cell.z + 0.5, 0)
      / room.footprint.cells.length,
  };
}

function roomColor(room: DungeonRoom): string {
  if (room.role === "start") return "#4fd18b";
  if (room.role === "boss") return "#dc5252";
  if (room.role === "end") return "#f0cc55";
  if (room.role === "gate") return "#d58b45";
  if (room.role === "reward-leaf") return "#65b8e8";
  return hueFromString(`${room.biome}:${room.archetype}`);
}

function connectionColor(connection: DungeonConnection): string {
  if (connection.secret) return "#9c6bc4";
  if (connection.shortcut) return "#d08c4c";
  if (connection.traversal.lockedByDefault) return "#bf5f58";
  return "#6d829c";
}

function roomLabel(room: DungeonRoom): string {
  const roleLabels: Partial<Record<MissionRole, string>> = {
    boss: "BOSS",
    end: "END",
    gate: "GATE",
    "reward-leaf": "REWARD",
    start: "START",
  };
  return roleLabels[room.role] ?? room.archetype.toUpperCase();
}

function hueFromString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360} 34% 48%)`;
}

const minimapContainerStyle: React.CSSProperties = {
  background: "rgba(8, 12, 18, 0.94)",
  border: "1px solid #3c506a",
  borderRadius: 12,
  boxShadow: "0 10px 30px rgba(0,0,0,.38)",
  color: "#eef4fb",
  padding: 10,
  position: "fixed",
  right: 16,
  top: 16,
  width: 280,
  zIndex: 1000,
};

const expandedContainerStyle: React.CSSProperties = {
  ...minimapContainerStyle,
  bottom: "4vh",
  left: "4vw",
  right: "4vw",
  top: "4vh",
  width: "auto",
};

const headerStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 8,
};
const subtleTextStyle: React.CSSProperties = { color: "#95a7bb", fontSize: 10, marginTop: 2 };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: 5 };
const iconButtonStyle: React.CSSProperties = {
  background: "#182333",
  border: "1px solid #40536b",
  borderRadius: 6,
  color: "#f4f7fb",
  cursor: "pointer",
  fontSize: 16,
  height: 28,
  width: 30,
};
const floorSelectorStyle: React.CSSProperties = { display: "flex", gap: 5, marginBottom: 7 };
const floorButtonStyle: React.CSSProperties = {
  ...iconButtonStyle,
  color: "#aebed0",
  fontSize: 11,
  height: 25,
  width: "auto",
};
const activeFloorButtonStyle: React.CSSProperties = {
  ...floorButtonStyle,
  background: "#2c5665",
  borderColor: "#62cfe1",
  color: "#ffffff",
};
const footerStyle: React.CSSProperties = {
  color: "#95a7bb",
  display: "flex",
  fontSize: 9,
  gap: 10,
  justifyContent: "space-between",
  marginTop: 7,
};
const emptyStyle: React.CSSProperties = { color: "#aab9c9", fontSize: 12, padding: "28px 8px" };
const toggleButtonStyle: React.CSSProperties = {
  ...iconButtonStyle,
  height: 36,
  position: "fixed",
  right: 16,
  top: 16,
  width: 54,
  zIndex: 1000,
};

export default Minimap;
