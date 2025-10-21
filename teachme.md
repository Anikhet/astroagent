# Camera Pointing Issue - Technical Explanation

## The Problem

When you try to point the camera at Jupiter or Uranus in your 3D astronomy visualization, the camera looks at the ground (the sphere at origin) instead of looking at where the planet actually is in the sky.

## Why This Happens: The Root Causes

### 1. **Missing `camera.lookAt()` Call** (Critical Bug)

**Location:** `frontend/src/components/SkyViewer.tsx:131-146`

**The Issue:**
Your `CameraController` component animates the camera **position** but never tells the camera what to **look at**.

```typescript
// This code moves the camera position (WORKS)
const newPos = currentPos.lerp(targetPos, easedProgress);
camera.position.copy(newPos);

// This code LOGS the look-at target but never applies it (BUG!)
if (animationState.targetLookAt) {
  console.log('Look at during animation:', animationState.targetLookAt);
  // ❌ MISSING: camera.lookAt(animationState.targetLookAt);
}
```

**What Should Happen:**
```typescript
if (animationState.targetLookAt) {
  camera.lookAt(animationState.targetLookAt);  // ✅ This line is missing!
}
```

**Why This Matters:**
- In Three.js, a camera has TWO properties: **position** (where it is) and **rotation** (which direction it faces)
- `camera.lookAt(target)` rotates the camera to face the target
- Without this call, the camera moves to a new position but keeps looking at whatever OrbitControls is targeting (the origin)

---

### 2. **Incorrect Azimuth Adjustment** (Coordinate System Bug)

**Location:** `frontend/src/contexts/CameraContext.tsx:78`

**The Issue:**
The code adds 180 degrees to the azimuth, which points the camera in the **opposite direction** of where the planet actually is.

```typescript
// This rotates the azimuth by 180°, pointing the OPPOSITE way!
const adjustedAzimuth = azimuth + 180;  // ❌ BUG
const planetPosition = altAzToVector(altitude, adjustedAzimuth, SKY_RADIUS - 2);
```

**Why This Happens:**
The comment says "Use the same calculation as SkyViewer.tsx line 369", but line 369 does NOT add 180° to the azimuth. This is a coordinate system mismatch.

**Real-World Analogy:**
- Imagine you're told "Jupiter is at azimuth 90° (due East)"
- The code adds 180°, making it 270° (due West)
- So the camera points West when Jupiter is actually in the East
- That's why you see the ground instead of Jupiter!

**The Fix:**
```typescript
// Use the azimuth directly, don't rotate it
const planetPosition = altAzToVector(altitude, azimuth, SKY_RADIUS - 2);  // ✅
```

---

### 3. **OrbitControls Target Fixed at Origin**

**Location:** `frontend/src/components/SkyViewer.tsx:438`

**The Issue:**
OrbitControls is hardcoded to always orbit around `[0, 0, 0]` (the ground/sphere).

```typescript
<OrbitControls
  target={[0, 0, 0]}  // ❌ Always points at the origin (ground)
  enableRotate={true}
  // ... other props
/>
```

**Why This Matters:**
- OrbitControls rotates the camera around its target point
- Even if you move the camera to the correct position, OrbitControls will keep it looking at the origin
- You need to **update the target** dynamically when focusing on planets

**What Should Happen:**
You need to either:
1. Update the OrbitControls target when pointing at planets, OR
2. Temporarily disable OrbitControls during the animation, OR
3. Use a ref to update the target dynamically

---

## How 3D Camera Systems Work

### Key Concepts

#### 1. **Position vs Orientation**
- **Position:** Where the camera is in 3D space (x, y, z coordinates)
- **Orientation:** Which direction the camera faces (rotation angles)
- You need to set BOTH for proper camera control

#### 2. **The `lookAt()` Function**
```typescript
camera.lookAt(target);
```
This is a convenience function that:
- Takes a target position (x, y, z)
- Calculates the rotation needed to face that target
- Updates the camera's rotation automatically

#### 3. **Altitude-Azimuth Coordinate System**
In astronomy:
- **Altitude:** Angle above the horizon (0° = horizon, 90° = straight up)
- **Azimuth:** Compass direction (0° = North, 90° = East, 180° = South, 270° = West)

Your `altAzToVector()` function converts these to 3D Cartesian coordinates (x, y, z).

#### 4. **OrbitControls**
OrbitControls is a Three.js helper that lets users:
- Rotate around a target point (like orbiting around Earth)
- Zoom in/out
- Pan (move the target)

It has its own idea of where the camera should look, which can **override** your manual camera settings.

---

## The Complete Data Flow (As Intended)

1. **User says:** "Show me Jupiter"
2. **AI Agent:** Calls `point_to_planet` tool with planet name
3. **Backend:** Calculates Jupiter's altitude (e.g., 45°) and azimuth (e.g., 120°)
4. **Frontend receives:** `{ altitude: 45, azimuth: 120 }`
5. **CameraContext:** Calls `pointToPlanet()`
6. **Coordinate conversion:** `altAzToVector(45, 120, radius)` → 3D position of Jupiter
7. **Camera animation:** Should move camera position AND set lookAt target
8. **Result:** Camera smoothly moves and rotates to face Jupiter

---

## What Actually Happens (Current Bugs)

1. **User says:** "Show me Jupiter"
2. **AI Agent:** Calls `point_to_planet` tool ✅
3. **Backend:** Returns correct altitude and azimuth ✅
4. **CameraContext:** Adds 180° to azimuth ❌ (now pointing opposite direction)
5. **CameraController:** Moves camera position ✅ but never calls `camera.lookAt()` ❌
6. **OrbitControls:** Keeps camera looking at origin `[0, 0, 0]` ❌
7. **Result:** Camera is in the wrong spot, looking at the ground

---

## Visual Explanation

```
Correct behavior:
                     Jupiter (in sky)
                        *
                       /
                      /
    Camera --------→ /  (looking UP at Jupiter)
      👁️

Current buggy behavior:
    Jupiter (in sky)
       *


    Camera ----------→ Origin (ground sphere)
      👁️               🌍

    Camera position might be near Jupiter's direction,
    but it's LOOKING at the ground, not UP at Jupiter!
```

---

## The Fix (Summary)

### Fix #1: Add the missing lookAt() call
**File:** `frontend/src/components/SkyViewer.tsx:146`

```typescript
if (animationState.targetLookAt) {
  camera.lookAt(animationState.targetLookAt);  // Add this line!
}
```

### Fix #2: Remove the 180° azimuth adjustment
**File:** `frontend/src/contexts/CameraContext.tsx:78`

```typescript
// Change this:
const adjustedAzimuth = azimuth + 180;

// To this:
const adjustedAzimuth = azimuth;  // Or just use 'azimuth' directly
```

### Fix #3: Handle OrbitControls target
**File:** `frontend/src/components/SkyViewer.tsx:438`

Either:
- Update the OrbitControls target dynamically
- Disable OrbitControls during planet-pointing animations
- Use a ref to control the target programmatically

---

## Key Takeaways

1. **Always set both position AND lookAt** when controlling a camera
2. **Coordinate systems matter** - adding or subtracting 180° completely reverses direction
3. **OrbitControls can interfere** with manual camera control - you need to manage this interaction
4. **Logging is not execution** - seeing "Look at during animation: Vector3(x,y,z)" in console doesn't mean the camera actually looked there!

---

## Files Involved

- `frontend/src/components/SkyViewer.tsx` - Main 3D scene, CameraController (lines 43-161), OrbitControls (line 438)
- `frontend/src/contexts/CameraContext.tsx` - Camera animation state, azimuth bug (line 78)
- `frontend/src/hooks/useHandleSessionHistory.ts` - Triggers camera animation (lines 87-97)
- `frontend/src/agents/tools.ts` - point_to_planet tool definition (lines 173-232)

---

## Realtime Tool Spam (Oct 2025)

### Symptom
- Chat transcript spammed `Tool: point_to_planet` / `Tool Result: point_to_planet` dozens of times after a single “Show me Jupiter.”

### Root Cause
- `useRealtimeSession` registered `agent_tool_*`, `history_*`, and `transport_event` listeners inside a `useEffect` that ran on every render without removing prior listeners.
- Each reconnect stacked another listener set, so every realtime event duplicated.

### Fix
- `frontend/src/hooks/useRealtimeSession.ts`: Attach listeners once per session via `attachSessionListeners(session)` when connecting, cache them in `listenersCleanupRef`, and call `.off` on disconnect.
- `listenersCleanupRef` clears previous handlers before adding new ones, ensuring a single listener instance lives per session.

### Verification
- Trigger “Show me Jupiter” again: only one `Tool:` and one `Tool Result:` log in Event viewer and transcript.
- Confirm cleanup runs by disconnecting/reconnecting and observing no listener accumulation in logs.
