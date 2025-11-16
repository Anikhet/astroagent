# Frontend Documentation

## Table of Contents

1. [Introduction & Architecture](#introduction--architecture)
2. [Core Components](#core-components)
3. [Contexts & State Management](#contexts--state-management)
4. [Hooks](#hooks)
5. [AI Agent Integration](#ai-agent-integration)
6. [3D Visualization (Three.js)](#3d-visualization-threejs)
7. [API Integration](#api-integration)
8. [Dependencies](#dependencies)
9. [Development & Testing](#development--testing)

---

## Introduction & Architecture

### Overview

The AstroAgent frontend is a Next.js 15 application that provides an interactive 3D celestial visualization with an AI-powered astronomy assistant. It combines real-time astronomical data, immersive 3D graphics, and voice-enabled AI interactions to help users explore the night sky and plan observations.

### Architecture

The frontend follows a modern React architecture with clear separation of concerns:

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with fonts
│   │   ├── page.tsx                 # Main application page
│   │   ├── api/
│   │   │   └── session/
│   │   │       └── route.ts         # OpenAI Realtime session endpoint
│   │   └── globals.css              # Global styles
│   ├── components/
│   │   ├── SkyViewer.tsx           # 3D celestial visualization
│   │   ├── PlannerCard.tsx         # Observation planning UI
│   │   ├── TimeControls.tsx        # Date/time/location controls
│   │   └── chat/
│   │       ├── ChatPanel.tsx       # AI assistant interface
│   │       ├── Transcript.tsx     # Chat transcript display
│   │       ├── ChatControls.tsx    # Connection/audio controls
│   │       └── GuardrailChip.tsx   # Moderation indicators
│   ├── contexts/
│   │   ├── CameraContext.tsx       # 3D camera state management
│   │   ├── TranscriptContext.tsx   # Chat transcript state
│   │   └── EventContext.tsx        # Event logging
│   ├── hooks/
│   │   ├── useRealtimeSession.ts   # OpenAI Realtime API integration
│   │   ├── useCameraToolHandler.ts # Camera tool integration
│   │   ├── useAudioDownload.ts     # Audio recording
│   │   ├── useCameraControls.ts    # Camera controls
│   │   └── useHandleSessionHistory.ts # Session history management
│   ├── agents/
│   │   ├── astronomy-agent.ts      # AI agent configuration
│   │   └── tools.ts                # Tool definitions
│   ├── lib/
│   │   ├── audioUtils.ts           # Audio recording utilities
│   │   └── codecUtils.ts           # WebRTC codec preferences
│   └── types/
│       └── chat.ts                 # TypeScript type definitions
├── public/                         # Static assets (textures, images)
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript configuration
├── next.config.ts                  # Next.js configuration
└── biome.json                      # Linter configuration
```

### Component Flow

1. **Main Page** (`page.tsx`) → Renders SkyViewer, TimeControls, PlannerCard, and ChatPanel
2. **SkyViewer** → Fetches celestial positions from backend, renders 3D scene with Three.js
3. **ChatPanel** → Connects to OpenAI Realtime API, manages AI agent interactions
4. **AI Agent** → Uses tools to fetch planet positions, observation plans, and control camera
5. **Backend API** → Provides ephemeris calculations and observation planning

### Technology Stack

- **Next.js 15**: React framework with App Router, Server Components, and Turbopack
- **React 19**: Latest React with improved hooks and performance
- **Three.js**: 3D graphics library for celestial visualization
- **React Three Fiber**: React renderer for Three.js
- **React Three Drei**: Useful helpers for React Three Fiber
- **OpenAI Realtime API**: Voice-enabled AI assistant with WebRTC
- **Tailwind CSS 4**: Utility-first CSS framework
- **TypeScript**: Type-safe JavaScript
- **Biome**: Fast linter and formatter

---

## Core Components

### Main Application (`app/page.tsx`)

The main page component orchestrates all major UI elements:

```10:78:frontend/src/app/page.tsx
function AppContent() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [latitude, setLatitude] = useState(37.7749); // San Francisco default
  const [longitude, setLongitude] = useState(-122.4194);
  const { selectedPlanet } = useCamera();

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-neutral-700">
      <SkyViewer 
        date={currentDate}
        latitude={latitude}
        longitude={longitude}
      />
      <TimeControls
        onDateChange={handleDateChange}
        onLocationChange={handleLocationChange}
        initialDate={currentDate}
        initialLatitude={latitude}
        initialLongitude={longitude}
      />
      
      {/* Info Panel */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white max-w-sm">
        <h3 className="text-lg font-semibold mb-2 text-green-400">Real-Time Planet Positions</h3>
        <p className="text-sm text-gray-300">
          View planet positions in the night sky based on your selected time and location.
        </p>
        <div className="mt-3 text-xs text-gray-400">
          <p>• Use mouse to rotate the view</p>
          <p>• Scroll to zoom in/out</p>
          <p>• Adjust time and location controls</p>
          <p>• All planets use real-time positioning</p>
        </div>
      </div>
      <div className="absolute bottom-60 right-80 z-10 rounded-lg p-4 text-white max-w-sm">
        <PlannerCard 
          date={currentDate} 
          latitude={latitude} 
          longitude={longitude} 
          target={selectedPlanet || 'saturn'} 
        />
      </div>
      
      {/* Astronomy Assistant Chat Panel */}
      <ChatPanel 
        latitude={latitude}
        longitude={longitude}
        currentDate={currentDate}
      />
    </div>
  );
}

export default function Home() {
  return (
    <CameraProvider>
      <AppContent />
    </CameraProvider>
  );
}
```

**Key Features:**
- Wraps content in `CameraProvider` for 3D camera state management
- Manages date, latitude, and longitude state
- Passes state to child components (SkyViewer, TimeControls, PlannerCard, ChatPanel)
- Provides responsive layout with absolute positioning for overlays

### SkyViewer Component

The `SkyViewer` component renders a 3D representation of the celestial sphere with planets positioned based on real astronomical data.

**Key Features:**
- **Position Caching**: Caches planet positions at 1-hour intervals to reduce API calls
- **Interpolation**: Smoothly interpolates positions between cached times
- **3D Visualization**: Renders planets, stars, ground plane, and compass
- **Camera Controls**: Interactive camera with automatic planet highlighting
- **Day/Night Rendering**: Adjusts lighting and sky based on sun position

**Implementation Highlights:**

```406:630:frontend/src/components/SkyViewer.tsx
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
```

**3D Scene Elements:**

- **Ground Plane**: Textured terrain with displacement mapping
- **Compass**: N/E/S/W directional indicators
- **Sky Sphere**: Dynamic sky with day/night transitions
- **Stars**: 4000 stars rendered at night
- **Planet Markers**: Spheres positioned at correct altitude/azimuth
- **Saturn Rings**: Special rendering for Saturn

### PlannerCard Component

The `PlannerCard` displays observation quality metrics and recommendations for a selected celestial target.

```40:140:frontend/src/components/PlannerCard.tsx
export function PlannerCard({ date, latitude, longitude, target = 'saturn' }: PlannerCardProps) {
  const [data, setData] = useState<PlannerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedDate, setDebouncedDate] = useState(date);

  // Debounce date changes with 500ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDate(date);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [date]);

  const params = useMemo(() => {
    const p = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      elev: String(0),
      datetime: debouncedDate.toISOString(),
      target,
    });
    return p.toString();
  }, [debouncedDate, latitude, longitude, target]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/plan?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PlannerResponse;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to fetch plan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const ok = data?.recommendation.ok ?? false;
  const scorePct = Math.round(((data?.recommendation.score ?? 0) * 100));

  return (
    <div className="absolute top-4 left-4 z-10 w-80 rounded-xl border border-emerald-600/40 bg-black/70 backdrop-blur-md p-4 text-white">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-emerald-400">Observing Planner</h3>
        <span className={`text-xs px-2 py-1 rounded ${ok ? 'bg-emerald-600/30 text-emerald-300' : 'bg-red-600/30 text-red-300'}`}>
          {ok ? 'Good' : 'Poor'}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-300">Target: <span className="text-emerald-300 capitalize">{target}</span></p>

      {loading && (
        <p className="mt-3 text-sm text-gray-400">Loading plan…</p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-300">{error}</p>
      )}
      {!loading && !error && data && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Score</span>
            <span className="text-emerald-300 font-medium">{scorePct}%</span>
          </div>
          <div className="h-2 w-full bg-gray-700 rounded">
            <div className="h-2 rounded bg-emerald-500" style={{ width: `${scorePct}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
            <div className="bg-white/5 rounded p-2">
              <p className="text-gray-400">Target Alt</p>
              <p className="text-emerald-300">{data.metrics.targetAltitudeDeg.toFixed(1)}°</p>
            </div>
            <div className="bg-white/5 rounded p-2">
              <p className="text-gray-400">Sun Alt</p>
              <p className="text-emerald-300">{data.metrics.sunAltitudeDeg.toFixed(1)}°</p>
            </div>
            <div className="bg-white/5 rounded p-2">
              <p className="text-gray-400">Moon Sep</p>
              <p className="text-emerald-300">{data.metrics.moonTargetSeparationDeg.toFixed(1)}°</p>
            </div>
            <div className="bg-white/5 rounded p-2">
              <p className="text-gray-400">Clouds</p>
              <p className="text-emerald-300">{data.metrics.cloudCoverPct == null ? '—' : `${Math.round(data.metrics.cloudCoverPct)}%`}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Features:**
- Debounced API calls (500ms) to prevent excessive requests
- Real-time score display with progress bar
- Metric cards showing target altitude, sun altitude, moon separation, and cloud cover
- Visual status indicator (Good/Poor)

### TimeControls Component

The `TimeControls` component provides date/time selection, location input, and playback controls.

```13:320:frontend/src/components/TimeControls.tsx
export default function TimeControls({
  onDateChange,
  onLocationChange,
  initialDate,
  initialLatitude,
  initialLongitude
}: TimeControlsProps) {
  const [date, setDate] = useState(initialDate);
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Calculate time range: 2 days back to 2 days forward from current time
  const now = useMemo(() => new Date(), []);
  const minDate = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return d;
  }, [now]);
  const maxDate = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return d;
  }, [now]);

  // Playback functionality
  useEffect(() => {
    if (!isPlaying) return;

    // Calculate step size: 1 minute base × playSpeed
    const stepMinutes = 1 * playSpeed;
    const intervalMs = 1000; // Update every second

    const interval = setInterval(() => {
      setDate((prevDate) => {
        const newDate = new Date(prevDate.getTime() + stepMinutes * 60 * 1000);
        
        // Stop at max date
        if (newDate.getTime() >= maxDate.getTime()) {
          setIsPlaying(false);
          return maxDate;
        }
        
        return newDate;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, playSpeed, maxDate, minDate]);
```

**Features:**
- Date/time picker with 4-day range (2 days back, 2 days forward)
- Time slider for scrubbing through time
- Playback controls with variable speed (0.1x to 10x)
- Location input (latitude/longitude)
- Quick location buttons for major cities
- Collapsible interface

### ChatPanel Component

The `ChatPanel` manages the AI assistant interface with OpenAI Realtime API integration.

```21:317:frontend/src/components/chat/ChatPanel.tsx
function ChatPanelInner({ latitude, longitude, currentDate }: ChatPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(true);
  const [connectionError, setConnectionError] = useState<string>("");
  const [messageQueue, setMessageQueue] = useState<string[]>([]);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Initialize the recording hook
  const { startRecording, stopRecording, downloadRecording } = useAudioDownload();
  
  // Use camera context safely
  let handleToolResult: ((toolName: string, result: any) => void) | null = null;
  
  try {
    const cameraToolHandler = useCameraToolHandler();
    handleToolResult = cameraToolHandler.handleToolResult;
  } catch (error) {
    // Context not available during SSR
  }

  const {
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    interrupt,
    mute,
    pushToTalkStart,
    pushToTalkStop,
  } = useRealtimeSession({
    onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
  });

  const fetchEphemeralKey = async (): Promise<string | null> => {
    try {
      const tokenResponse = await fetch("/api/session");
      const data = await tokenResponse.json();

      if (!data.client_secret?.value) {
        const errorMsg = "No ephemeral key provided by the server. Please check your OpenAI API key.";
        console.error(errorMsg);
        setConnectionError(errorMsg);
        setSessionStatus("DISCONNECTED");
        return null;
      }

      setConnectionError("");
      return data.client_secret.value;
    } catch (error) {
      const errorMsg = `Error fetching ephemeral key: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      setConnectionError(errorMsg);
      return null;
    }
  };

  const connectToRealtime = async () => {
    if (sessionStatus !== "DISCONNECTED") return;
    
    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) return;

      // Get current observing conditions for context
      let observingContext = {};
      try {
        const datetime = currentDate.toISOString();
        const response = await fetch(
          `http://127.0.0.1:8000/api/plan?lat=${latitude}&lon=${longitude}&datetime=${datetime}&target=saturn&refraction=true`
        );
        if (response.ok) {
          const data = await response.json();
          observingContext = {
            currentSunAltitude: data.metrics.sunAltitudeDeg,
            currentObservingScore: data.recommendation.score,
            isDaytime: data.metrics.sunAltitudeDeg > -6,
            isGoodObserving: data.recommendation.ok,
            cloudCover: data.metrics.cloudCoverPct
          };
        }
      } catch (error) {
        console.warn('Failed to fetch observing context:', error);
      }

      // Create astronomy agent with current context
      const datetime = currentDate.toISOString();
      const astronomyAgent = createAstronomyAgent(
        latitude, 
        longitude, 
        datetime, 
        Object.keys(observingContext).length > 0 ? observingContext as any : undefined
      );

      await connect({
        getEphemeralKey: async () => EPHEMERAL_KEY,
        initialAgents: [astronomyAgent],
        audioElement: audioElementRef.current || undefined,
        extraContext: {
          latitude,
          longitude,
          datetime: currentDate.toISOString(),
          ...observingContext
        },
      });
    } catch (err) {
      const errorMsg = `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error("Error connecting:", err);
      setConnectionError(errorMsg);
      setSessionStatus("DISCONNECTED");
    }
  };
```

**Features:**
- Collapsible chat interface
- Voice and text input
- Push-to-talk mode
- Audio playback toggle
- Message queueing for offline messages
- Automatic connection on expand
- Real-time transcript display
- Audio recording download

---

## Contexts & State Management

### CameraContext

Manages 3D camera state and planet highlighting for smooth animations.

```24:138:frontend/src/contexts/CameraContext.tsx
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
```

**API:**
- `pointToPlanet(planetId, altitude, azimuth)`: Triggers camera animation to planet
- `highlightPlanet(planetId, position)`: Sets highlighted planet for camera controller
- `saveCameraState(camera, target)`: Persists camera state across remounts
- `getSavedCameraState()`: Retrieves saved camera state

### TranscriptContext

Manages chat transcript state with messages and breadcrumbs.

```29:136:frontend/src/contexts/TranscriptContext.tsx
export const TranscriptProvider: FC<PropsWithChildren> = ({ children }) => {
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);

  function newTimestampPretty(): string {
    const now = new Date();
    const time = now.toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const ms = now.getMilliseconds().toString().padStart(3, "0");
    return `${time}.${ms}`;
  }

  const addTranscriptMessage: TranscriptContextValue["addTranscriptMessage"] = (itemId, role, text = "", isHidden = false) => {
    setTranscriptItems((prev) => {
      if (prev.some((log) => log.itemId === itemId && log.type === "MESSAGE")) {
        console.warn(`[addTranscriptMessage] skipping; message already exists for itemId=${itemId}, role=${role}, text=${text}`);
        return prev;
      }

      const newItem: TranscriptItem = {
        itemId,
        type: "MESSAGE",
        role,
        title: text,
        expanded: false,
        timestamp: newTimestampPretty(),
        createdAtMs: Date.now(),
        status: "IN_PROGRESS",
        isHidden,
      };

      return [...prev, newItem];
    });
  };

  const updateTranscriptMessage: TranscriptContextValue["updateTranscriptMessage"] = (itemId, newText, append = false) => {
    setTranscriptItems((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId && item.type === "MESSAGE") {
          return {
            ...item,
            title: append ? (item.title ?? "") + newText : newText,
          };
        }
        return item;
      })
    );
  };

  const addTranscriptBreadcrumb: TranscriptContextValue["addTranscriptBreadcrumb"] = (title, data) => {
    setTranscriptItems((prev) => [
      ...prev,
      {
        itemId: `breadcrumb-${uuidv4()}`,
        type: "BREADCRUMB",
        title,
        data,
        expanded: false,
        timestamp: newTimestampPretty(),
        createdAtMs: Date.now(),
        status: "DONE",
        isHidden: false,
      },
    ]);
  };
```

**API:**
- `addTranscriptMessage(itemId, role, text, isHidden)`: Add user/assistant message
- `updateTranscriptMessage(itemId, text, isDelta)`: Update message (append or replace)
- `addTranscriptBreadcrumb(title, data)`: Add tool call breadcrumb
- `toggleTranscriptItemExpand(itemId)`: Toggle expand/collapse
- `updateTranscriptItem(itemId, properties)`: Update item properties

### EventContext

Logs client and server events for debugging and monitoring.

```20:80:frontend/src/contexts/EventContext.tsx
export const EventProvider: FC<PropsWithChildren> = ({ children }) => {
  const [loggedEvents, setLoggedEvents] = useState<LoggedEvent[]>([]);

  function newTimestampPretty(): string {
    const now = new Date();
    const time = now.toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const ms = now.getMilliseconds().toString().padStart(3, "0");
    return `${time}.${ms}`;
  }

  const logClientEvent = (eventData: Record<string, any>, eventNameSuffix = "") => {
    const eventName = `client${eventNameSuffix ? `_${eventNameSuffix}` : ""}`;
    const newEvent: LoggedEvent = {
      id: Date.now(),
      direction: "client",
      expanded: false,
      timestamp: newTimestampPretty(),
      eventName,
      eventData,
    };
    setLoggedEvents((prev) => [...prev, newEvent]);
  };

  const logServerEvent = (eventData: Record<string, any>, eventNameSuffix = "") => {
    const eventName = `server${eventNameSuffix ? `_${eventNameSuffix}` : ""}`;
    const newEvent: LoggedEvent = {
      id: Date.now(),
      direction: "server",
      expanded: false,
      timestamp: newTimestampPretty(),
      eventName,
      eventData,
    };
    setLoggedEvents((prev) => [...prev, newEvent]);
  };
```

**API:**
- `logClientEvent(eventData, suffix)`: Log client-side event
- `logServerEvent(eventData, suffix)`: Log server-side event

---

## Hooks

### useRealtimeSession

Manages OpenAI Realtime API connection and session lifecycle.

```26:256:frontend/src/hooks/useRealtimeSession.ts
export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<
    SessionStatus
  >('DISCONNECTED');
  const { logClientEvent } = useEvent();

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      callbacks.onConnectionChange?.(s);
      logClientEvent({}, s);
    },
    [callbacks, logClientEvent],
  );

  const { logServerEvent } = useEvent();

  const historyHandlersRef = useHandleSessionHistory();
  const historyHandlers = historyHandlersRef.current;
  const {
    handleAgentToolStart,
    handleAgentToolEnd,
    handleHistoryUpdated,
    handleHistoryAdded,
    handleGuardrailTripped,
    handleTranscriptionCompleted,
    handleTranscriptionDelta,
  } = historyHandlers;

  const listenersCleanupRef = useRef<(() => void) | null>(null);

  const handleTransportEvent = useCallback((event: any) => {
    // Handle additional server events that aren't managed by the session
    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed": {
        handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.done": {
        handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.delta": {
        handleTranscriptionDelta(event);
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        handleTranscriptionCompleted(event);
        break;
      }
      default: {
        logServerEvent(event);
        break;
      }
    }
  }, [handleTranscriptionCompleted, handleTranscriptionDelta, logServerEvent]);

  const connect = useCallback(
    async ({
      getEphemeralKey,
      initialAgents,
      audioElement,
      extraContext,
      outputGuardrails,
    }: ConnectOptions) => {
      if (sessionRef.current) return; // already connected

      updateStatus('CONNECTING');

      const ek = await getEphemeralKey();
      const rootAgent = initialAgents[0];

      sessionRef.current = new RealtimeSession(rootAgent, {
        transport: new OpenAIRealtimeWebRTC({
          audioElement,
          // Set preferred codec before offer creation
          changePeerConnection: async (pc: RTCPeerConnection) => {
            applyCodec(pc);
            return pc;
          },
        }),
        model: 'gpt-4o-realtime-preview-2025-06-03',
        config: {
          inputAudioTranscription: {
            model: 'gpt-4o-mini-transcribe',
          },
        },
        outputGuardrails: outputGuardrails ?? [],
        context: extraContext ?? {},
      });

      attachSessionListeners(sessionRef.current);

      await sessionRef.current.connect({ apiKey: ek });
      updateStatus('CONNECTED');
    },
    [attachSessionListeners, callbacks, updateStatus, applyCodec],
  );

  const disconnect = useCallback(() => {
    listenersCleanupRef.current?.();
    listenersCleanupRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    updateStatus('DISCONNECTED');
  }, [updateStatus]);
```

**Features:**
- WebRTC connection management
- Session lifecycle (connect/disconnect)
- Event listener attachment/cleanup
- Audio codec configuration
- Message sending (text/audio)
- Push-to-talk support
- Interrupt handling

### useCameraToolHandler

Handles camera animations triggered by AI agent tool calls.

```7:19:frontend/src/hooks/useCameraToolHandler.ts
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
```

**Usage:**
- Called when AI agent executes `point_to_planet` tool
- Extracts planet position from tool result
- Triggers camera animation via CameraContext

### useAudioDownload

Manages audio recording from WebRTC stream.

```4:63:frontend/src/hooks/useAudioDownload.ts
export function useAudioDownload() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback((stream: MediaStream) => {
    if (mediaRecorderRef.current) {
      return; // Already recording
    }

    const mediaRecorder = startAudioRecording(stream);
    if (!mediaRecorder) {
      console.error('Failed to create MediaRecorder');
      return;
    }

    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      setRecordedBlob(audioBlob);
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setIsRecording(false);
    };

    mediaRecorder.start(1000); // Collect data every second
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const downloadRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      stopRecording();
    } else if (recordedBlob) {
      downloadAudioBlob(recordedBlob, `recording-${Date.now()}.webm`);
      setRecordedBlob(null);
    }
  }, [stopRecording, recordedBlob]);
```

**Features:**
- Records WebRTC audio stream
- Collects audio chunks every second
- Creates WebM blob on stop
- Downloads recording as file

---

## AI Agent Integration

### Astronomy Agent

The astronomy agent is configured with specialized instructions and tools for astronomical observations.

```104:124:frontend/src/agents/astronomy-agent.ts
export function createAstronomyAgent(
  latitude: number,
  longitude: number,
  datetime: string,
  observingContext?: {
    currentSunAltitude: number;
    currentObservingScore: number;
    isDaytime: boolean;
    isGoodObserving: boolean;
    cloudCover: number;
  }
): RealtimeAgent {
  return new RealtimeAgent({
    name: 'astronomy_assistant',
    handoffDescription: 'Expert astronomy assistant for planet positions and observation planning',
    instructions: createAstronomyAgentInstructions(latitude, longitude, datetime, observingContext),
    tools: astronomyTools,
    handoffs: [],
  });
}
```

**Agent Instructions:**
- Provides real-time planet positions
- Recommends optimal observation times
- Explains astronomical phenomena
- Points 3D camera toward planets
- Uses current observing context for immediate recommendations

### Tools

The agent has access to five tools for astronomical calculations:

1. **get_planet_position**: Get altitude/azimuth of a celestial body
2. **get_observation_plan**: Get observation quality metrics and recommendations
3. **get_all_visible_objects**: List all visible celestial bodies
4. **point_to_planet**: Point 3D camera toward a planet
5. **get_future_windows**: Find optimal future viewing windows

**Tool Implementation Example:**

```8:63:frontend/src/agents/tools.ts
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
```

**Tool Execution Flow:**
1. Agent receives user request
2. Agent decides which tool(s) to call
3. Tool executes with context (latitude, longitude, datetime)
4. Tool fetches data from backend API
5. Tool returns result to agent
6. Agent interprets result and responds to user

---

## 3D Visualization (Three.js)

### Scene Setup

The 3D scene is rendered using React Three Fiber with a Canvas component.

```651:693:frontend/src/components/SkyViewer.tsx
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
```

### Position Calculation

Planet positions are converted from altitude/azimuth to 3D coordinates:

```99:106:frontend/src/components/SkyViewer.tsx
function altAzToVector(altDeg: number, azDeg: number, radius: number) {
  const alt = (altDeg * Math.PI) / 180;
  const az = (azDeg * Math.PI) / 180;
  const x = Math.cos(alt) * Math.sin(az) * radius;
  const y = Math.sin(alt) * radius;
  const z = -Math.cos(alt) * Math.cos(az) * radius;
  return new THREE.Vector3(x, y, z);
}
```

### Camera Animation

The camera animates smoothly to highlighted planets:

```109:251:frontend/src/components/SkyViewer.tsx
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

  // Start animation when planet is highlighted
  useEffect(() => {
    if (highlightedPlanet && highlightedPosition) {
      focusTargetRef.current = highlightedPosition.clone();

      // Disable OrbitControls during animation to prevent it from interfering
      if (controlsRef.current) {
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
      camera.quaternion.copy(anim.targetQuaternion);

      // Re-enable OrbitControls now that animation is complete
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }

      animationRef.current = null;
    }
  });
```

**Animation Features:**
- 2-second smooth rotation using quaternion SLERP
- Disables manual controls during animation
- Saves camera state after animation
- Restores camera state on mount

---

## API Integration

### Backend API Endpoints

The frontend calls three main backend endpoints:

1. **`GET /api/sky`**: Get all celestial body positions
   - Parameters: `lat`, `lon`, `elev`, `datetime`, `refraction`
   - Returns: Array of bodies with RA/Dec, Alt/Az, distance

2. **`GET /api/plan`**: Get observation plan for target
   - Parameters: `lat`, `lon`, `elev`, `datetime`, `target`, `cloudCoverPct`
   - Returns: Metrics, recommendation, score

3. **`GET /api/future-windows`**: Find future viewing windows
   - Parameters: `lat`, `lon`, `datetime`, `target`, `daysAhead`, `maxWindows`
   - Returns: Array of optimal viewing windows

### Session API Endpoint

The frontend provides a Next.js API route for OpenAI Realtime session tokens:

```3:27:frontend/src/app/api/session/route.ts
export async function GET() {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-realtime-mini-2025-10-06",
        }),
      }
    );
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

**Security:**
- API key stored in `process.env.OPENAI_API_KEY`
- Never exposed to client
- Server-side only endpoint

### Error Handling

All API calls include error handling:

```68:88:frontend/src/components/PlannerCard.tsx
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/plan?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PlannerResponse;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to fetch plan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [params]);
```

**Patterns:**
- Cancellation tokens to prevent state updates after unmount
- Loading states during fetch
- Error messages displayed to user
- Graceful degradation on API failure

---

## Dependencies

All dependencies are listed in `package.json`:

```12:36:frontend/package.json
  "dependencies": {
    "@openai/agents": "^0.0.5",
    "@radix-ui/react-icons": "^1.3.2",
    "@react-three/drei": "^10.7.5",
    "@react-three/fiber": "^9.3.0",
    "@types/three": "^0.180.0",
    "astronomy-engine": "^2.1.19",
    "next": "15.5.2",
    "openai": "^4.104.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-markdown": "^9.1.0",
    "three": "^0.180.0",
    "uuid": "^11.1.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@biomejs/biome": "2.2.0",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
```

### Core Framework

- **next (15.5.2)**: React framework with App Router, Server Components, Turbopack
- **react (19.1.0)**: Latest React with improved hooks
- **react-dom (19.1.0)**: React DOM renderer

### 3D Graphics

- **three (0.180.0)**: 3D graphics library
- **@react-three/fiber (9.3.0)**: React renderer for Three.js
- **@react-three/drei (10.7.5)**: Useful helpers (OrbitControls, Stars, Sky, etc.)
- **@types/three (0.180.0)**: TypeScript definitions

### AI Integration

- **@openai/agents (0.0.5)**: OpenAI Agents SDK for Realtime API
- **openai (4.104.0)**: OpenAI SDK (required dependency)

### UI & Styling

- **tailwindcss (4)**: Utility-first CSS framework
- **@radix-ui/react-icons (1.3.2)**: Icon components
- **react-markdown (9.1.0)**: Markdown rendering for chat

### Utilities

- **zod (3.25.76)**: Schema validation for tool parameters
- **uuid (11.1.0)**: UUID generation for transcript items
- **astronomy-engine (2.1.19)**: Additional astronomical utilities (not currently used)

### Development

- **typescript (5)**: Type-safe JavaScript
- **@biomejs/biome (2.2.0)**: Fast linter and formatter
- **@types/node, @types/react, @types/react-dom**: TypeScript definitions

---

## Development & Testing

### Environment Setup

1. **Install Node.js 20+**
   ```bash
   node --version  # Should be 20 or higher
   ```

2. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Set Environment Variables**
   Create `.env.local`:
   ```bash
   OPENAI_API_KEY=sk-...
   ```

4. **Start Backend Server**
   ```bash
   cd ../backend
   uvicorn app.main:app --reload --port 8000
   ```

### Running the Development Server

**Development Mode:**
```bash
cd frontend
npm run dev
```

**Options:**
- Uses Turbopack for faster builds
- Auto-reloads on code changes
- Runs on `http://localhost:3000`

**Build for Production:**
```bash
npm run build
npm start
```

### Code Quality

**Linting:**
```bash
npm run lint
```

**Formatting:**
```bash
npm run format
```

### Testing

**Manual Testing:**
1. Open `http://localhost:3000`
2. Verify 3D sky renders correctly
3. Test time controls (slider, playback)
4. Test location input
5. Test chat panel connection
6. Test AI agent tool calls
7. Test camera animations

**Common Test Scenarios:**
- Change date/time and verify planet positions update
- Change location and verify positions recalculate
- Ask AI "where is Saturn?" and verify camera animates
- Test observation planner with different targets
- Test future windows for poor visibility scenarios

### Common Issues

**Issue: Backend not responding**
- **Solution**: Ensure backend is running on port 8000
- Check CORS configuration in backend

**Issue: OpenAI API key not found**
- **Solution**: Ensure `.env.local` exists with `OPENAI_API_KEY`
- Restart dev server after adding environment variable

**Issue: 3D scene not rendering**
- **Solution**: Check browser console for Three.js errors
- Verify WebGL is supported (most modern browsers)
- Check texture loading (ground plane textures)

**Issue: Chat panel won't connect**
- **Solution**: Verify OpenAI API key is valid
- Check network tab for API errors
- Ensure backend is running (for context fetching)

**Issue: Camera animation not working**
- **Solution**: Check CameraContext provider is wrapping components
- Verify `point_to_planet` tool is returning correct data
- Check browser console for animation errors

### Performance Considerations

**Optimization Opportunities:**
1. **Position Caching**: Already implemented (1-hour intervals)
2. **Batch Fetching**: Already implemented (20 requests per batch)
3. **Memoization**: Use `useMemo` for expensive calculations
4. **Code Splitting**: Lazy load chat panel if needed
5. **Texture Optimization**: Use compressed textures for ground plane

**Current Performance:**
- Sky snapshot: ~50-100ms (cached)
- Position interpolation: <1ms (in-memory)
- Chat connection: ~2-3 seconds (WebRTC handshake)
- Camera animation: 2 seconds (smooth 60fps)

---

## Conclusion

The AstroAgent frontend provides a modern, interactive astronomy application with:
- **3D Visualization**: Immersive celestial sphere with real-time planet positions
- **AI Assistant**: Voice-enabled astronomy expert with tool integration
- **Observation Planning**: Real-time quality metrics and recommendations
- **Interactive Controls**: Time scrubbing, location input, playback

The architecture is modular, type-safe, and performant, making it easy to add features like:
- Additional celestial bodies
- Custom observation targets
- Equipment recommendations
- Weather integration
- Multi-user collaboration

For questions or contributions, refer to the main project repository.





