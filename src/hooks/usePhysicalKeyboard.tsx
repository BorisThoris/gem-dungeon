import { useState, useEffect } from "react";

export const usePhysicalKeyboard = () => {
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]")) return;
      setKeys((prev) => ({
        ...prev,
        [event.code]: true,
      }));
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      setKeys((prev) => ({
        ...prev,
        [event.code]: false,
      }));
    };

    const clearKeys = () => setKeys({});
    window.addEventListener("blur", clearKeys);
    window.addEventListener("game-pause", clearKeys);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("blur", clearKeys);
      window.removeEventListener("game-pause", clearKeys);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return keys;
};
