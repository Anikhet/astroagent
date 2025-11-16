# AstroAgent: Project Overview
## AI & System Design Perspective

---

## Executive Summary

AstroAgent is a full-stack astronomy application that combines high-precision ephemeris calculations, interactive 3D visualization, and a voice-enabled AI assistant. The system enables users to explore celestial objects in real-time, plan observations, and interact with an AI agent that can answer questions and control the 3D camera.

---

## AI Architecture & Design

### Agent Framework

**OpenAI Realtime API Integration**
- Voice-enabled AI assistant using WebRTC for real-time bidirectional audio
- Model: `gpt-realtime-mini-2025-10-06` with transcription via `gpt-4o-mini-transcribe`
- Session management through ephemeral keys (server-side `/api/session` endpoint)

**Agent Configuration**
- **Specialized Instructions**: Context-aware prompts that include:
  - User location (latitude/longitude)
  - Current datetime
  - Observing conditions (sun altitude, observing score, cloud cover)
  - Visibility rules and response guidelines
- **Dynamic Context Injection**: Agent receives real-time observing context at connection time, enabling immediate contextual responses

### Tool System

The agent has access to **5 specialized tools** for astronomical operations:

1. **`get_planet_position`**: Fetches altitude/azimuth of celestial bodies
2. **`get_observation_plan`**: Returns quality metrics and recommendations (altitude, sun position, moon interference, cloud cover)
3. **`get_all_visible_objects`**: Lists all visible celestial bodies above horizon
4. **`point_to_planet`**: Triggers 3D camera animation to locate planets
5. **`get_future_windows`**: Finds optimal future viewing windows (samples every 20 minutes over specified days)

**Tool Implementation Pattern:**
- Tools execute in frontend (client-side)
- Fetch data from backend FastAPI endpoints
- Use context (latitude, longitude, datetime) passed from agent
- Return structured data (Zod-validated) to agent
- Agent interprets results and generates natural language responses

**Example Flow:**
```
User: "Where is Saturn?"
  → Agent calls: get_planet_position("saturn") + get_observation_plan("saturn") + point_to_planet("saturn")
  → Tools fetch from backend /api/sky and /api/plan
  → Agent receives: altitude=35°, azimuth=135°, score=0.82, visible=true
  → Agent responds: "Saturn is visible at 35° altitude..."
  → Camera animates to Saturn position
```

### AI Design Decisions

1. **Context-Aware Initialization**: Agent receives current observing conditions at connection, enabling immediate contextual awareness
2. **Multi-Tool Coordination**: Agent intelligently calls multiple tools (e.g., position + plan + camera) for comprehensive responses
3. **Error Handling**: Tools return structured error objects, allowing agent to provide helpful error messages
4. **Voice-First Design**: Instructions optimized for conversational, concise responses (avoiding long lists)

---

## System Design Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Next.js Frontend (Port 3000)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  SkyViewer   │  │  ChatPanel   │  │ PlannerCard  │ │
│  │  (Three.js)  │  │ (Realtime AI) │  │  (Metrics)   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                  │          │
│         │ HTTP            │ WebRTC          │ HTTP      │
└─────────┼─────────────────┼──────────────────┼──────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────┴─────────────────┴──────────────────┴──────────┐
│         FastAPI Backend (Port 8000)                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │  /api/sky  /api/plan  /api/future-windows         │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  Ephemeris Service (Skyfield + DE440S)      │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Component Separation

**Frontend (Next.js 15 + React 19)**
- **SkyViewer**: 3D visualization using Three.js/React Three Fiber
- **ChatPanel**: OpenAI Realtime API integration, transcript management
- **PlannerCard**: Real-time observation quality metrics
- **TimeControls**: Date/time/location input with playback controls

**Backend (FastAPI + Python)**
- **Ephemeris Service**: Astronomical calculations using Skyfield library
- **DE440S Ephemeris**: JPL's high-precision planetary data (1549-2650 CE)
- **Observation Planner**: Multi-criteria scoring algorithm (altitude, sun, moon, clouds)
- **Future Windows Finder**: Time-sampling algorithm for optimal viewing windows

### Data Flow Patterns

**1. Sky Position Updates**
```
User changes time/location
  → SkyViewer checks 1-hour position cache
  → Cache hit: Interpolate between cached times
  → Cache miss: Fetch from /api/sky
  → Backend calculates using Skyfield + DE440S
  → Cache response → Update 3D scene
```

**2. AI Agent Tool Execution**
```
User query → OpenAI Realtime API
  → Agent decides tool calls
  → Tools execute in frontend
  → HTTP requests to backend
  → Structured results to agent
  → Natural language response
  → Camera animation (if applicable)
```

**3. Observation Planning**
```
Target selection → PlannerCard
  → Debounced API call (500ms)
  → /api/plan with target parameter
  → Backend calculates:
     - Target altitude, sun altitude
     - Moon separation (angular distance)
     - Cloud cover (Open-Meteo API)
     - Multi-criteria score (0-1)
  → Display metrics and recommendation
```

### Performance Optimizations

1. **Position Caching**: 1-hour interval cache with interpolation (reduces API calls by ~95%)
2. **Pre-fetching**: 4-day range (2 days back, 2 days forward) pre-loaded in batches
3. **Debouncing**: PlannerCard debounces date changes (500ms) to prevent excessive requests
4. **Batch Processing**: Future windows samples every 20 minutes (72 samples/day)
5. **Client-Side Interpolation**: Smooth position updates between cached times

### Technology Choices

**Frontend:**
- **Next.js 15**: App Router, Server Components, Turbopack for fast builds
- **Three.js**: Industry-standard 3D graphics library
- **React Three Fiber**: Declarative React wrapper for Three.js
- **OpenAI Agents SDK**: High-level framework for Realtime API integration

**Backend:**
- **FastAPI**: Modern async Python framework with automatic OpenAPI docs
- **Skyfield**: High-precision astronomical calculations (sub-kilometer accuracy)
- **DE440S**: JPL's latest ephemeris (covers 1549-2650 CE)
- **Pydantic**: Type-safe data validation

**External Services:**
- **OpenAI Realtime API**: Voice-enabled AI with WebRTC
- **Open-Meteo API**: Free cloud cover data (no API key required)

---

## Key System Design Patterns

### 1. Context Propagation
- Observer context (lat/lon/datetime) flows from TimeControls → SkyViewer → ChatPanel → AI Agent
- Agent receives context at initialization and in tool calls
- Enables consistent state across all components

### 2. Separation of Concerns
- **Computation**: Backend handles all astronomical calculations
- **Visualization**: Frontend handles 3D rendering and UI
- **AI Logic**: Agent handles natural language understanding and tool orchestration
- **State Management**: React Context for camera state, transcript state

### 3. Error Resilience
- Graceful degradation: Tools return error objects instead of throwing
- Cache fallback: Interpolation works even with partial cache
- Network resilience: Open-Meteo API failures don't break observation planning

### 4. Real-Time Updates
- WebRTC for voice AI (low latency)
- Position interpolation for smooth 3D updates
- Debounced API calls to balance responsiveness and efficiency

---

## Scalability Considerations

**Current Limitations:**
- Future windows calculation is CPU-intensive (samples every 20 minutes over N days)
- Position cache is in-memory (lost on refresh)
- Single backend instance (no load balancing)

**Potential Improvements:**
- Redis cache for position data (shared across instances)
- Background job queue for future windows (async processing)
- CDN for static assets (textures, ephemeris file)
- Database for historical observation data

---

## Security & Privacy

- **API Keys**: OpenAI API key stored server-side only (`.env.local`)
- **Ephemeral Keys**: Realtime sessions use short-lived keys (not stored)
- **CORS**: Backend restricts origins to known frontend URLs
- **No User Data**: No authentication, no user data storage

---

## Metrics & Performance

**Response Times:**
- Sky snapshot: ~50-100ms (cached: <1ms)
- Observation plan: ~50-100ms
- Future windows (14 days): ~5-10 seconds
- AI agent response: ~2-3 seconds (including tool calls)

**Resource Usage:**
- Backend: ~100MB RAM (ephemeris file loaded in memory)
- Frontend: ~50MB RAM (Three.js scene)
- Network: ~1MB initial load (textures, models)

---

## Conclusion

AstroAgent demonstrates a modern full-stack architecture combining:
- **AI**: Voice-enabled agent with specialized tools and context awareness
- **System Design**: Clean separation of concerns, efficient caching, real-time updates
- **User Experience**: Interactive 3D visualization with natural language interaction

The system showcases practical integration of:
- LLM agents with tool calling
- Real-time WebRTC communication
- High-precision scientific calculations
- 3D graphics rendering
- Multi-component state management


