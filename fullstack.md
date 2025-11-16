# Full-Stack Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Integration Points](#integration-points)
4. [Data Flow](#data-flow)
5. [Deployment](#deployment)
6. [Development Workflow](#development-workflow)
7. [Troubleshooting](#troubleshooting)

---

## System Overview

### What is AstroAgent?

AstroAgent is a full-stack astronomy application that combines:
- **High-precision ephemeris calculations** (Backend)
- **Interactive 3D celestial visualization** (Frontend)
- **AI-powered astronomy assistant** (Frontend + OpenAI)

### Key Features

1. **Real-Time Planet Positions**: Accurate positions of Sun, Moon, and planets using JPL DE440S ephemeris
2. **3D Sky Visualization**: Interactive 3D scene showing celestial bodies in their correct positions
3. **Observation Planning**: Quality metrics and recommendations for optimal viewing times
4. **AI Assistant**: Voice-enabled assistant that can answer questions and control the camera
5. **Future Windows**: Finds best viewing times for celestial objects

### Technology Stack

**Backend:**
- FastAPI (Python web framework)
- Skyfield (Astronomical calculations)
- DE440S (JPL ephemeris data)
- OpenAI Agents SDK (AI planning)

**Frontend:**
- Next.js 15 (React framework)
- Three.js (3D graphics)
- OpenAI Realtime API (Voice AI)
- TypeScript (Type safety)

**External Services:**
- OpenAI API (AI agent and real-time voice)
- Open-Meteo API (Cloud cover data)

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER BROWSER                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Next.js Frontend (Port 3000)             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │   │
│  │  │  SkyViewer   │  │  ChatPanel   │  │ TimeControls│ │   │
│  │  │  (Three.js)  │  │  (Realtime)  │  │  PlannerCard │ │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │   │
│  └────────┼──────────────────┼──────────────────┼────────┘   │
│           │                  │                  │              │
│           │ HTTP             │ WebRTC          │ HTTP         │
│           │ (Port 8000)      │ (OpenAI)        │ (Port 8000)  │
└───────────┼──────────────────┼──────────────────┼──────────────┘
            │                  │                  │
            ▼                  ▼                  ▼
┌───────────┴──────────────────┴──────────────────┴──────────────┐
│                    FastAPI Backend (Port 8000)                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  /api/sky          /api/plan      /api/future-windows  │  │
│  │  ┌──────────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │ Ephemeris    │  │ Planner  │  │ Window Finder    │  │  │
│  │  │ Service      │  │ Service  │  │ Service          │  │  │
│  │  └──────┬───────┘  └────┬─────┘  └────────┬─────────┘  │  │
│  │         │              │                   │            │  │
│  │         └──────────────┴───────────────────┘            │  │
│  │                          │                               │  │
│  │                          ▼                               │  │
│  │                   Skyfield + DE440S                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            │
            │ HTTP
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OpenAI Realtime API                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Astronomy Agent                                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Tools:                                            │  │  │
│  │  │  - get_planet_position                             │  │  │
│  │  │  - get_observation_plan                             │  │  │
│  │  │  - point_to_planet                                  │  │  │
│  │  │  - get_future_windows                               │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **User Interaction**:
   - User changes time/location → Frontend updates → SkyViewer fetches new positions
   - User asks question → ChatPanel → OpenAI Realtime API → AI Agent

2. **AI Agent Tool Calls**:
   - Agent decides to call tool → Tool executes → Backend API call → Response → Agent interprets → User response

3. **Camera Control**:
   - Agent calls `point_to_planet` → Tool returns position → CameraContext → SkyViewer animates camera

4. **Observation Planning**:
   - User selects target → PlannerCard fetches plan → Backend calculates → Display metrics

---

## Integration Points

### Frontend → Backend API

The frontend makes HTTP requests to three main backend endpoints:

#### 1. Sky Snapshot (`GET /api/sky`)

**Used by:**
- `SkyViewer.tsx`: Fetches all celestial body positions
- `tools.ts`: `get_planet_position`, `get_all_visible_objects`, `point_to_planet` tools

**Request:**
```typescript
const params = new URLSearchParams({
  lat: String(latitude),
  lon: String(longitude),
  elev: '0',
  datetime: timestamp.toISOString(),
  refraction: 'true',
});
const res = await fetch(`http://localhost:8000/api/sky?${params.toString()}`);
```

**Response:**
```json
{
  "observer": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "elevationM": 0.0,
    "datetime": "2024-01-15T12:00:00Z"
  },
  "bodies": [
    {
      "id": "saturn",
      "name": "Saturn",
      "ra": 19.5,
      "dec": -20.3,
      "az": 135.2,
      "alt": 45.8,
      "distanceKm": 147098074.5
    }
    // ... more bodies
  ]
}
```

#### 2. Observation Plan (`GET /api/plan`)

**Used by:**
- `PlannerCard.tsx`: Displays observation quality metrics
- `ChatPanel.tsx`: Fetches current observing context for AI agent
- `tools.ts`: `get_observation_plan` tool

**Request:**
```typescript
const params = new URLSearchParams({
  lat: String(latitude),
  lon: String(longitude),
  elev: '0',
  datetime: date.toISOString(),
  target: 'saturn',
  refraction: 'true',
});
const res = await fetch(`http://localhost:8000/api/plan?${params.toString()}`);
```

**Response:**
```json
{
  "observer": { /* same as sky */ },
  "target": "saturn",
  "metrics": {
    "targetAltitudeDeg": 35.2,
    "sunAltitudeDeg": -25.4,
    "moonTargetSeparationDeg": 45.8,
    "cloudCoverPct": 15.0
  },
  "recommendation": {
    "ok": true,
    "score": 0.82,
    "criteria": {
      "alt": 0.84,
      "sun": 0.95,
      "moon": 0.76,
      "clouds": 0.85
    }
  }
}
```

#### 3. Future Windows (`GET /api/future-windows`)

**Used by:**
- `tools.ts`: `get_future_windows` tool

**Request:**
```typescript
const params = new URLSearchParams({
  lat: String(latitude),
  lon: String(longitude),
  datetime: date.toISOString(),
  target: 'saturn',
  daysAhead: '60',
  maxWindows: '3',
  refraction: 'true',
});
const res = await fetch(`http://localhost:8000/api/future-windows?${params.toString()}`);
```

**Response:**
```json
{
  "target": "saturn",
  "searchPeriod": {
    "startDate": "2024-01-15T12:00:00Z",
    "daysAhead": 60
  },
  "windows": [
    {
      "datetime": "2024-01-18T03:30:00Z",
      "dateRange": "January 18, 2024 at 03:30 AM Local (UTC-8)",
      "score": 0.89,
      "metrics": { /* same as plan */ },
      "recommendation": { /* same as plan */ }
    }
  ],
  "totalFound": 12,
  "returned": 3
}
```

### Frontend → OpenAI Realtime API

The frontend connects to OpenAI Realtime API via WebRTC for voice-enabled AI interactions.

#### Session Creation

**Endpoint:** `POST /api/session` (Next.js API route)

**Implementation:**
```1:27:frontend/src/app/api/session/route.ts
import { NextResponse } from "next/server";

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

**Flow:**
1. Frontend calls `/api/session`
2. Next.js API route creates OpenAI Realtime session
3. Returns ephemeral key (client_secret)
4. Frontend uses key to connect via WebRTC

#### Agent Initialization

**Context Passing:**
```100:140:frontend/src/components/chat/ChatPanel.tsx
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
```

**Context Structure:**
- `latitude`, `longitude`, `datetime`: Observer location and time
- `currentSunAltitude`: Sun's altitude in degrees
- `currentObservingScore`: Overall observing quality (0-1)
- `isDaytime`: Boolean indicating if sun is above horizon
- `isGoodObserving`: Boolean indicating if conditions are good
- `cloudCover`: Cloud cover percentage

### AI Agent → Backend API (via Tools)

When the AI agent calls tools, they execute in the frontend and make HTTP requests to the backend.

**Tool Execution Flow:**
```14:51:frontend/src/agents/tools.ts
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
```

**Key Points:**
- Tools receive context from agent (latitude, longitude, datetime)
- Tools make HTTP requests to backend
- Tools return structured data to agent
- Agent interprets results and responds to user

### AI Agent → Camera Control

When the agent calls `point_to_planet`, it triggers a camera animation in the 3D scene.

**Flow:**
1. Agent calls `point_to_planet` tool
2. Tool fetches planet position from backend
3. Tool returns position data
4. `useCameraToolHandler` hook detects tool result
5. Calls `CameraContext.pointToPlanet()`
6. `SkyViewer` camera controller animates to planet

**Implementation:**
```11:16:frontend/src/hooks/useCameraToolHandler.ts
  const handleToolResult = (toolName: string, result: any) => {
    if (toolName === "point_to_planet" && result.success) {
      // Trigger camera animation
      pointToPlanet(result.planet.toLowerCase(), result.altitude, result.azimuth);
    }
  };
```

---

## Data Flow

### Sky Position Update Flow

```
User changes time/location
    ↓
TimeControls component updates state
    ↓
SkyViewer receives new props (date, latitude, longitude)
    ↓
Check position cache (1-hour intervals)
    ↓
Cache hit? → Interpolate positions → Update 3D scene
    ↓
Cache miss? → Fetch from backend /api/sky
    ↓
Backend calculates positions using Skyfield + DE440S
    ↓
Return JSON response
    ↓
Cache response → Update 3D scene
```

### AI Agent Query Flow

```
User asks "Where is Saturn?"
    ↓
ChatPanel sends message to OpenAI Realtime API
    ↓
Astronomy Agent receives message
    ↓
Agent decides to call tools:
  1. get_planet_position("saturn")
  2. get_observation_plan("saturn")
  3. point_to_planet("saturn")
    ↓
Tools execute in frontend:
  - Fetch from /api/sky
  - Fetch from /api/plan
  - Calculate position
    ↓
Tools return results to agent
    ↓
Agent interprets results:
  - Planet is at 35° altitude, 135° azimuth
  - Visibility score: 0.82 (good)
  - Camera animation triggered
    ↓
Agent responds: "Saturn is visible at 35° altitude..."
    ↓
Camera animates to Saturn position
```

### Observation Planning Flow

```
User selects target planet
    ↓
PlannerCard component receives target prop
    ↓
Debounce date changes (500ms)
    ↓
Fetch from /api/plan with target parameter
    ↓
Backend calculates:
  - Target altitude
  - Sun altitude
  - Moon separation
  - Cloud cover (from Open-Meteo)
  - Quality score
    ↓
Return recommendation object
    ↓
Display metrics in PlannerCard:
  - Score percentage
  - Individual criteria
  - Good/Poor indicator
```

### Future Windows Flow

```
User asks "When is the best time to see Saturn?"
    ↓
Agent calls get_future_windows tool
    ↓
Tool fetches from /api/future-windows
    ↓
Backend samples times over search period:
  - 14 days ahead (default)
  - Every 20 minutes
  - Calculate observation plan for each
    ↓
Filter windows with score > 0.3
    ↓
Sort by score, return top N
    ↓
Agent interprets results and suggests best times
```

---

## Deployment

### Prerequisites

1. **Backend Requirements:**
   - Python 3.12+
   - `de440s.bsp` ephemeris file (~50 MB)
   - OpenAI API key (optional, for agent planner)

2. **Frontend Requirements:**
   - Node.js 20+
   - OpenAI API key (required for Realtime API)

3. **External Services:**
   - OpenAI API account
   - Open-Meteo API (free, no key required)

### Environment Variables

**Backend (`.env` or system environment):**
```bash
OPENAI_API_KEY=sk-...  # Optional, for agent planner CLI
```

**Frontend (`.env.local`):**
```bash
OPENAI_API_KEY=sk-...  # Required for Realtime API
```

### Backend Deployment

**Development:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Production:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Docker (example):**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Deployment

**Development:**
```bash
cd frontend
npm install
npm run dev
```

**Production Build:**
```bash
cd frontend
npm install
npm run build
npm start
```

**Vercel Deployment:**
1. Connect GitHub repository
2. Set `OPENAI_API_KEY` in environment variables
3. Deploy automatically on push

**Docker (example):**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### CORS Configuration

The backend must allow requests from the frontend domain:

```75:88:backend/app/main.py
app.add_middleware(
	CORSMiddleware,
	allow_origins=[
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://localhost:3005",
		"http://127.0.0.1:3005",
		"http://localhost:5173",
		"http://127.0.0.1:5173",
	],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)
```

**Production:**
Update `allow_origins` to include production frontend URL:
```python
allow_origins=[
    "https://your-frontend-domain.com",
    "https://www.your-frontend-domain.com",
]
```

### Network Configuration

**Backend:**
- Default port: 8000
- Must be accessible from frontend
- For production, use reverse proxy (nginx, Caddy)

**Frontend:**
- Default port: 3000 (dev), 3000 (prod)
- Must be accessible from user browsers
- For production, use CDN or static hosting

**OpenAI Realtime API:**
- WebRTC connection (peer-to-peer)
- No firewall configuration needed
- Requires OpenAI API key

---

## Development Workflow

### Running Both Services

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Backend Docs: http://localhost:8000/docs

### Testing Integration

1. **Sky Visualization:**
   - Open http://localhost:3000
   - Verify planets render in 3D scene
   - Change time and verify positions update
   - Change location and verify positions recalculate

2. **Observation Planning:**
   - Check PlannerCard displays metrics
   - Verify score updates when changing time
   - Test different target planets

3. **AI Assistant:**
   - Click chat panel to expand
   - Verify connection status
   - Ask "Where is Saturn?"
   - Verify camera animates to planet
   - Verify transcript displays response

4. **Tool Execution:**
   - Ask "What planets are visible?"
   - Ask "Is it good for observing Saturn?"
   - Ask "When is the best time to see Jupiter?"
   - Check browser console for tool calls

### Debugging Tips

**Backend Issues:**
- Check backend logs for errors
- Verify ephemeris file exists (`de440s.bsp`)
- Test API endpoints directly with curl:
  ```bash
  curl "http://localhost:8000/api/sky?lat=37.7749&lon=-122.4194"
  ```

**Frontend Issues:**
- Check browser console for errors
- Verify backend is running and accessible
- Check Network tab for failed requests
- Verify environment variables are set

**AI Agent Issues:**
- Check OpenAI API key is valid
- Verify `/api/session` endpoint works
- Check WebRTC connection in browser console
- Verify tools are returning correct data

**Camera Animation Issues:**
- Check CameraContext provider is wrapping components
- Verify `point_to_planet` tool is being called
- Check browser console for animation errors
- Verify planet is above horizon (altitude > 0)

### Common Development Tasks

**Adding a New Tool:**
1. Define tool in `frontend/src/agents/tools.ts`
2. Add tool to `astronomyTools` array
3. Update agent instructions if needed
4. Test tool execution

**Adding a New Celestial Body:**
1. Add body to backend `_TARGETS` list
2. Update frontend planet colors if needed
3. Test position calculation
4. Verify 3D rendering

**Modifying Observation Scoring:**
1. Update scoring algorithm in `backend/app/services/ephemeris.py`
2. Test with different scenarios
3. Verify frontend displays updated scores

---

## Troubleshooting

### Backend Won't Start

**Issue: Port already in use**
- **Solution**: Change port: `uvicorn app.main:app --port 8001`
- Update frontend API calls to use new port

**Issue: Ephemeris file not found**
- **Solution**: Ensure `de440s.bsp` is in `backend/` directory
- Skyfield will download it automatically on first use

**Issue: Module not found**
- **Solution**: Install dependencies: `pip install -r requirements.txt`
- Verify virtual environment is activated

### Frontend Won't Connect to Backend

**Issue: CORS errors**
- **Solution**: Verify frontend URL is in backend `allow_origins`
- Check browser console for CORS error details

**Issue: Network errors**
- **Solution**: Verify backend is running on correct port
- Check firewall settings
- Test backend directly: `curl http://localhost:8000/api/sky?lat=0&lon=0`

**Issue: Slow responses**
- **Solution**: This is expected for `/api/future-windows` (many calculations)
- Consider reducing `daysAhead` parameter
- Implement caching for repeated queries

### AI Agent Won't Connect

**Issue: No ephemeral key**
- **Solution**: Verify `OPENAI_API_KEY` is set in `.env.local`
- Restart dev server after adding environment variable
- Check `/api/session` endpoint returns `client_secret`

**Issue: WebRTC connection fails**
- **Solution**: Check browser console for WebRTC errors
- Verify OpenAI API key is valid
- Check network connectivity

**Issue: Tools not executing**
- **Solution**: Verify backend is running and accessible
- Check tool definitions in `tools.ts`
- Verify context values are being passed correctly

### 3D Scene Not Rendering

**Issue: Black screen**
- **Solution**: Check browser console for WebGL errors
- Verify Three.js is loading correctly
- Check texture files exist in `public/` directory

**Issue: Planets not appearing**
- **Solution**: Verify backend is returning data
- Check `bodies` array in SkyViewer state
- Verify planet positions are valid (altitude > -10)

**Issue: Camera animation not working**
- **Solution**: Verify CameraContext provider wraps components
- Check `point_to_planet` tool is being called
- Verify planet is above horizon

### Performance Issues

**Issue: Slow position updates**
- **Solution**: Position caching is already implemented (1-hour intervals)
- Consider increasing cache interval for slower updates
- Reduce cache pre-fetch range if needed

**Issue: High memory usage**
- **Solution**: Clear cache when location changes (already implemented)
- Limit cache size if needed
- Consider lazy loading chat panel

**Issue: Slow future windows calculation**
- **Solution**: This is expected (many calculations)
- Reduce `daysAhead` parameter
- Increase sampling interval (currently 20 minutes)

---

## Conclusion

The AstroAgent full-stack system provides a complete astronomy application with:

- **Backend**: High-precision ephemeris calculations and observation planning
- **Frontend**: Interactive 3D visualization and AI assistant
- **Integration**: Seamless data flow between components
- **AI**: Voice-enabled assistant with tool integration

The architecture is modular, scalable, and well-documented, making it easy to:
- Add new features
- Extend AI agent capabilities
- Integrate additional data sources
- Deploy to production

For detailed documentation, see:
- `backend/backend.md` - Backend API and services
- `frontend/frontend.md` - Frontend components and architecture

For questions or contributions, refer to the main project repository.





