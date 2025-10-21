"use client";

import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";

interface PlanetHighlightProps {
  planetId: string;
  position: THREE.Vector3;
}

export function PlanetHighlight({ planetId, position }: PlanetHighlightProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTimeRef = useRef(Date.now());

  useFrame(() => {
    if (meshRef.current && materialRef.current) {
      const elapsed = Date.now() - startTimeRef.current;
      
      // Pulse animation: 800ms per cycle, repeat 3 times
      const cycleDuration = 800;
      const cycleProgress = (elapsed % cycleDuration) / cycleDuration;
      
      // Scale animation: 1.0 to 1.3x
      const scale = 1.0 + 0.3 * Math.sin(cycleProgress * Math.PI * 2);
      meshRef.current.scale.setScalar(scale);
      
      // Opacity animation: fade in/out
      const opacity = 0.6 + 0.2 * Math.sin(cycleProgress * Math.PI * 2);
      materialRef.current.opacity = opacity;
    }
  });

  return (
    <Billboard position={position}>
      <mesh ref={meshRef}>
        <ringGeometry args={[1.5, 2.0, 32]} />
        <meshBasicMaterial 
          ref={materialRef}
          color="#4ade80" 
          transparent 
          opacity={0.6}
        />
      </mesh>
    </Billboard>
  );
}
