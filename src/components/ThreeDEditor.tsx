import React, {
  useState,
  useEffect,
  useCallback,
  Suspense,
  useRef,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import * as THREE from "three";
import SharedNavigation from "./SharedNavigation";
import Door from "./Door";
import PlayerHand from "./PlayerHand";
import { Player } from "./Player";
import { useURLParams, parseJSON, serializeJSON } from "../hooks/useURLParams";

// Import the consolidated card system
import { useRoomActions } from "../hooks/useRoomActions";
import { mapToRoomType, hasActionCards } from "../utils/roomTypeMapper";
import RoomActionCards from "./RoomActionCards";

// Import player state for debugging
import {
  usePlayerStats,
  useConsolidatedGameStore,
} from "../store/consolidatedGameStore";
import PatternValidationTest from "./PatternValidationTest";

// Import configuration arrays
import { ROOM_CONFIGS } from "../configs/roomConfigs";
import { BIOME_CONFIGS } from "../configs/biomeConfigs";
import { OBJECT_CONFIGS } from "../configs/objectConfigs";
import { ELEMENT_CONFIGS } from "../configs/elementConfigs";
import type { RoomConfig } from "../configs/roomConfigs";

const LoadingFallback: React.FC = () => (
  <Html position={[0, 0, 0]}>
    <div
      style={{
        color: "white",
        background: "rgba(0,0,0,0.8)",
        padding: "20px",
        borderRadius: "8px",
      }}
    >
      Loading components...
    </div>
  </Html>
);

function EditorCameraReset({ playing }: { playing: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    if (playing) return;
    camera.position.set(10,10,10);
    camera.lookAt(0,1,0);
    if (camera instanceof THREE.PerspectiveCamera) { camera.fov=60;camera.updateProjectionMatrix(); }
  }, [camera,playing]);
  return null;
}

// Spawn Preview Component
const SpawnPreview: React.FC<{
  position: [number, number, number];
  isSpawning: boolean;
}> = ({ position, isSpawning }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame((state) => {
    if (meshRef.current) {
      // Make the preview face the camera
      meshRef.current.lookAt(camera.position);
      // Gentle floating animation
      meshRef.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  if (!isSpawning) return null;

  return (
    <group position={position}>
      {/* Ground indicator circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.5, 1, 32]} />
        <meshBasicMaterial color="#00ff00" transparent opacity={0.3} />
      </mesh>

      {/* Player preview capsule */}
      <mesh ref={meshRef}>
        <capsuleGeometry args={[0.4, 1.6, 4, 8]} />
        <meshBasicMaterial
          color="#00ff00"
          transparent
          opacity={0.6}
          wireframe
        />
      </mesh>

      {/* Spawn indicator text */}
      <Html position={[0, 2, 0]} center>
        <div
          style={{
            background: "rgba(0,0,0,0.8)",
            color: "#00ff00",
            padding: "8px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "bold",
            border: "1px solid #00ff00",
          }}
        >
          SPAWN HERE
        </div>
      </Html>
    </group>
  );
};

// Click Handler Component for spawn positioning
const SpawnClickHandler: React.FC<{
  onSpawnPositionChange: (position: [number, number, number]) => void;
  spawnMode: boolean;
}> = ({ onSpawnPositionChange, spawnMode }) => {
  const { camera, raycaster, mouse, scene } = useThree();

  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (!spawnMode) return;

      // Update mouse position
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Raycast from camera through mouse position
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        const point = intersects[0].point;
        // Set spawn position slightly above the hit point
        onSpawnPositionChange([point.x, point.y + 1.5, point.z]);
      }
    },
    [spawnMode, camera, raycaster, mouse, scene, onSpawnPositionChange]
  );

  useEffect(() => {
    if (spawnMode) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [spawnMode, handleClick]);

  return null;
};

// StatInput component for the stats editor
interface StatInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const StatInput: React.FC<StatInputProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
}) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <label style={{ minWidth: "80px", fontSize: "12px" }}>{label}:</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        min={min}
        max={max}
        style={{
          flex: 1,
          padding: "4px 8px",
          borderRadius: "4px",
          border: "1px solid #555",
          background: "rgba(255,255,255,0.1)",
          color: "white",
          fontSize: "12px",
        }}
      />
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        min={min}
        max={max}
        style={{
          flex: 1,
          accentColor: "#9C27B0",
        }}
      />
    </div>
  );
};

// Main editor component
const ThreeDEditor: React.FC = () => {
  const { urlParams, updateURL, getParam } = useURLParams();

  // ALL HOOKS MUST BE CALLED FIRST - NO CONDITIONAL RETURNS BEFORE THIS POINT

  // Add show action cards state - DISABLED (but keep logic)
  const [showActionCards, setShowActionCards] = useState<boolean>(false);

  // Add player stats editor state
  const [showStatsEditor, setShowStatsEditor] = useState<boolean>(false);

  // Add debugging states
  const [showDoors, setShowDoors] = useState<boolean>(false);
  const [showPlayerState, setShowPlayerState] = useState<boolean>(false);
  const [doorsLocked, setDoorsLocked] = useState<boolean>(false);
  const [showPatternTest, setShowPatternTest] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<boolean>(false);
  // Remove local showHand state - use global handsOut state instead
  const [spawnMode, setSpawnMode] = useState<boolean>(false);
  const [spawnPosition, setSpawnPosition] = useState<[number, number, number]>([
    0, 1.5, 0,
  ]);
  const [isSpawning, setIsSpawning] = useState<boolean>(false);
  useEffect(() => {
    const exitPlaytest=(event:KeyboardEvent)=>{
      if(event.key!=="Escape"||!isSpawning)return;
      document.exitPointerLock?.();window.dispatchEvent(new Event("game-pause"));setIsSpawning(false);
    };
    window.addEventListener("keydown",exitPlaytest);
    return()=>window.removeEventListener("keydown",exitPlaytest);
  },[isSpawning]);

  // Get player stats for debugging
  const playerStats = usePlayerStats();

  // Get full game store for stats editor
  const gameStore = useConsolidatedGameStore();

  // Get hands out state
  const [handsOut, setHandsOut] = useState(false);

  // Add consolidated card system for biomes - DISABLED (but keep logic)
  const [roomActionCards, setRoomActionCards] = useState<any[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<
    "rooms" | "biomes" | "objects" | "elements"
  >(
    () =>
      (getParam("category") as "rooms" | "biomes" | "objects" | "elements") ||
      "rooms"
  );
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>(
    () => getParam("subcategory") || "all"
  );
  const [selectedComponent, setSelectedComponent] = useState<RoomConfig | null>(
    () => {
      const componentType = getParam("componentType");
      const category = getParam("category") as
        | "rooms"
        | "biomes"
        | "objects"
        | "elements";
      console.log(
        "ThreeDEditor: Initializing with componentType:",
        componentType,
        "category:",
        category
      );
      if (componentType) {
        let configs = ROOM_CONFIGS;
        if (category === "biomes") configs = BIOME_CONFIGS;
        else if (category === "objects") configs = OBJECT_CONFIGS;
        else if (category === "elements") configs = ELEMENT_CONFIGS;

        console.log(
          "ThreeDEditor: Looking in configs:",
          configs.length,
          "items"
        );
        const found = configs.find((config) => config.type === componentType);
        console.log("ThreeDEditor: Found component:", found);
        return found || null;
      }
      return null;
    }
  );
  const [selectedObject, setSelectedObject] = useState<RoomConfig | null>(
    () => {
      const objectType = getParam("objectType");
      if (objectType) {
        return (
          OBJECT_CONFIGS.find((config) => config.type === objectType) || null
        );
      }
      return null;
    }
  );
  const [selectedElement, setSelectedElement] = useState<RoomConfig | null>(
    () => {
      const elementType = getParam("elementType");
      if (elementType) {
        return (
          ELEMENT_CONFIGS.find(
            (config: RoomConfig) => config.type === elementType
          ) || null
        );
      }
      return null;
    }
  );

  const [componentProps, setComponentProps] = useState<any>(() =>
    parseJSON(getParam("componentProps"), {})
  );
  const [objectProps, setObjectProps] = useState<any>(() =>
    parseJSON(getParam("objectProps"), {})
  );
  const [elementProps, setElementProps] = useState<any>(() =>
    parseJSON(getParam("elementProps"), {})
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadComponents = useCallback(() => {
    try {
      setIsLoading(true);

      // Only set default selections if no URL parameters are present
      const componentType = getParam("componentType");
      const objectType = getParam("objectType");
      const elementType = getParam("elementType");

      if (!componentType && ROOM_CONFIGS.length > 0) {
        setSelectedComponent(ROOM_CONFIGS[0]);
        setComponentProps(ROOM_CONFIGS[0].props || {});
      }
      if (!objectType && OBJECT_CONFIGS.length > 0) {
        setSelectedObject(OBJECT_CONFIGS[0]);
        setObjectProps(OBJECT_CONFIGS[0].props || {});
      }
      if (!elementType && ELEMENT_CONFIGS.length > 0) {
        setSelectedElement(ELEMENT_CONFIGS[0]);
        setElementProps(ELEMENT_CONFIGS[0].props || {});
      }

      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load components:", err);
      setError(
        "Failed to load components. Please check the console for details."
      );
      setIsLoading(false);
    }
  }, [getParam]);

  // Load components on mount
  useEffect(() => {
    loadComponents();
  }, [loadComponents]);

  // Update URL when category changes
  useEffect(() => {
    updateURL({
      category: selectedCategory,
    });
  }, [selectedCategory, updateURL]);

  // Update URL when subcategory changes
  useEffect(() => {
    updateURL({
      subcategory: selectedSubcategory,
    });
  }, [selectedSubcategory, updateURL]);

  // Get current configs based on selected category and subcategory
  const getCurrentConfigs = () => {
    let configs = [];
    switch (selectedCategory) {
      case "rooms":
        configs = ROOM_CONFIGS;
        break;
      case "biomes":
        configs = BIOME_CONFIGS;
        break;
      case "objects":
        configs = OBJECT_CONFIGS;
        break;
      case "elements":
        configs = ELEMENT_CONFIGS;
        break;
      default:
        return ROOM_CONFIGS;
    }

    // Filter by subcategory if not "all"
    if (selectedCategory === "biomes" && selectedSubcategory !== "all") {
      return configs.filter(
        (config: RoomConfig) => config.subcategory === selectedSubcategory
      );
    }

    return configs;
  };

  // Get current selection based on category
  const getCurrentSelection = useCallback(() => {
    switch (selectedCategory) {
      case "rooms":
        return selectedComponent;
      case "biomes":
        return selectedComponent;
      case "objects":
        return selectedObject;
      case "elements":
        return selectedElement;
      default:
        return selectedComponent;
    }
  }, [selectedCategory, selectedComponent, selectedObject, selectedElement]);

  // Update room action cards when component changes
  useEffect(() => {
    const currentComponent = getCurrentSelection();
    console.log("ThreeDEditor: Card effect triggered", {
      selectedCategory,
      currentComponent: currentComponent?.type,
      hasComponent: !!currentComponent,
    });

    if (selectedCategory === "biomes" && currentComponent) {
      const roomType = mapToRoomType(currentComponent.type);
      console.log("ThreeDEditor: Mapped room type:", roomType);

      if (roomType) {
        // Simple function to get cards without hooks
        const getRoomCardsForType = (roomType: string): any[] => {
          switch (roomType) {
            case "portal":
              return [
                {
                  id: "activate_portal",
                  title: "Activate Portal",
                  description: "Activate the portal to travel",
                  icon: "🌀",
                  action: () => console.log("Portal activated in editor"),
                  cost: 0,
                },
                {
                  id: "study_portal",
                  title: "Study Portal",
                  description: "Study the portal's magical properties",
                  icon: "🔮",
                  action: () => console.log("Portal studied in editor"),
                  cost: 0,
                },
              ];
            case "coffee":
              return [
                {
                  id: "brew_coffee",
                  title: "Brew Coffee",
                  description: "Brew a fresh cup of coffee for energy boost",
                  icon: "☕",
                  action: () => console.log("Coffee brewed in editor"),
                  cost: 0,
                },
                {
                  id: "coffee_break",
                  title: "Coffee Break",
                  description: "Take a relaxing coffee break to restore energy",
                  icon: "🛋️",
                  action: () => console.log("Coffee break taken in editor"),
                  cost: 10,
                },
              ];
            default:
              return [];
          }
        };
        const cards = getRoomCardsForType(roomType);
        console.log("ThreeDEditor: Generated cards:", cards);
        // CARDS DISABLED - Generate cards but don't use them
        setRoomActionCards([]);
      } else {
        console.log("ThreeDEditor: No room type found, clearing cards");
        setRoomActionCards([]);
      }
    } else {
      console.log("ThreeDEditor: Not biomes or no component, clearing cards");
      setRoomActionCards([]);
    }
  }, [
    selectedCategory,
    selectedComponent,
    selectedObject,
    selectedElement,
    getCurrentSelection,
  ]);

  // Get current props based on category with debugging callbacks
  const getCurrentProps = () => {
    const baseProps = (() => {
      switch (selectedCategory) {
        case "rooms":
          return componentProps;
        case "biomes":
          return componentProps;
        case "objects":
          return objectProps;
        case "elements":
          return elementProps;
        default:
          return componentProps;
      }
    })();

    // Add debugging callbacks and drag mode for biomes
    const selection = getCurrentSelection();
    if (selectedCategory === "biomes") {
      const biomeProps = {
        ...baseProps,
        dragMode: dragMode,
      };

      if (selection?.type === "memory-puzzle") {
        return {
          ...biomeProps,
          onDoorsLock: () => {
            console.log("DEBUG: Doors locked!");
            setDoorsLocked(true);
          },
          onDoorsUnlock: () => {
            console.log("DEBUG: Doors unlocked!");
            setDoorsLocked(false);
          },
          onRoomComplete: () => {
            console.log("DEBUG: Room completed!");
          },
        };
      }

      if (selection?.type === "pressure-plate-puzzle") {
        return {
          ...biomeProps,
          onDoorsLock: () => {
            console.log("DEBUG: Doors locked!");
            setDoorsLocked(true);
          },
          onDoorsUnlock: () => {
            console.log("DEBUG: Doors unlocked!");
            setDoorsLocked(false);
          },
          onRoomComplete: () => {
            console.log("DEBUG: Room completed!");
          },
        };
      }

      return biomeProps;
    }

    return baseProps;
  };

  // Event handlers
  const handleComponentSelect = (component: RoomConfig) => {
    setSelectedComponent(component);
    setComponentProps(component.props || {});
    updateURL({
      componentType: component.type,
      componentProps: serializeJSON(component.props || {}),
    });
  };

  const handleObjectSelect = (object: RoomConfig) => {
    setSelectedObject(object);
    setObjectProps(object.props || {});
    updateURL({
      objectType: object.type,
      objectProps: serializeJSON(object.props || {}),
    });
  };

  const handleElementSelect = (element: RoomConfig) => {
    setSelectedElement(element);
    setElementProps(element.props || {});
    updateURL({
      elementType: element.type,
      elementProps: serializeJSON(element.props || {}),
    });
  };

  const handlePropChange = (key: string, value: any) => {
    const newProps = { ...componentProps, [key]: value };
    setComponentProps(newProps);
    updateURL({
      componentProps: serializeJSON(newProps),
    });
  };

  const handleObjectPropChange = (key: string, value: any) => {
    const newProps = { ...objectProps, [key]: value };
    setObjectProps(newProps);
    updateURL({
      objectProps: serializeJSON(newProps),
    });
  };

  const handleElementPropChange = (key: string, value: any) => {
    const newProps = { ...elementProps, [key]: value };
    setElementProps(newProps);
    updateURL({
      elementProps: serializeJSON(newProps),
    });
  };

  // CONDITIONAL RENDERING - NOW SAFE TO DO AFTER ALL HOOKS
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "#1a1a1a",
          color: "white",
        }}
      >
        <div>
          <h2>Loading 3D Editor...</h2>
          <p>Please wait while components are being loaded.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "#1a1a1a",
          color: "white",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2>Error Loading 3D Editor</h2>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              background: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              marginTop: "20px",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Handle category selection
  const handleCategorySelect = (
    category: "rooms" | "biomes" | "objects" | "elements"
  ) => {
    setSelectedCategory(category);
  };

  // Handle component selection based on category
  const handleItemSelect = (item: RoomConfig) => {
    switch (selectedCategory) {
      case "rooms":
        handleComponentSelect(item);
        break;
      case "biomes":
        handleComponentSelect(item);
        break;
      case "objects":
        handleObjectSelect(item);
        break;
      case "elements":
        handleElementSelect(item);
        break;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#1a1a1a" }}>
      {/* Custom scrollbar styles */}
      <style>{`
        .category-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .category-scroll::-webkit-scrollbar-track {
          background: #333;
          border-radius: 3px;
        }
        .category-scroll::-webkit-scrollbar-thumb {
          background: #666;
          border-radius: 3px;
        }
        .category-scroll::-webkit-scrollbar-thumb:hover {
          background: #888;
        }
      `}</style>

      {/* Navigation */}
      <SharedNavigation currentPage="editor" />

      {/* Sidebar */}
      <div
        style={{
          width: "300px",
          background: "#2a2a2a",
          padding: "20px",
          overflowY: "auto",
          borderRight: "1px solid #444",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          position: "relative",
        }}
      >
        <h2 style={{ color: "white", marginBottom: "20px" }}>3D Editor</h2>

        {/* Category Tabs */}
        <div style={{ marginBottom: "20px" }}>
          <div
            className="category-scroll"
            style={{
              display: "flex",
              gap: "5px",
              marginBottom: "15px",
              flexWrap: "wrap",
              maxHeight: "120px",
              overflowY: "auto",
              paddingRight: "5px",
              // Custom scrollbar styling
              scrollbarWidth: "thin",
              scrollbarColor: "#666 #333",
            }}
          >
            {[
              {
                key: "rooms",
                label: "🏠 Rooms",
                count: ROOM_CONFIGS.length,
              },
              {
                key: "biomes",
                label: "🌍 Biomes",
                count: BIOME_CONFIGS.length,
              },
              {
                key: "objects",
                label: "🎯 Objects",
                count: OBJECT_CONFIGS.length,
              },
              {
                key: "elements",
                label: "🧱 Elements",
                count: ELEMENT_CONFIGS.length,
              },
            ].map((category) => (
              <button
                key={category.key}
                onClick={() => {
                  handleCategorySelect(
                    category.key as "rooms" | "biomes" | "objects" | "elements"
                  );
                  setSelectedSubcategory("all"); // Reset subcategory when changing category
                }}
                style={{
                  padding: "8px 12px",
                  background:
                    selectedCategory === category.key ? "#4CAF50" : "#333",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                {category.label}
                <span
                  style={{
                    background:
                      selectedCategory === category.key
                        ? "rgba(255,255,255,0.3)"
                        : "rgba(255,255,255,0.1)",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    fontSize: "10px",
                  }}
                >
                  {category.count}
                </span>
              </button>
            ))}
          </div>

          {/* Subcategory Filter for Biomes */}
          {selectedCategory === "biomes" && (
            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  color: "white",
                  fontSize: "14px",
                  marginBottom: "8px",
                  display: "block",
                }}
              >
                Subcategory:
              </label>
              <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  background: "#444",
                  color: "white",
                  border: "1px solid #666",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                <option value="all">All Biomes</option>
                <option value="buff">💪 Buff/Healing</option>
                <option value="resource">💰 Resource/Economy</option>
                <option value="puzzle">🧩 Puzzle/Interaction</option>
                <option value="transport">🚀 Transportation</option>
                <option value="obstacle">🚧 Obstacle/Architectural</option>
                <option value="special">✨ Special/Unique</option>
                <option value="utility">🔧 Utility</option>
              </select>
            </div>
          )}
        </div>

        {/* Current Category Items */}
        <div
          style={{
            marginBottom: "30px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="category-scroll"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              flex: 1,
              overflowY: "auto",
              paddingRight: "5px",
            }}
          >
            {getCurrentConfigs().map((item: RoomConfig) => (
              <button
                key={item.type}
                onClick={() => handleItemSelect(item)}
                style={{
                  padding: "10px",
                  background:
                    getCurrentSelection()?.type === item.type
                      ? "#4CAF50"
                      : "#333",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span>{item.emoji}</span>
                <div>
                  <div style={{ fontWeight: "bold" }}>{item.title}</div>
                  <div style={{ fontSize: "12px", opacity: 0.8 }}>
                    {item.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Properties Panel */}
        {getCurrentSelection() && (
          <div style={{ marginTop: "20px", flexShrink: 0 }}>
            <h3 style={{ color: "#4CAF50", marginBottom: "15px" }}>
              Properties
            </h3>

            {/* Debugging Controls */}
            <div
              style={{
                marginBottom: "20px",
                padding: "10px",
                background: "#333",
                borderRadius: "5px",
              }}
            >
              <div style={{ marginBottom: "8px" }}>
                <label
                  style={{
                    color: "white",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showPlayerState}
                    onChange={(e) => setShowPlayerState(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  Show Player State
                </label>
              </div>

              <div style={{ marginBottom: "8px" }}>
                <label
                  style={{
                    color: "white",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showPatternTest}
                    onChange={(e) => setShowPatternTest(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  Show Pattern Test
                </label>
              </div>

              <div style={{ marginBottom: "8px" }}>
                <label
                  style={{
                    color: "white",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={dragMode}
                    onChange={(e) => setDragMode(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  🖱️ Drag Mode
                </label>
              </div>

              {doorsLocked && (
                <div
                  style={{
                    color: "#FF6B6B",
                    fontSize: "12px",
                    marginTop: "5px",
                  }}
                >
                  🔒 Doors are LOCKED
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {getCurrentSelection()?.editableProps?.map((prop) => (
                <div key={prop.key}>
                  <label
                    style={{
                      display: "block",
                      color: "white",
                      marginBottom: "5px",
                      fontSize: "14px",
                    }}
                  >
                    {prop.label}
                  </label>
                  {prop.type === "number" ? (
                    <input
                      type="number"
                      value={getCurrentProps()[prop.key] || prop.min || 0}
                      min={prop.min}
                      max={prop.max}
                      step={prop.step}
                      onChange={(e) =>
                        handlePropChange(prop.key, parseFloat(e.target.value))
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "#444",
                        color: "white",
                        border: "1px solid #666",
                        borderRadius: "4px",
                      }}
                    />
                  ) : prop.type === "color" ? (
                    <input
                      type="color"
                      value={getCurrentProps()[prop.key] || "#ffffff"}
                      onChange={(e) =>
                        handlePropChange(prop.key, e.target.value)
                      }
                      style={{
                        width: "100%",
                        padding: "4px",
                        background: "#444",
                        border: "1px solid #666",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    />
                  ) : prop.type === "boolean" ? (
                    <input
                      type="checkbox"
                      checked={getCurrentProps()[prop.key] || false}
                      onChange={(e) =>
                        handlePropChange(prop.key, e.target.checked)
                      }
                      style={{ marginRight: "8px" }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={getCurrentProps()[prop.key] || ""}
                      onChange={(e) =>
                        handlePropChange(prop.key, e.target.value)
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "#444",
                        color: "white",
                        border: "1px solid #666",
                        borderRadius: "4px",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main 3D Viewport */}
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",zIndex:1003,display:"flex",alignItems:"center",gap:12,padding:"10px 14px",border:"1px solid #555",borderRadius:6,background:"#222e",color:"white",fontFamily:"Arial",fontSize:12,whiteSpace:"nowrap"}}>
          <span>{isSpawning?"WASD to walk · hold right mouse to look":"Edit properties, then walk through your scene."}</span>
          <button disabled={!getCurrentSelection() || !["rooms","biomes"].includes(selectedCategory)}
            onClick={()=>{document.exitPointerLock?.();window.dispatchEvent(new Event("game-pause"));setIsSpawning(!isSpawning);setSpawnMode(false);}}
            style={{padding:"10px 16px",background:"#4CAF50",color:"white",border:0,borderRadius:4,cursor:"pointer",opacity:getCurrentSelection()?1:.5}}>
            {isSpawning?"Return to editing (Esc)":"Play scene"}
          </button>
        </div>
        <Canvas camera={{ position: [10, 10, 10], fov: 60 }}>
          <EditorCameraReset playing={isSpawning}/>
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
          {/* Disable OrbitControls when player is spawned */}
          {!isSpawning && (
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
            />
          )}

          <Physics>
            <Suspense fallback={<LoadingFallback />}>
              {getCurrentSelection() &&
                (() => {
                  const Component = getCurrentSelection()!.component;
                  return <Component {...getCurrentProps()} />;
                })()}

              {/* Debug Doors - Show around the room */}
              {showDoors && getCurrentSelection() && (
                <>
                  {/* North Door */}
                  <Door
                    position={[0, 0.5, 5]}
                    rotation={[0, 0, 0]}
                    targetRoomId="north-room"
                    showLabel={true}
                    state={doorsLocked ? "locked" : "closed"}
                    type={doorsLocked ? "locked" : "standard"}
                    isLocked={doorsLocked}
                    onDoorClick={() => console.log("North door clicked")}
                  />

                  {/* South Door */}
                  <Door
                    position={[0, 0.5, -5]}
                    rotation={[0, Math.PI, 0]}
                    targetRoomId="south-room"
                    showLabel={true}
                    state={doorsLocked ? "locked" : "closed"}
                    type={doorsLocked ? "locked" : "standard"}
                    isLocked={doorsLocked}
                    onDoorClick={() => console.log("South door clicked")}
                  />

                  {/* East Door */}
                  <Door
                    position={[5, 0.5, 0]}
                    rotation={[0, -Math.PI / 2, 0]}
                    targetRoomId="east-room"
                    showLabel={true}
                    state={doorsLocked ? "locked" : "closed"}
                    type={doorsLocked ? "locked" : "standard"}
                    isLocked={doorsLocked}
                    onDoorClick={() => console.log("East door clicked")}
                  />

                  {/* West Door */}
                  <Door
                    position={[-5, 0.5, 0]}
                    rotation={[0, Math.PI / 2, 0]}
                    targetRoomId="west-room"
                    showLabel={true}
                    state={doorsLocked ? "locked" : "closed"}
                    type={doorsLocked ? "locked" : "standard"}
                    isLocked={doorsLocked}
                    onDoorClick={() => console.log("West door clicked")}
                  />
                </>
              )}

              {/* Debug info in 3D scene - DISABLED */}
              {false &&
                selectedCategory === "biomes" &&
                showActionCards &&
                roomActionCards &&
                roomActionCards.length > 0 && (
                  <Html position={[0, 5, 0]}>
                    <div
                      style={{
                        background: "rgba(0,0,0,0.8)",
                        color: "white",
                        padding: "10px",
                        borderRadius: "5px",
                        fontSize: "12px",
                      }}
                    >
                      DEBUG: {roomActionCards.length} cards available
                    </div>
                  </Html>
                )}

              {/* Player State Display */}
              {showPlayerState && (
                <Html position={[0, 8, 0]}>
                  <div
                    style={{
                      background: "rgba(0,0,0,0.9)",
                      color: "white",
                      padding: "15px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      minWidth: "200px",
                      border: "2px solid #4CAF50",
                    }}
                  >
                    <h4 style={{ margin: "0 0 10px 0", color: "#4CAF50" }}>
                      👤 Player State
                    </h4>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "5px",
                      }}
                    >
                      <div>
                        <strong>Lives:</strong> {playerStats.lives}/
                        {playerStats.maxLives}
                      </div>
                      <div>
                        <strong>Level:</strong> {playerStats.level}
                      </div>
                      <div>
                        <strong>XP:</strong> {playerStats.experience}
                      </div>
                      <div>
                        <strong>Points:</strong> {playerStats.points}
                      </div>
                      <div>
                        <strong>Keys:</strong> {playerStats.keys}
                      </div>
                      <div>
                        <strong>Bombs:</strong> {playerStats.bombs}
                      </div>
                      <div>
                        <strong>Floor:</strong> {playerStats.currentFloor}
                      </div>
                      <div>
                        <strong>Rooms:</strong> {playerStats.roomsCompleted}
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "10px",
                        color: "#888",
                      }}
                    >
                      <div>
                        <strong>Size:</strong> {playerStats.size.toFixed(1)}x
                      </div>
                      <div>
                        <strong>Speed:</strong> {playerStats.speed.toFixed(1)}x
                      </div>
                      <div>
                        <strong>Strength:</strong>{" "}
                        {playerStats.strength.toFixed(1)}x
                      </div>
                      <div>
                        <strong>Defense:</strong> {playerStats.defense}
                      </div>
                    </div>
                  </div>
                </Html>
              )}
            </Suspense>

            {/* Spawn Click Handler */}
            <SpawnClickHandler
              onSpawnPositionChange={setSpawnPosition}
              spawnMode={spawnMode}
            />

            {/* Spawn Preview */}
            <SpawnPreview position={spawnPosition} isSpawning={spawnMode} />

            {/* Spawned Player */}
            {isSpawning && (
              <Player
                initialSpawnPosition={spawnPosition}
                fallResetY={-20}
                initialYaw={selectedCategory === "rooms" ? -Math.PI / 2 : 0}
                showDebugInfo={false}
                showHand={handsOut}
                handGesture="idle"
                editorMode={false} // Full player control
              />
            )}
          </Physics>
        </Canvas>

        {/* Action Cards Toggle Button - DISABLED */}
        {false &&
          selectedCategory === "biomes" &&
          roomActionCards &&
          roomActionCards.length > 0 && (
            <button
              onClick={() => setShowActionCards(!showActionCards)}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                zIndex: 1001,
                width: "40px",
                height: "40px",
                background: showActionCards ? "#FF6B6B" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: "bold",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                transition: "background 0.2s ease",
              }}
            >
              {showActionCards ? "✕" : "🎮"}
            </button>
          )}

        {/* Player Stats Editor Toggle Button */}
        <button
          onClick={() => setShowStatsEditor(!showStatsEditor)}
          style={{
            position: "absolute",
            top: "20px",
            right:
              showActionCards &&
              selectedCategory === "biomes" &&
              roomActionCards &&
              roomActionCards.length > 0
                ? "70px"
                : "20px",
            zIndex: 1001,
            width: "40px",
            height: "40px",
            background: showStatsEditor ? "#FF6B6B" : "#9C27B0",
            color: "white",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            fontWeight: "bold",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            transition: "background 0.2s ease",
          }}
        >
          {showStatsEditor ? "✕" : "📊"}
        </button>

        {/* Debug Controls - Floating Buttons */}
        <button
          onClick={() => setShowDoors(!showDoors)}
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            zIndex: 1001,
            width: "40px",
            height: "40px",
            background: showDoors ? "#4CAF50" : "#666",
            color: "white",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            fontWeight: "bold",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            transition: "background 0.2s ease",
          }}
          title="Toggle Doors"
        >
          🚪
        </button>

        <button
          onClick={() => { setHandsOut(!handsOut); gameStore.setHandsOut(true); }}
          style={{
            position: "absolute",
            top: "70px",
            left: "20px",
            zIndex: 1001,
            width: "40px",
            height: "40px",
            background: handsOut ? "#FF9800" : "#666",
            color: "white",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            fontWeight: "bold",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            transition: "background 0.2s ease",
          }}
          title="Toggle Hand"
        >
          🖐️
        </button>

        <button
          onClick={() => setSpawnMode(!spawnMode)}
          style={{
            position: "absolute",
            top: "120px",
            left: "20px",
            zIndex: 1001,
            width: "40px",
            height: "40px",
            background: spawnMode ? "#2196F3" : "#666",
            color: "white",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            fontWeight: "bold",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            transition: "background 0.2s ease",
          }}
          title="Choose a playtest spawn"
        >
          👤
        </button>

        {/* Spawn Instructions */}
        {spawnMode && (
          <div
            style={{
              position: "absolute",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1002,
              background: "rgba(0,0,0,0.9)",
              color: "#00ff00",
              padding: "12px 20px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "bold",
              border: "2px solid #00ff00",
              textAlign: "center",
            }}
          >
            Click anywhere to position player spawn point
          </div>
        )}

        {/* Spawn Button */}
        {spawnMode && (
          <button
            onClick={() => {
              setIsSpawning(true);
              setSpawnMode(false);
            }}
            style={{
              position: "absolute",
              top: "70px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1002,
              background: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "25px",
              padding: "10px 20px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              transition: "background 0.2s ease",
            }}
          >
            PLAY THIS SCENE
          </button>
        )}

        {/* Action Cards Overlay - DISABLED */}
        {false &&
          selectedCategory === "biomes" &&
          showActionCards &&
          roomActionCards &&
          roomActionCards.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "70px",
                right: "20px",
                zIndex: 1000,
                maxWidth: "300px",
              }}
            >
              <RoomActionCards
                cards={roomActionCards}
                isVisible={true}
                onCardClick={(card) => {
                  console.log("Card clicked in ThreeDEditor:", card.title);
                }}
              />
            </div>
          )}

        {/* Player Stats Editor Overlay */}
        {showStatsEditor && (
          <div
            style={{
              position: "absolute",
              top: "70px",
              right: "20px",
              zIndex: 1002,
              background: "rgba(0,0,0,0.95)",
              color: "white",
              padding: "20px",
              borderRadius: "8px",
              maxWidth: "400px",
              maxHeight: "80vh",
              overflow: "auto",
              border: "2px solid #9C27B0",
            }}
          >
            <h3 style={{ margin: "0 0 15px 0", color: "#9C27B0" }}>
              📊 Player Stats Editor
            </h3>

            {/* Player Stats */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#FFD700" }}>
                Player Stats
              </h4>
              <div style={{ display: "grid", gap: "8px" }}>
                <StatInput
                  label="Lives"
                  value={gameStore.playerStats.lives}
                  onChange={(value) => gameStore.setLives(value)}
                  min={0}
                  max={10}
                />
                <StatInput
                  label="Experience"
                  value={gameStore.playerStats.experience}
                  onChange={(value) => gameStore.setExperience(value)}
                  min={0}
                  max={1000}
                />
                <StatInput
                  label="Points"
                  value={gameStore.playerStats.points}
                  onChange={(value) => gameStore.setPoints(value)}
                  min={0}
                  max={10000}
                />
                <StatInput
                  label="Strength"
                  value={gameStore.playerStats.strength}
                  onChange={(value) => gameStore.setStrength(value)}
                  min={0}
                  max={100}
                />
                <StatInput
                  label="Speed"
                  value={gameStore.playerStats.speed}
                  onChange={(value) => gameStore.setSpeed(value)}
                  min={0}
                  max={100}
                />
                <StatInput
                  label="Defense"
                  value={gameStore.playerStats.defense}
                  onChange={(value) => gameStore.setDefense(value)}
                  min={0}
                  max={100}
                />
                <StatInput
                  label="Bombs"
                  value={gameStore.playerStats.bombs}
                  onChange={(value) => gameStore.setBombs(value)}
                  min={0}
                  max={50}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#FFD700" }}>
                Quick Actions
              </h4>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  onClick={() => gameStore.resetPlayerStats()}
                  style={{
                    background: "#FF6B6B",
                    color: "white",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Reset All
                </button>
                <button
                  onClick={() => gameStore.setHealth(100)}
                  style={{
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Full Health
                </button>
                <button
                  onClick={() => gameStore.setLives(3)}
                  style={{
                    background: "#2196F3",
                    color: "white",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Full Lives
                </button>
              </div>
            </div>

            {/* Current Values Display */}
            <div>
              <h4 style={{ margin: "0 0 10px 0", color: "#FFD700" }}>
                Current Values
              </h4>
              <pre
                style={{
                  background: "rgba(255,255,255,0.1)",
                  padding: "10px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  overflow: "auto",
                  maxHeight: "200px",
                }}
              >
                {JSON.stringify(gameStore.playerStats, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Pattern Test Overlay */}
        {showPatternTest && (
          <div
            style={{
              position: "absolute",
              top: "20px",
              left: "20px",
              zIndex: 1002,
              background: "rgba(0,0,0,0.9)",
              color: "white",
              padding: "20px",
              borderRadius: "8px",
              maxWidth: "400px",
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <PatternValidationTest />
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreeDEditor;
