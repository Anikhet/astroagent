'use client';

import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Billboard, Sky as DreiSky } from '@react-three/drei';
import { useEffect, useMemo, useState, useRef, memo, useCallback } from 'react';
import * as THREE from 'three';
import { useCamera } from '../contexts/CameraContext';
import { TextureLoader, RepeatWrapping, SRGBColorSpace } from 'three';

interface SkyViewerProps {
  date: Date;
  latitude: number;
  longitude: number;
}

interface BodyData {
  id: string;
  name: string;
  az: number;
  alt: number;
}

interface SkyResponse {
  bodies: BodyData[];
  observer?: {
    datetime: string;
  };
}

const SKY_RADIUS = 200;
const CACHE_INTERVAL_HOURS = 1; // Cache positions at 1-hour intervals
const BATCH_SIZE = 20; // Fetch 20 requests at a time

// Helper function to normalize azimuth to 0-360
function normalizeAzimuth(az: number): number {
  let normalized = az % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

// Interpolate between two azimuth values (handles wrapping)
function interpolateAzimuth(az1: number, az2: number, t: number): number {
  const norm1 = normalizeAzimuth(az1);
  const norm2 = normalizeAzimuth(az2);
  
  // Find shortest path (could be clockwise or counter-clockwise)
  let diff = norm2 - norm1;
  if (Math.abs(diff) > 180) {
    // Take the shorter path around the circle
    if (diff > 0) {
      diff -= 360;
    } else {
      diff += 360;
    }
  }
  
  return normalizeAzimuth(norm1 + diff * t);
}

// Interpolate between two body positions
function interpolateBodies(before: BodyData[], after: BodyData[], t: number): BodyData[] {
  const bodyMap = new Map<string, { before: BodyData | null; after: BodyData | null }>();
  
  // Index bodies by id
  before.forEach(body => {
    if (!bodyMap.has(body.id)) {
      bodyMap.set(body.id, { before: null, after: null });
    }
    bodyMap.get(body.id)!.before = body;
  });
  
  after.forEach(body => {
    if (!bodyMap.has(body.id)) {
      bodyMap.set(body.id, { before: null, after: null });
    }
    bodyMap.get(body.id)!.after = body;
  });
  
  // Interpolate each body
  const interpolated: BodyData[] = [];
  bodyMap.forEach(({ before: beforeBody, after: afterBody }, id) => {
    if (beforeBody && afterBody) {
      interpolated.push({
        id,
        name: beforeBody.name,
        az: interpolateAzimuth(beforeBody.az, afterBody.az, t),
        alt: beforeBody.alt + (afterBody.alt - beforeBody.alt) * t,
      });
    } else if (beforeBody) {
      interpolated.push(beforeBody);
    } else if (afterBody) {
      interpolated.push(afterBody);
    }
  });
  
  return interpolated;
}

function altAzToVector(altDeg: number, azDeg: number, radius: number) {
  const alt = (altDeg * Math.PI) / 180;
  const az = (azDeg * Math.PI) / 180;
  const x = Math.cos(alt) * Math.sin(az) * radius;
  const y = Math.sin(alt) * radius;
  const z = -Math.cos(alt) * Math.cos(az) * radius;
  return new THREE.Vector3(x, y, z);
}

// Simple camera controller - just rotates to look at target
function CameraController({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  const { camera } = useThree();
  const { highlightedPlanet, highlightedPosition, saveCameraState, getSavedCameraState } = useCamera();

  const animationRef = useRef<{
    startQuaternion: THREE.Quaternion;
    targetQuaternion: THREE.Quaternion;
    startTime: number;
    duration: number;
  } | null>(null);
  const focusTargetRef = useRef<THREE.Vector3 | null>(null);

  const hasRestoredRef = useRef(false);

  // Restore camera state on mount
  useEffect(() => {
    console.log('[CameraController] Component MOUNTED');

    if (!hasRestoredRef.current) {
      const savedState = getSavedCameraState();
      if (savedState) {
        console.log('[CameraController] Restoring camera state:', savedState);
        camera.position.fromArray(savedState.position);
        camera.quaternion.fromArray(savedState.quaternion);
        camera.rotation.fromArray(savedState.rotation);
        if (savedState.target) {
          const savedTarget = new THREE.Vector3().fromArray(savedState.target);
          focusTargetRef.current = savedTarget.clone();
          if (controlsRef.current?.target) {
            controlsRef.current.target.copy(savedTarget);
            controlsRef.current.update?.();
          }
        }
        hasRestoredRef.current = true;
      } else {
        console.log('[CameraController] No saved state to restore');
      }
    }

    return () => {
      console.log('[CameraController] Component UNMOUNTING - saving camera state');
      const fallbackTarget = controlsRef.current?.target ?? focusTargetRef.current ?? null;
      saveCameraState(camera, fallbackTarget);
    };
  }, []);

  // Start animation when planet is highlighted
  useEffect(() => {
    console.log('[CameraController] Animation useEffect triggered');
    console.log('[CameraController] highlightedPlanet:', highlightedPlanet);
    console.log('[CameraController] highlightedPosition:', highlightedPosition?.toArray());

    if (highlightedPlanet && highlightedPosition) {
      console.log(`[CameraController] Starting animation to ${highlightedPlanet}`);
      console.log('[CameraController] Target position:', highlightedPosition.toArray());
      console.log('[CameraController] Current camera position:', camera.position.toArray());
      console.log('[CameraController] Current camera rotation:', camera.rotation.toArray());
      console.log('[CameraController] Current animation ref:', animationRef.current ? 'ACTIVE' : 'NULL');

      focusTargetRef.current = highlightedPosition.clone();

      // Disable OrbitControls during animation to prevent it from interfering
      if (controlsRef.current) {
        console.log('[CameraController] Disabling OrbitControls for animation');
        controlsRef.current.enabled = false;
      }

      // Calculate target rotation
      const tempCamera = new THREE.PerspectiveCamera();
      tempCamera.position.copy(camera.position);
      tempCamera.up.copy(camera.up);
      tempCamera.lookAt(highlightedPosition);

      animationRef.current = {
        startQuaternion: camera.quaternion.clone(),
        targetQuaternion: tempCamera.quaternion.clone(),
        startTime: Date.now(),
        duration: 2000,
      };

      console.log('[CameraController] Animation initialized, duration: 2000ms');
    } else if (!highlightedPlanet && !highlightedPosition) {
      console.log('[CameraController] Highlight cleared - planet and position are null');
    }
  }, [highlightedPlanet, highlightedPosition]);

  // Animate every frame
  useFrame(() => {
    const anim = animationRef.current;
    if (!anim) return;

    const elapsed = Date.now() - anim.startTime;
    const progress = Math.min(elapsed / anim.duration, 1);

    if (progress < 1) {
      // Interpolate rotation
      const newQuaternion = anim.startQuaternion.clone().slerp(anim.targetQuaternion, progress);
      camera.quaternion.copy(newQuaternion);
    } else {
      // Animation done
      console.log('[CameraController] Animation complete');
      console.log('[CameraController] Final camera rotation:', camera.rotation.toArray());
      camera.quaternion.copy(anim.targetQuaternion);

      // Save camera state after animation completes
      const currentTarget = controlsRef.current?.target ?? null;
      let finalTarget = currentTarget;

      if (focusTargetRef.current) {
        const focusDirection = focusTargetRef.current.clone().sub(camera.position);
        if (focusDirection.lengthSq() > 0.0001) {
          focusDirection.normalize();
          const baseDistance =
            currentTarget ? camera.position.distanceTo(currentTarget) : camera.position.length() || 20;
          const safeDistance = Math.max(baseDistance, 5);
          finalTarget = camera.position.clone().add(focusDirection.multiplyScalar(safeDistance));
        }
      }

      if (finalTarget) {
        if (controlsRef.current?.target) {
          controlsRef.current.target.copy(finalTarget);
          controlsRef.current.update?.();
        }
        focusTargetRef.current = finalTarget.clone();
      } else if (currentTarget) {
        focusTargetRef.current = currentTarget.clone();
      }

      saveCameraState(camera, finalTarget);

      // Re-enable OrbitControls now that animation is complete
      if (controlsRef.current) {
        console.log('[CameraController] Re-enabling OrbitControls');
        controlsRef.current.enabled = true;
      }

      animationRef.current = null;
    }
  });

  return null;
}

// OrbitControls with camera state saving
function OrbitControlsWithState({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  const { camera } = useThree();
  const { saveCameraState } = useCamera();

  const handleChange = useCallback(() => {
    if (controlsRef.current?.enabled) {
      console.log('[OrbitControls] Camera changed by user interaction');
      const target = controlsRef.current?.target ?? null;
      saveCameraState(camera, target);
    }
  }, [camera, saveCameraState, controlsRef]);

  return (
    <OrbitControls
      ref={controlsRef}
      minPolarAngle={0.001}
      maxPolarAngle={Math.PI - 0.001}
      target={[0, 0, 0]}
      rotateSpeed={0.8}
      zoomSpeed={0.8}
      minDistance={5}
      maxDistance={50}
      onChange={handleChange}
    />
  );
}

function GroundPlane() {
  // Load textures using useLoader for proper caching and React integration
  const [alphaTexture, colorTexture, normalTexture, armTexture, displacementTexture] = useLoader(TextureLoader, [
    '/alpha.webp',
    '/coast_sand_rocks_02_1k/coast_sand_rocks_02_diff_1k.webp',
    '/coast_sand_rocks_02_1k/coast_sand_rocks_02_nor_gl_1k.webp',
    '/coast_sand_rocks_02_1k/coast_sand_rocks_02_arm_1k.webp',
    '/coast_sand_rocks_02_1k/coast_sand_rocks_02_disp_1k.webp'
  ]);

  // Configure textures
  const configureTexture = (texture: THREE.Texture, isColorMap = false) => {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(50, 50); // Tile 50x50 times for the large plane
    if (isColorMap) {
      texture.colorSpace = SRGBColorSpace;
    }
  };

  configureTexture(colorTexture, true); // Color map needs sRGB
  configureTexture(normalTexture);
  configureTexture(armTexture);
  configureTexture(alphaTexture);
  configureTexture(displacementTexture);

  // Create geometry with uv2 for aoMap
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1000, 1000, 200, 200); // Add 200x200 segments for displacement
    // Copy uv to uv2 for aoMap support
    geo.setAttribute('uv2', geo.attributes.uv.clone());
    return geo;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -10, 0]} geometry={geometry}>
      <meshStandardMaterial 
        map={colorTexture}

        aoMap={armTexture}
        aoMapIntensity={1.0}
        roughnessMap={armTexture}
        metalnessMap={armTexture}
        normalMap={normalTexture}
        displacementMap={displacementTexture}
        displacementScale={2.5}
     
      />
    </mesh>
  );
}

function Compass() {
  const directions = [
    { label: 'N', angle: 0, color: '#22c55e' },
    { label: 'E', angle: 90, color: '#ffffff' },
    { label: 'S', angle: 180, color: '#ffffff' },
    { label: 'W', angle: 270, color: '#ffffff' },
  ];

  return (
    <group position={[0, -8, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8, 8.5, 64]} />
        <meshBasicMaterial color="#1a1a1a" transparent opacity={0.8} />
      </mesh>

      {directions.map((dir) => {
        const angle = (dir.angle * Math.PI) / 180;
        const x = Math.sin(angle) * 8.2;
        const z = -Math.cos(angle) * 8.2;

        return (
          <group key={dir.label} position={[x, 0, z]}>
            <Billboard>
              <Text fontSize={1.0} color={dir.color} fontWeight="bold">
                {dir.label}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

function BodyMarker({ id, name, position }: { id: string; name: string; position: THREE.Vector3 }) {
  const color = useMemo(() => {
    const colors: Record<string, string> = {
      sun: '#ffd166',
      moon: '#cfcfcf',
      mercury: '#b8b8b8',
      venus: '#e5d4b3',
      mars: '#ff6b6b',
      jupiter: '#f4a261',
      saturn: '#e9c46a',
      uranus: '#79c7d3',
      neptune: '#5aa0ff',
    };
    return colors[id] || '#ffffff';
  }, [id]);

  return (
    <group position={position.toArray()}>
      <mesh>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {id === 'saturn' && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.0, 3.8, 32]} />
          <meshBasicMaterial color="#d4af37" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}

      <Billboard position={[0, 4, 0]}>
        <Text fontSize={6} color="#0d2c1b">
          {name}
        </Text>
      </Billboard>
    </group>
  );
}

export default function SkyViewer({ date, latitude, longitude }: SkyViewerProps) {
  const [bodies, setBodies] = useState<BodyData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);
  const controlsRef = useRef<any>(null);
  
  // Cache for planet positions: Map<timestamp ISO string, SkyResponse>
  const positionCacheRef = useRef<Map<string, SkyResponse>>(new Map());
  const cacheLocationRef = useRef<{ lat: number; lon: number } | null>(null);

  // Helper: Round timestamp to nearest cache interval
  const roundToCacheInterval = (timestamp: Date): Date => {
    const rounded = new Date(timestamp);
    rounded.setMinutes(0, 0, 0);
    return rounded;
  };

  // Helper: Get cache key for a timestamp
  const getCacheKey = (timestamp: Date): string => {
    return roundToCacheInterval(timestamp).toISOString();
  };

  // Helper: Get nearest cache keys (before and after)
  const getNearestCacheKeys = (timestamp: Date): { before: string | null; after: string | null } => {
    const cache = positionCacheRef.current;
    if (cache.size === 0) return { before: null, after: null };

    const targetTime = timestamp.getTime(); // Use actual timestamp for accurate nearest keys
    
    let before: string | null = null;
    let after: string | null = null;
    let beforeTime = -Infinity;
    let afterTime = Infinity;

    cache.forEach((_, key) => {
      const keyTime = new Date(key).getTime();
      if (keyTime <= targetTime && keyTime > beforeTime) {
        before = key;
        beforeTime = keyTime;
      }
      if (keyTime >= targetTime && keyTime < afterTime) {
        after = key;
        afterTime = keyTime;
      }
    });

    return { before, after };
  };

  // Helper: Fetch a single timestamp and cache it
  const fetchAndCache = async (timestamp: Date, lat: number, lon: number): Promise<SkyResponse | null> => {
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        elev: '0',
        refraction: 'true',
        datetime: timestamp.toISOString(),
      });

      const res = await fetch(`http://localhost:8000/api/sky?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: SkyResponse = await res.json();
      const cacheKey = getCacheKey(timestamp);
      positionCacheRef.current.set(cacheKey, json);
      return json;
    } catch (e: any) {
      console.error(`Failed to fetch ${timestamp.toISOString()}:`, e);
      return null;
    }
  };

  // Helper: Get interpolated or cached bodies for a timestamp
  const getBodiesForTimestamp = (timestamp: Date): BodyData[] | null => {
    const cache = positionCacheRef.current;
    const cacheKey = getCacheKey(timestamp);
    
    // Exact cache hit (at cache interval boundary)
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!.bodies;
    }

    // Try interpolation
    const { before, after } = getNearestCacheKeys(timestamp);
    if (before && after) {
      const beforeTime = new Date(before).getTime();
      const afterTime = new Date(after).getTime();
      const targetTime = timestamp.getTime(); // Use actual timestamp for smooth interpolation
      
      if (beforeTime !== afterTime) {
        const t = (targetTime - beforeTime) / (afterTime - beforeTime);
        const beforeBodies = cache.get(before)!.bodies;
        const afterBodies = cache.get(after)!.bodies;
        return interpolateBodies(beforeBodies, afterBodies, t);
      }
    }

    // Single cache hit (before or after)
    if (before) return cache.get(before)!.bodies;
    if (after) return cache.get(after)!.bodies;

    return null;
  };

  // Track component mounting
  useEffect(() => {
    console.log('[SkyViewer] Component MOUNTED');
    return () => {
      console.log('[SkyViewer] Component UNMOUNTING');
    };
  }, []);

  // Track prop changes
  useEffect(() => {
    console.log('[SkyViewer] Props changed:', { date: date.toISOString(), latitude, longitude });
  }, [date, latitude, longitude]);

  // Clear cache when location changes
  useEffect(() => {
    const currentLocation = { lat: latitude, lon: longitude };
    const cachedLocation = cacheLocationRef.current;
    
    if (!cachedLocation || cachedLocation.lat !== latitude || cachedLocation.lon !== longitude) {
      console.log('[SkyViewer] Location changed, clearing cache');
      positionCacheRef.current.clear();
      cacheLocationRef.current = currentLocation;
    }
  }, [latitude, longitude]);

  // Pre-fetch positions for the 4-day range (2 days back, 2 days forward)
  useEffect(() => {
    let cancelled = false;
    const cache = positionCacheRef.current;
    
    // Generate timestamps for 4 days at 1-hour intervals (2 days back, 2 days forward)
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 2);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 2);
    endDate.setHours(23, 0, 0, 0);
    
    const timestamps: Date[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setHours(d.getHours() + CACHE_INTERVAL_HOURS)) {
      timestamps.push(new Date(d));
    }
    
    // Filter out timestamps that are already cached
    const toFetch = timestamps.filter(ts => {
      const key = getCacheKey(ts);
      return !cache.has(key);
    });
    
    if (toFetch.length === 0) {
      console.log('[SkyViewer] Cache already populated');
      return;
    }
    
    console.log(`[SkyViewer] Pre-fetching ${toFetch.length} positions...`);
    setCacheLoading(true);
    
    // Fetch in batches to avoid overwhelming the server
    const fetchBatch = async (batch: Date[]) => {
      const promises = batch.map(ts => fetchAndCache(ts, latitude, longitude));
      await Promise.all(promises);
    };
    
    const preFetchAll = async () => {
      for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
        if (cancelled) break;
        const batch = toFetch.slice(i, i + BATCH_SIZE);
        await fetchBatch(batch);
        // Small delay between batches to be nice to the server
        if (i + BATCH_SIZE < toFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (!cancelled) {
        console.log(`[SkyViewer] Cache populated with ${cache.size} positions`);
        setCacheLoading(false);
      }
    };
    
    preFetchAll();
    
    return () => {
      cancelled = true;
      setCacheLoading(false);
    };
  }, [latitude, longitude]);

  // Main data fetching and interpolation logic
  useEffect(() => {
    let cancelled = false;

    const updateBodies = async () => {
      // Try to get from cache/interpolation first
      const cachedBodies = getBodiesForTimestamp(date);
      
      if (cachedBodies) {
        if (!cancelled) {
          setBodies(cachedBodies);
        }
        return;
      }

      // Cache miss - fetch and cache
      const fetched = await fetchAndCache(date, latitude, longitude);
      if (!cancelled && fetched) {
        setBodies(fetched.bodies);
      } else if (!cancelled) {
        setError('Failed to fetch sky data');
      }
    };

    updateBodies();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, date]);

  const sun = useMemo(() => bodies.find(b => b.id === 'sun'), [bodies]);
  const isDay = (sun?.alt ?? -90) > 0;
  const sunDir = useMemo(() =>
    sun ? altAzToVector(sun.alt, sun.az, 500) : new THREE.Vector3(200, 300, 200),
    [sun]
  );

  const markers = useMemo(() => {
    return bodies
      .filter(b => Number.isFinite(b.alt) && Number.isFinite(b.az) && b.alt > -10 && b.id !== 'neptune')
      .map(b => ({ ...b, position: altAzToVector(b.alt, b.az, SKY_RADIUS - 2) }));
  }, [bodies]);

  // Memoize camera configuration to prevent unnecessary re-renders
  const cameraConfig = useMemo(() => ({
    position: [0, 1.7, 20] as [number, number, number],
    fov: 75
  }), []);

  return (
    <div className="w-full h-screen bg-black">
      <Canvas camera={cameraConfig}>
        <ambientLight intensity={isDay ? 0.9 : 0.7} />
        <hemisphereLight
          color={isDay ? '#d6f0ff' : '#8fd0a3'}
          groundColor={isDay ? '#8ac28f' : '#0b1410'}
          intensity={isDay ? 1.0 : 0.5}
        />
        <directionalLight
          position={[sunDir.x, sunDir.y, sunDir.z]}
          intensity={isDay ? 1.6 : 0.4}
          color={isDay ? '#fff6d5' : '#8fd0a3'}
        />

        <fog attach="fog" args={[isDay ? '#a8d3f0' : '#03120a', 120, 800]} />

        <GroundPlane />
        <Compass />

        <DreiSky
          distance={1000}
          sunPosition={[sunDir.x, sunDir.y, sunDir.z]}
          turbidity={5}
          rayleigh={2}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
          inclination={0.49}
          azimuth={0.25}
        />

        {!isDay && (
          <Stars radius={600} depth={80} count={4000} factor={3} saturation={0} fade speed={0} />
        )}

        {markers.map(m => (
          <BodyMarker key={m.id} id={m.id} name={m.name} position={m.position} />
        ))}

        <CameraController controlsRef={controlsRef} />

        <OrbitControlsWithState controlsRef={controlsRef} />
      </Canvas>

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-yellow-900/60 text-yellow-100 px-3 py-2 rounded">
          {error}
        </div>
      )}
      
      {cacheLoading && (
        <div className="absolute top-4 right-4 z-10 bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
            <span className="text-sm">Loading planet positions...</span>
          </div>
        </div>
      )}
    </div>
  );
}
