# AstroAgent - Astronomy Assistant with Voice Chat

## Overview
AstroAgent is a 3D astronomy visualization tool with an integrated OpenAI Realtime voice chat assistant. Users can explore planet positions in real-time and ask questions about celestial objects through voice or text interaction.

## Features
- **3D Sky Visualization**: Interactive 3D view of planet positions using Three.js
- **Real-time Planet Tracking**: Accurate ephemeris calculations using Skyfield
- **Voice Chat Assistant**: OpenAI Realtime API integration for natural conversation
- **Observation Planning**: Get recommendations for optimal viewing conditions
- **Location & Time Controls**: Adjust observation location and time

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- Python 3.8+ (for backend)
- OpenAI API key

### Frontend Setup (Next.js)
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Backend Setup (FastAPI)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the backend server:
   ```bash
   python -m app.main
   ```

### Usage
1. Open http://localhost:3000 in your browser
2. The 3D sky viewer will load with current planet positions
3. Click the green chat icon in the top-right corner to open the Astronomy Assistant
4. Click "Connect" to start the voice chat session
5. Ask questions like:
   - "Where is Saturn right now?"
   - "What planets are visible tonight?"
   - "Is it a good time to observe Jupiter?"

## Voice Chat Features
- **Real-time Voice Interaction**: Speak naturally with the astronomy assistant
- **Push-to-Talk Mode**: Hold the talk button to speak
- **Text Fallback**: Type messages if voice isn't preferred
- **Audio Recording**: Download conversation recordings
- **Tool Integration**: Agent can fetch real-time planet data and observation plans

## Architecture
- **Frontend**: Next.js with React Three Fiber for 3D visualization
- **Backend**: FastAPI with Skyfield for astronomical calculations
- **Voice AI**: OpenAI Realtime API with custom astronomy agent
- **Styling**: Tailwind CSS with green theme

## API Endpoints
- `GET /api/sky` - Get planet positions for given location/time
- `GET /api/plan` - Get observation recommendations
- `GET /api/session` - Create OpenAI Realtime session tokens

## Troubleshooting
- Ensure both frontend (port 3000) and backend (port 8000) are running
- Check that your OpenAI API key is valid and has Realtime API access
- Verify microphone permissions in your browser
- Check browser console for any WebRTC connection errors