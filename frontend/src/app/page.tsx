'use client';

import { useState } from 'react';
import SkyViewer from '@/components/SkyViewer';
import PlannerCard from '@/components/PlannerCard';
import TimeControls from '@/components/TimeControls';
import ChatPanel from '@/components/chat/ChatPanel';
import { CameraProvider, useCamera } from '@/contexts/CameraContext';

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
