"use client";

import { useCallback, useRef } from "react";
import * as THREE from "three";

interface CameraAnimationState {
  isAnimating: boolean;
  targetPosition: THREE.Vector3 | null;
  targetLookAt: THREE.Vector3 | null;
  startTime: number | null;
  duration: number;
}

export function useCameraControls() {
  const animationStateRef = useRef<CameraAnimationState>({
    isAnimating: false,
    targetPosition: null,
    targetLookAt: null,
    startTime: null,
    duration: 2000,
  });

  // Convert altitude/azimuth to 3D position
  const altAzToVector = useCallback((altDeg: number, azDeg: number, radius: number) => {
    const alt = (altDeg * Math.PI) / 180;
    const az = (azDeg * Math.PI) / 180;
    const x = Math.cos(alt) * Math.sin(az) * radius;
    const y = Math.sin(alt) * radius;
    const z = -Math.cos(alt) * Math.cos(az) * radius; // North at -Z
    return new THREE.Vector3(x, y, z);
  }, []);

  const pointToPlanet = useCallback((planetId: string, altitude: number, azimuth: number) => {
    const SKY_RADIUS = 200;
    
    // Calculate planet position on sky sphere
    const planetPosition = altAzToVector(altitude, azimuth, SKY_RADIUS - 2);
    
    // Calculate camera position (closer to planet for better view)
    const cameraDistance = 8; // Distance from planet
    const cameraPosition = planetPosition.clone().normalize().multiplyScalar(cameraDistance);
    
    // Update animation state
    animationStateRef.current = {
      isAnimating: true,
      targetPosition: cameraPosition,
      targetLookAt: planetPosition,
      startTime: Date.now(),
      duration: 2000,
    };

    return {
      planetPosition,
      cameraPosition,
      animationState: animationStateRef.current,
    };
  }, [altAzToVector]);

  const getAnimationState = useCallback(() => {
    return animationStateRef.current;
  }, []);

  const setAnimationComplete = useCallback(() => {
    animationStateRef.current.isAnimating = false;
  }, []);

  return {
    pointToPlanet,
    getAnimationState,
    setAnimationComplete,
    altAzToVector,
  };
}



