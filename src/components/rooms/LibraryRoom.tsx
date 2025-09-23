import React, { useState } from "react";
import { RigidBody } from "@react-three/rapier";
import { Text } from "@react-three/drei";
import type { Item } from "../../types/map";
import ItemSprite from "../ItemSprite";

interface LibraryRoomProps {
  books: Item[];
  onBookRead: (book: Item) => void;
  onKnowledgeGain: (amount: number) => void;
}

const LibraryRoom: React.FC<LibraryRoomProps> = ({
  books,
  onBookRead,
  onKnowledgeGain,
}) => {
  const [selectedBook, setSelectedBook] = useState<Item | null>(null);
  const [isReading, setIsReading] = useState(false);

  // Create simple bookshelf models instead of loading VOX

  const handleBookRead = (book: Item) => {
    setSelectedBook(book);
    setIsReading(true);
    onBookRead(book);
    onKnowledgeGain(50); // Gain knowledge from reading

    // Stop reading after 2 seconds
    setTimeout(() => {
      setIsReading(false);
      setSelectedBook(null);
    }, 2000);
  };

  return (
    <group>
      {/* Library Floor - Simple platform */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[8, 0.2, 8]} />
          <meshLambertMaterial color="#8B4513" />
        </mesh>
      </RigidBody>

      {/* Bookshelves */}
      {Array.from({ length: 4 }).map((_, i) => {
        const angle = (i * Math.PI) / 2;
        const x = Math.cos(angle) * 3;
        const z = Math.sin(angle) * 3;

        return (
          <group key={i} position={[x, 0, z]} rotation={[0, angle, 0]}>
            {/* Bookshelf Structure - Simple 3D model */}
            <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.2, 3, 2]} />
              <meshLambertMaterial color="#654321" />
            </mesh>

            {/* Books on Shelf */}
            {Array.from({ length: 6 }).map((_, j) => (
              <mesh
                key={j}
                position={[
                  ((j % 3) - 1) * 0.3,
                  Math.floor(j / 3) * 0.4 - 0.4,
                  0.1,
                ]}
              >
                <boxGeometry args={[0.25, 0.3, 0.05]} />
                <meshLambertMaterial
                  color={j % 2 === 0 ? "#8B0000" : "#000080"}
                />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Central Reading Table */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[2, 0.1, 2]} />
          <meshLambertMaterial color="#DEB887" />
        </mesh>

        {/* Table Legs */}
        {[
          [-0.8, -0.8],
          [0.8, -0.8],
          [-0.8, 0.8],
          [0.8, 0.8],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.2, z]}>
            <boxGeometry args={[0.1, 0.4, 0.1]} />
            <meshLambertMaterial color="#654321" />
          </mesh>
        ))}
      </group>

      {/* Knowledge Books */}
      {books.map((book, index) => (
        <group key={book.id}>
          <ItemSprite
            item={book}
            position={
              [
                ((index % 3) - 1) * 1.5,
                1.2,
                Math.floor(index / 3) * 1.5 - 0.5,
              ] as [number, number, number]
            }
            scale={0.6}
            onClick={() => handleBookRead(book)}
          />

          {/* Book Glow */}
          <mesh
            position={[
              ((index % 3) - 1) * 1.5,
              1.2,
              Math.floor(index / 3) * 1.5 - 0.5,
            ]}
          >
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshBasicMaterial color="#FFD700" transparent opacity={0.3} />
          </mesh>
        </group>
      ))}

      {/* Reading Effect */}
      {isReading && selectedBook && (
        <group position={[0, 2, 0]}>
          {/* Reading indicator - Simple colored cube */}
          <mesh>
            <boxGeometry args={[2, 0.3, 0.1]} />
            <meshBasicMaterial color="#FFD700" />
          </mesh>

          {/* Knowledge Particles */}
          {Array.from({ length: 10 }).map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 4,
                Math.random() * 2,
                (Math.random() - 0.5) * 4,
              ]}
            >
              <sphereGeometry args={[0.1, 4, 4]} />
              <meshBasicMaterial color="#FFD700" transparent opacity={0.8} />
            </mesh>
          ))}
        </group>
      )}

      {/* Room Title - Simple colored cube */}
      {/* Library Sign - Large visible sign */}
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[4, 0.5, 0.2]} />
        <meshBasicMaterial color="#8B4513" />
      </mesh>

      {/* Library Title Text */}
      <Text
        position={[0, 3, 0.15]}
        fontSize={0.8}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
      >
        LIBRARY
      </Text>

      {/* Library Indicator - Large brown book stack */}
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[2, 2, 1]} />
        <meshBasicMaterial color="#8B4513" />
      </mesh>

      {/* Instructions */}
      <mesh position={[0, -2, 0]}>
        <boxGeometry args={[2, 0.2, 0.1]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
      <Text
        position={[0, -2, 0.15]}
        fontSize={0.4}
        color="#000000"
        anchorX="center"
        anchorY="middle"
      >
        CLICK TO READ
      </Text>

      {/* Atmospheric Lighting */}
      <pointLight
        position={[0, 2, 0]}
        color="#FFD700"
        intensity={0.3}
        distance={8}
      />
    </group>
  );
};

export default LibraryRoom;
