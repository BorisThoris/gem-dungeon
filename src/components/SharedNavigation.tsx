import React from "react";
import { useSaveSystem } from "../hooks/useSaveSystem";

interface SharedNavigationProps {
  currentPage:
    | "game"
    | "editor"
    | "texture-painter"
    | "mosaic-creator"
    | "room-builder";
  className?: string;
}

const SharedNavigation: React.FC<SharedNavigationProps> = ({
  currentPage,
  className = "",
}) => {
  const { saveGame } = useSaveSystem();
  const [error, setError] = React.useState("");
  const navItems = [
    {
      id: "game",
      label: "Return to expedition",
      url: "?resume=true",
      description: "Main Game",
    },
    {
      id: "editor",
      label: "3D Editor",
      url: "?editor=true&category=rooms&componentType=corridor",
      description: "3D Scene Builder",
    },
    {
      id: "room-builder",
      label: "Room Builder",
      url: "?room-builder=true",
      description: "Build Rooms from Biomes",
    },
    {
      id: "texture-painter",
      label: "Textures",
      url: "?texture-painter=true",
      description: "Advanced Texture Painter with Library",
    },
    {
      id: "mosaic-creator",
      label: "Mosaic",
      url: "?mosaic-creator=true",
      description: "Texture Creation Tool",
    },
  ];

  return (
    <nav
      className={`shared-navigation ${className}`.trim()}
      aria-label="Application modes"
    >
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            if (currentPage === item.id) return;
            if (currentPage === "game" && !saveGame()) {
              setError("Checkpoint could not be saved. Return to the expedition and try again.");
              return;
            }
            window.location.href = item.url;
          }}
          className="shared-navigation__item"
          aria-current={currentPage === item.id ? "page" : undefined}
          title={item.description}
        >
          {currentPage === "game" && item.id !== "game" ? `Save & open ${item.label}` : item.label}
        </button>
      ))}
      {error && <p role="alert">{error}</p>}
    </nav>
  );
};

export default SharedNavigation;
