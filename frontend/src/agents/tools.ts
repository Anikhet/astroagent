import { tool } from '@openai/agents/realtime';
import { z } from 'zod';
import { PlanetPosition, ObservationPlan, VisibleObjects, FutureWindows } from '../types/chat';

const BACKEND_BASE_URL = 'http://localhost:8000';

// Tool implementations using OpenAI Agents SDK tool function
export const getPlanetPositionTool = tool({
  name: 'get_planet_position',
  description: 'Get the current altitude and azimuth of a celestial body (e.g., planet, moon, sun) from a given location and time.',
  parameters: z.object({
    planet: z.string().describe('The name of the celestial body (e.g., "mars", "jupiter", "moon", "sun").'),
  }),
  execute: async ({ planet }, context) => {
    try {
      // Get context values (latitude, longitude, datetime)
      const lat = (context as any)?.latitude || 37.7749; // Default to San Francisco
      const lon = (context as any)?.longitude || -122.4194;
      const datetime = (context as any)?.datetime || new Date().toISOString();
      
      const response = await fetch(
        `${BACKEND_BASE_URL}/api/sky?lat=${lat}&lon=${lon}&datetime=${datetime}&refraction=true`
      );
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      const planetData = data.bodies.find((body: any) => body.id === planet.toLowerCase());
      
      if (!planetData) {
        return {
          planet: planet,
          altitude: 0,
          azimuth: 0,
          visible: false,
          error: `Planet ${planet} not found in ephemeris data`
        };
      }
      
      const result: PlanetPosition = {
        planet: planetData.name,
        altitude: planetData.alt,
        azimuth: planetData.az,
        visible: planetData.alt > 0,
        distanceKm: planetData.distanceKm
      };
      
      return result;
      
    } catch (error) {
      console.error('Error fetching planet position:', error);
      return {
        planet: planet,
        altitude: 0,
        azimuth: 0,
        visible: false,
        error: `Failed to fetch position: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
});

export const getObservationPlanTool = tool({
  name: 'get_observation_plan',
  description: 'Get an observation plan and recommendation for a specific celestial body from a given location and time, considering factors like altitude, sun position, moon interference, and cloud cover.',
  parameters: z.object({
    target: z.string().describe('The name of the celestial body to plan observations for (e.g., "saturn", "mars").'),
  }),
  execute: async ({ target }, context) => {
    try {
      // Get context values
      const lat = (context as any)?.latitude || 37.7749;
      const lon = (context as any)?.longitude || -122.4194;
      const datetime = (context as any)?.datetime || new Date().toISOString();
      
      const response = await fetch(
        `${BACKEND_BASE_URL}/api/plan?lat=${lat}&lon=${lon}&datetime=${datetime}&target=${target}&refraction=true`
      );
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      const result: ObservationPlan = {
        target: data.target,
        recommendation: data.recommendation,
        metrics: data.metrics
      };
      
      return result;
      
    } catch (error) {
      console.error('Error fetching observation plan:', error);
      return {
        target: target,
        recommendation: {
          ok: false,
          score: 0,
          criteria: {
            alt: 0,
            sun: 0,
            moon: 0,
            clouds: 0
          }
        },
        metrics: {
          targetAltitudeDeg: 0,
          sunAltitudeDeg: 0,
          moonTargetSeparationDeg: 0,
          cloudCoverPct: 0
        },
        error: `Failed to fetch plan: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
});

export const getAllVisibleObjectsTool = tool({
  name: 'get_all_visible_objects',
  description: 'Get a list of all celestial bodies (planets, moon, sun) and their positions (altitude, azimuth) from a given location and time.',
  parameters: z.object({}),
  execute: async (args, context) => {
    try {
      // Get context values
      const lat = (context as any)?.latitude || 37.7749;
      const lon = (context as any)?.longitude || -122.4194;
      const datetime = (context as any)?.datetime || new Date().toISOString();
      
      const response = await fetch(
        `${BACKEND_BASE_URL}/api/sky?lat=${lat}&lon=${lon}&datetime=${datetime}&refraction=true`
      );
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      const visibleObjects = data.bodies
        .filter((body: any) => body.alt > 0) // Only objects above horizon
        .map((body: any) => ({
          name: body.name,
          altitude: body.alt,
          azimuth: body.az,
          visible: true
        }))
        .sort((a: any, b: any) => b.altitude - a.altitude); // Sort by altitude (highest first)
      
      const result: VisibleObjects = {
        objects: visibleObjects
      };
      
      return result;
      
    } catch (error) {
      console.error('Error fetching visible objects:', error);
      return {
        objects: [],
        error: `Failed to fetch visible objects: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
});

export const pointToPlanetTool = tool({
  name: 'point_to_planet',
  description: 'Point the 3D camera toward a specific planet to help the user locate it in the sky',
  parameters: z.object({
    planet_name: z.string().describe('Name of the planet to point to (e.g., "saturn", "mars")')
  }),
  execute: async ({ planet_name }, context) => {
    try {
      // Get context values
      const lat = (context as any)?.latitude || 37.7749;
      const lon = (context as any)?.longitude || -122.4194;
      const datetime = (context as any)?.datetime || new Date().toISOString();
      
      const response = await fetch(
        `${BACKEND_BASE_URL}/api/sky?lat=${lat}&lon=${lon}&datetime=${datetime}&refraction=true`
      );
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      const planetData = data.bodies.find((body: any) => body.id === planet_name.toLowerCase());
      
      if (!planetData) {
        return {
          success: false,
          message: `Planet ${planet_name} not found in ephemeris data`,
          error: `Planet ${planet_name} not found`
        };
      }
      
      return {
        success: true,
        message: `Pointing camera toward ${planetData.name}`,
        planet: planetData.name,
        altitude: planetData.alt,
        azimuth: planetData.az,
        visible: planetData.alt > 0,
        visibility_note: planetData.alt > 0 
          ? `${planetData.name} is above the horizon and visible` 
          : `${planetData.name} is ${Math.abs(planetData.alt).toFixed(1)}° below the horizon and NOT visible`
      };
      
    } catch (error) {
      console.error('Error pointing to planet:', error);
      return {
        success: false,
        message: `Failed to point camera to ${planet_name}`,
        error: `Failed to fetch position: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

export const getFutureWindowsTool = tool({
  name: 'get_future_windows',
  description: 'Get future optimal viewing windows for a celestial object when current conditions are poor. Use this when a target has low visibility score (< 0.6) to suggest better viewing times.',
  parameters: z.object({
    target: z.string().describe('The name of the celestial body to find future viewing windows for (e.g., "saturn", "mars").'),
    days_ahead: z.number().nullable().optional().describe('Number of days to search ahead (default 60, max 365).'),
    max_windows: z.number().nullable().optional().describe('Maximum number of windows to return (default 3, max 10).'),
  }),
  execute: async ({ target, days_ahead = 60, max_windows = 3 }, context) => {
    try {
      // Get context values
      const lat = (context as any)?.latitude || 37.7749;
      const lon = (context as any)?.longitude || -122.4194;
      const datetime = (context as any)?.datetime || new Date().toISOString();
      
      const response = await fetch(
        `${BACKEND_BASE_URL}/api/future-windows?lat=${lat}&lon=${lon}&datetime=${datetime}&target=${target}&days_ahead=${days_ahead}&max_windows=${max_windows}&refraction=true`
      );
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      const result: FutureWindows = {
        target: data.target,
        searchPeriod: data.searchPeriod,
        windows: data.windows,
        totalFound: data.totalFound,
        returned: data.returned
      };
      
      return result;
      
    } catch (error) {
      console.error('Error fetching future windows:', error);
      return {
        target: target,
        searchPeriod: {
          startDate: new Date().toISOString(),
          daysAhead: days_ahead || 60
        },
        windows: [],
        totalFound: 0,
        returned: 0,
        error: `Failed to fetch future windows: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
});

// Export all tools as an array for the agent
export const astronomyTools = [
  getPlanetPositionTool,
  getObservationPlanTool,
  getAllVisibleObjectsTool,
  pointToPlanetTool,
  getFutureWindowsTool
];
