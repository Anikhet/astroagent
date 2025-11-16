'use client';

import { useState, useEffect, useMemo } from 'react';

interface TimeControlsProps {
  onDateChange: (date: Date) => void;
  onLocationChange: (lat: number, lng: number) => void;
  initialDate: Date;
  initialLatitude: number;
  initialLongitude: number;
}

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

  // Calculate time range: 7 days back to 7 days forward from current time
  const now = useMemo(() => new Date(), []);
  const minDate = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }, [now]);
  const maxDate = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return d;
  }, [now]);

  // Sync date state when initialDate prop changes (but not during playback)
  useEffect(() => {
    if (isPlaying) return; // Don't sync during playback to avoid conflicts
    
    // Clamp initialDate to valid range
    const clampedDate = new Date(
      Math.max(minDate.getTime(), Math.min(maxDate.getTime(), initialDate.getTime()))
    );
    
    // Only update if the date actually changed (avoid unnecessary updates)
    if (Math.abs(clampedDate.getTime() - date.getTime()) > 1000) {
      setDate(clampedDate);
    }
  }, [initialDate, minDate, maxDate, isPlaying, date]);

  // Calculate slider value (0-100) from current date
  const getSliderValue = (currentDate: Date): number => {
    const totalRange = maxDate.getTime() - minDate.getTime();
    const currentOffset = currentDate.getTime() - minDate.getTime();
    return Math.max(0, Math.min(100, (currentOffset / totalRange) * 100));
  };

  // Convert slider value (0-100) to date
  const getDateFromSliderValue = (value: number): Date => {
    const totalRange = maxDate.getTime() - minDate.getTime();
    const offset = (value / 100) * totalRange;
    return new Date(minDate.getTime() + offset);
  };

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = Number(e.target.value);
    const newDate = getDateFromSliderValue(sliderValue);
    // Clamp to valid range
    const clampedDate = new Date(Math.max(minDate.getTime(), Math.min(maxDate.getTime(), newDate.getTime())));
    handleDateChange(clampedDate);
  };

  // Playback functionality
  useEffect(() => {
    if (!isPlaying) return;

    // Calculate step size: 1 minute base × playSpeed
    // For real-time feel, we'll advance by minutes based on speed
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
        
        // Ensure we don't go below min date
        if (newDate.getTime() < minDate.getTime()) {
          setIsPlaying(false);
          return minDate;
        }
        
        return newDate;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, playSpeed, maxDate, minDate]);

  const handleDateChange = (newDate: Date) => {
    setDate(newDate);
    onDateChange(newDate);
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    onLocationChange(lat, lng);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaySpeed(speed);
  };

  const formatDate = (date: Date) => {
    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <div className="absolute top-4 left-4 z-10 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white min-w-[300px]">
      <h2 className="text-lg font-semibold mb-4 text-green-400">Sky Controls</h2>
      
      {/* Date and Time Controls */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Date & Time</label>
          <input
            type="datetime-local"
            value={formatDate(date)}
            onChange={(e) => {
              const newDate = new Date(e.target.value);
              // Clamp to valid range
              if (newDate.getTime() < minDate.getTime()) {
                handleDateChange(minDate);
              } else if (newDate.getTime() > maxDate.getTime()) {
                handleDateChange(maxDate);
              } else {
                handleDateChange(newDate);
              }
            }}
            min={formatDate(minDate)}
            max={formatDate(maxDate)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-green-400 focus:outline-none"
          />
        </div>

        {/* Time Scrubber */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400">7 days ago</span>
            <span className="text-sm font-medium text-green-400">
              {date.toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            <span className="text-xs text-gray-400">7 days ahead</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={getSliderValue(date)}
            onChange={handleSliderChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            style={{
              background: `linear-gradient(to right, #10b981 0%, #10b981 ${getSliderValue(date)}%, #374151 ${getSliderValue(date)}%, #374151 100%)`
            }}
          />
        </div>

        {/* Playback Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePlayPause}
            className={`px-4 py-2 rounded-md font-medium ${
              isPlaying 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          
          <select
            value={playSpeed}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-green-400 focus:outline-none"
          >
            <option value={0.1}>0.1x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
          </select>
        </div>
      </div>

      {/* Location Controls */}
      <div className="mt-6 space-y-3">
        <h3 className="text-md font-medium text-green-400">Location</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Latitude</label>
            <input
              type="number"
              value={latitude}
              onChange={(e) => handleLocationChange(Number(e.target.value), longitude)}
              min="-90"
              max="90"
              step="0.1"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-green-400 focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Longitude</label>
            <input
              type="number"
              value={longitude}
              onChange={(e) => handleLocationChange(latitude, Number(e.target.value))}
              min="-180"
              max="180"
              step="0.1"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:border-green-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Quick Location Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleLocationChange(40.7128, -74.0060)}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
          >
            New York
          </button>
          <button
            onClick={() => handleLocationChange(51.5074, -0.1278)}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
          >
            London
          </button>
          <button
            onClick={() => handleLocationChange(35.6762, 139.6503)}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
          >
            Tokyo
          </button>
          <button
            onClick={() => handleLocationChange(-33.8688, 151.2093)}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
          >
            Sydney
          </button>
          <button
            onClick={() => handleLocationChange(37.7749, -122.4194)}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
          >
            San Francisco
          </button>
        </div>
      </div>

      {/* Current Info */}
      <div className="mt-4 pt-4 border-t border-gray-600">
        <div className="text-sm text-gray-300">
          <p>Current Time: {date.toLocaleString()}</p>
          <p>Location: {latitude.toFixed(2)}°, {longitude.toFixed(2)}°</p>
        </div>
      </div>
    </div>
  );
}




