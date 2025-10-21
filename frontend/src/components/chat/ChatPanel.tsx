"use client";

import React, { useState, useEffect, useRef } from "react";
import { SessionStatus } from "@/types/chat";
import { TranscriptProvider } from "@/contexts/TranscriptContext";
import { EventProvider } from "@/contexts/EventContext";
import { useRealtimeSession } from "@/hooks/useRealtimeSession";
import { useAudioDownload } from "@/hooks/useAudioDownload";
import { useCamera } from "@/contexts/CameraContext";
import { useCameraToolHandler } from "@/hooks/useCameraToolHandler";
import { createAstronomyAgent } from "@/agents/astronomy-agent";
import Transcript from "./Transcript";
import ChatControls from "./ChatControls";

interface ChatPanelProps {
  latitude: number;
  longitude: number;
  currentDate: Date;
}

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

  // Create audio element for WebRTC
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioElementRef.current) {
      const el = document.createElement('audio');
      el.autoplay = true;
      el.style.display = 'none';
      document.body.appendChild(el);
      audioElementRef.current = el;
    }
  }, []);

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

  const disconnectFromRealtime = () => {
    disconnect();
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);
  };

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;

    const message = userText.trim();
    setUserText("");

    if (sessionStatus === "CONNECTED") {
      // Send immediately if connected
      interrupt();
      try {
        sendUserText(message);
      } catch (err) {
        console.error('Failed to send message:', err);
      }
    } else {
      // Queue message if not connected yet
      setMessageQueue(prev => [...prev, message]);

      // Auto-connect if disconnected
      if (sessionStatus === "DISCONNECTED") {
        connectToRealtime();
      }
    }
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== 'CONNECTED') return;
    interrupt();
    setIsPTTUserSpeaking(true);
    pushToTalkStart();
  };

  const handleTalkButtonUp = () => {
    if (sessionStatus !== 'CONNECTED' || !isPTTUserSpeaking) return;
    setIsPTTUserSpeaking(false);
    pushToTalkStop();
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      disconnectFromRealtime();
    } else {
      connectToRealtime();
    }
  };

  // Handle audio playback toggle
  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }

    try {
      mute(!isAudioPlaybackEnabled);
    } catch (err) {
      console.warn('Failed to toggle mute', err);
    }
  }, [isAudioPlaybackEnabled, mute]);

  // Auto-connect when chat panel is expanded
  useEffect(() => {
    if (isExpanded && sessionStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [isExpanded]);

  // Send queued messages when connection is established
  useEffect(() => {
    if (sessionStatus === "CONNECTED" && messageQueue.length > 0) {
      messageQueue.forEach((message) => {
        try {
          sendUserText(message);
        } catch (err) {
          console.error('Failed to send queued message:', err);
        }
      });
      setMessageQueue([]);
    }
  }, [sessionStatus, messageQueue, sendUserText]);

  // Start recording when connected
  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }

    return () => {
      stopRecording();
    };
  }, [sessionStatus, startRecording, stopRecording]);

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
      isExpanded ? 'w-96' : 'w-16'
    }`}>
      <div className="bg-stone-900/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/50 border border-stone-700/40 overflow-hidden">
        {isExpanded ? (
          <div className="h-[80vh] flex flex-col">
            {connectionError && (
              <div className="bg-stone-800/50 border-b border-stone-700/40 text-stone-300 px-6 py-4">
                <div className="flex">
                  <div className="py-1">
                    <svg className="fill-current h-5 w-5 text-stone-400 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-stone-50">Connection Error</p>
                    <p className="text-xs mt-1 text-stone-400">{connectionError}</p>
                    <p className="text-xs mt-1">
                      Please add your OpenAI API key to <code className="bg-stone-700/50 px-1 rounded text-stone-300">.env.local</code>
                    </p>
                  </div>
                </div>
              </div>
            )}
            <Transcript
              userText={userText}
              setUserText={setUserText}
              onSendMessage={handleSendTextMessage}
              canSend={userText.trim().length > 0}
              downloadRecording={downloadRecording}
            />
            <ChatControls
              sessionStatus={sessionStatus}
              onToggleConnection={onToggleConnection}
              isPTTActive={isPTTActive}
              setIsPTTActive={setIsPTTActive}
              isPTTUserSpeaking={isPTTUserSpeaking}
              handleTalkButtonDown={handleTalkButtonDown}
              handleTalkButtonUp={handleTalkButtonUp}
              isAudioPlaybackEnabled={isAudioPlaybackEnabled}
              setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
              isExpanded={isExpanded}
              onToggleExpanded={() => setIsExpanded(false)}
            />
          </div>
        ) : (
          <div className="p-3 flex flex-col items-center gap-2 bg-stone-800/30 backdrop-blur-sm">
            <button
              onClick={() => setIsExpanded(true)}
              className="p-3 text-stone-400 hover:text-stone-200 rounded-full transition-colors"
              title="Open Astronomy Assistant"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatPanel({ latitude, longitude, currentDate }: ChatPanelProps) {
  return (
    <TranscriptProvider>
      <EventProvider>
        <ChatPanelInner 
          latitude={latitude}
          longitude={longitude}
          currentDate={currentDate}
        />
      </EventProvider>
    </TranscriptProvider>
  );
}

export default ChatPanel;
