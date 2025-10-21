"use client";

import { useEffect } from "react";
import { useCamera } from "../contexts/CameraContext";

// Hook to handle camera animations from tool calls
export function useCameraToolHandler() {
  const { pointToPlanet } = useCamera();

  // Listen for tool call results and trigger camera animations
  const handleToolResult = (toolName: string, result: any) => {
    if (toolName === "point_to_planet" && result.success) {
      // Trigger camera animation
      pointToPlanet(result.planet.toLowerCase(), result.altitude, result.azimuth);
    }
  };

  return { handleToolResult };
}



