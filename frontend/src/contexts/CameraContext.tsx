"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import * as THREE from "three";

interface CameraState {
  position: [number, number, number];
  rotation: [number, number, number];
  quaternion: [number, number, number, number];
  target: [number, number, number] | null;
}

interface CameraContextValue {
  pointToPlanet: (planetId: string, altitude: number, azimuth: number) => void;
  highlightPlanet: (planetId: string, position: THREE.Vector3) => void;
  highlightedPlanet: string | null;
  highlightedPosition: THREE.Vector3 | null;
  saveCameraState: (camera: THREE.Camera, target?: THREE.Vector3 | null) => void;
  getSavedCameraState: () => CameraState | null;
}

const CameraContext = createContext<CameraContextValue | undefined>(undefined);

export const CameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [highlightedPlanet, setHighlightedPlanet] = useState<string | null>(null);
  const [highlightedPosition, setHighlightedPosition] = useState<THREE.Vector3 | null>(null);

  // Track last animation to prevent duplicate calls
  const lastAnimationRef = useRef<{ planetId: string; altitude: number; azimuth: number; timestamp: number } | null>(null);

  // Store camera state to persist across remounts
  const savedCameraStateRef = useRef<CameraState | null>(null);

  // Convert altitude/azimuth to 3D position
  const altAzToVector = useCallback((altDeg: number, azDeg: number, radius: number) => {
    const alt = (altDeg * Math.PI) / 180;
    const az = (azDeg * Math.PI) / 180;
    const x = Math.cos(alt) * Math.sin(az) * radius;
    const y = Math.sin(alt) * radius;
    const z = -Math.cos(alt) * Math.cos(az) * radius; // North at -Z
    return new THREE.Vector3(x, y, z);
  }, []);

  const highlightPlanet = useCallback((planetId: string, position: THREE.Vector3) => {
    console.log(`[CameraContext] highlightPlanet called for ${planetId}`);
    console.log(`[CameraContext] Setting highlighted position:`, position.toArray());

    setHighlightedPlanet(planetId);
    setHighlightedPosition(position);

    // Auto-remove highlight after 5 seconds
    setTimeout(() => {
      console.log(`[CameraContext] Clearing highlight for ${planetId} after 5 seconds`);
      setHighlightedPlanet(null);
      setHighlightedPosition(null);
    }, 5000);
  }, []);

  const pointToPlanet = useCallback((planetId: string, altitude: number, azimuth: number) => {
    console.log(`[CameraContext] pointToPlanet called for ${planetId.toUpperCase()}`);
    console.log(`[CameraContext] Altitude: ${altitude.toFixed(2)}°, Azimuth: ${azimuth.toFixed(2)}°`);

    // Check if planet is visible (above horizon)
    if (altitude <= 0) {
      console.log(`[CameraContext] Planet ${planetId} is below horizon, skipping animation`);
      return;
    }

    const now = Date.now();
    const lastAnimation = lastAnimationRef.current;

    // Prevent duplicate calls within 1 second with same parameters
    if (lastAnimation &&
        lastAnimation.planetId === planetId &&
        Math.abs(lastAnimation.altitude - altitude) < 0.1 &&
        Math.abs(lastAnimation.azimuth - azimuth) < 0.1 &&
        (now - lastAnimation.timestamp) < 1000) {
      console.log(`[CameraContext] Skipping duplicate animation (last call was ${now - lastAnimation.timestamp}ms ago)`);
      return;
    }

    // Update last animation tracking
    lastAnimationRef.current = { planetId, altitude, azimuth, timestamp: now };

    const SKY_RADIUS = 200; // Match SkyViewer.tsx

    // Calculate planet's actual position on sky sphere (where it's rendered)
    const planetPosition = altAzToVector(altitude, azimuth, SKY_RADIUS - 2);

    console.log(`[CameraContext] Calculated planet position on sky sphere:`, planetPosition.toArray());
    console.log(`[CameraContext] Triggering highlightPlanet for ${planetId}`);

    // Trigger camera rotation by highlighting the planet
    // The CameraController in SkyViewer will handle the smooth rotation animation
    highlightPlanet(planetId, planetPosition);
  }, [altAzToVector, highlightPlanet]);

  const saveCameraState = useCallback((camera: THREE.Camera, target?: THREE.Vector3 | null) => {
    const targetArray = target
      ? (target.toArray().slice(0, 3) as [number, number, number])
      : undefined;
    savedCameraStateRef.current = {
      position: camera.position.toArray() as [number, number, number],
      rotation: camera.rotation.toArray().slice(0, 3) as [number, number, number],
      quaternion: camera.quaternion.toArray() as [number, number, number, number],
      target: targetArray ?? savedCameraStateRef.current?.target ?? null,
    };
    console.log('[CameraContext] Camera state saved:', savedCameraStateRef.current);
  }, []);

  const getSavedCameraState = useCallback(() => {
    console.log('[CameraContext] Getting saved camera state:', savedCameraStateRef.current);
    return savedCameraStateRef.current;
  }, []);

  const value: CameraContextValue = {
    pointToPlanet,
    highlightPlanet,
    highlightedPlanet,
    highlightedPosition,
    saveCameraState,
    getSavedCameraState,
  };

  return (
    <CameraContext.Provider value={value}>
      {children}
    </CameraContext.Provider>
  );
};

export function useCamera() {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error("useCamera must be used within a CameraProvider");
  }
  return context;
}
