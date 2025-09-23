import React from "react";
import { Canvas } from "@react-three/fiber";
import { Physics, RigidBody } from "@react-three/rapier";
import {
  Gltf,
  Environment,
  Fisheye,
  KeyboardControls,
} from "@react-three/drei";
import Controller from "ecctrl";

// Keyboard controls mapping
const keyboardMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "jump", keys: ["Space"] },
  { name: "run", keys: ["Shift"] },
];

// Ground Plane Component
const Ground: React.FC = () => {
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshLambertMaterial color="#2d5016" />
      </mesh>
    </RigidBody>
  );
};

// Main Scene Component
const GhostScene: React.FC = () => {
  return (
    <>
      {/* Environment */}
      <Environment files="/night.hdr" ground={{ scale: 100 }} />

      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <directionalLight
        intensity={0.7}
        castShadow
        shadow-bias={-0.0004}
        position={[-20, 20, 20]}
      >
        <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20]} />
      </directionalLight>

      {/* Physics World */}
      <Physics timeStep="vary">
        {/* Keyboard Controls */}
        <KeyboardControls map={keyboardMap}>
          {/* Ghost Character with Controller */}
          <Controller maxVelLimit={5}>
            <Gltf
              castShadow
              receiveShadow
              scale={0.315}
              position={[0, -0.55, 0]}
              src="/ghost_w_tophat-transformed.glb"
            />
          </Controller>
        </KeyboardControls>

        {/* Ground */}
        <Ground />
      </Physics>
    </>
  );
};

const StartScreen: React.FC = () => {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        background: "linear-gradient(to bottom, #87CEEB 0%, #98D8E8 100%)",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    >
      <Canvas
        shadows
        onPointerDown={(e) => (e.target as HTMLElement).requestPointerLock()}
        style={{
          width: "100%",
          height: "100%",
          background: "transparent",
          display: "block",
        }}
        gl={{
          antialias: true,
          alpha: true,
        }}
        dpr={[1, 2]}
      >
        <Fisheye zoom={0.4}>
          <GhostScene />
        </Fisheye>
      </Canvas>
    </div>
  );
};

export default StartScreen;
