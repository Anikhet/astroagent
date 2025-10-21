import React from "react";
import { SessionStatus } from "@/types/chat";

interface ChatControlsProps {
  sessionStatus: SessionStatus;
  onToggleConnection: () => void;
  isPTTActive: boolean;
  setIsPTTActive: (val: boolean) => void;
  isPTTUserSpeaking: boolean;
  handleTalkButtonDown: () => void;
  handleTalkButtonUp: () => void;
  isAudioPlaybackEnabled: boolean;
  setIsAudioPlaybackEnabled: (val: boolean) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

function ChatControls({
  sessionStatus,
  onToggleConnection,
  isPTTActive,
  setIsPTTActive,
  isPTTUserSpeaking,
  handleTalkButtonDown,
  handleTalkButtonUp,
  isAudioPlaybackEnabled,
  setIsAudioPlaybackEnabled,
  isExpanded,
  onToggleExpanded,
}: ChatControlsProps) {
  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";

  function getConnectionButtonLabel() {
    if (isConnected) return "Disconnect";
    if (isConnecting) return "Connecting...";
    return "Connect";
  }

  function getConnectionButtonClasses() {
    const baseClasses = "text-stone-300 text-xs px-4 py-2 w-32 rounded-md h-full";
    const cursorClass = isConnecting ? "cursor-not-allowed" : "cursor-pointer";

    if (isConnected) {
      // Connected -> label "Disconnect" -> subtle
      return `bg-stone-700/40 hover:bg-stone-600/40 ${cursorClass} ${baseClasses}`;
    }
    // Disconnected or connecting -> label is either "Connect" or "Connecting" -> subtle
    return `bg-stone-700/40 hover:bg-stone-600/40 ${cursorClass} ${baseClasses}`;
  }

    return (
      <div className="px-6 py-4 flex flex-col gap-3 bg-stone-800/30 backdrop-blur-sm border-t border-stone-700/40 rounded-b-xl">
      {/* Connection Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleConnection}
          className={getConnectionButtonClasses()}
          disabled={isConnecting}
        >
          {getConnectionButtonLabel()}
        </button>
        
        <button
          onClick={onToggleExpanded}
          className="w-6 h-6 text-stone-400 hover:text-stone-200 transition-colors"
          title={isExpanded ? "Minimize" : "Expand"}
        >
          {isExpanded ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Audio Controls */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            id="push-to-talk"
            type="checkbox"
            checked={isPTTActive}
            onChange={(e) => setIsPTTActive(e.target.checked)}
            disabled={!isConnected}
            className="w-4 h-4 text-stone-400 border-stone-600 rounded focus:ring-stone-500"
          />
          <label
            htmlFor="push-to-talk"
            className="flex items-center cursor-pointer text-xs text-stone-500"
          >
            Push to talk
          </label>
          <button
            onMouseDown={handleTalkButtonDown}
            onMouseUp={handleTalkButtonUp}
            onTouchStart={handleTalkButtonDown}
            onTouchEnd={handleTalkButtonUp}
            disabled={!isPTTActive}
            className={
              (isPTTUserSpeaking ? "bg-stone-600/40 text-stone-200" : "bg-stone-700/40 text-stone-300") +
              " py-1.5 px-3 cursor-pointer rounded-md text-xs font-medium transition-colors" +
              (!isPTTActive ? " bg-stone-800/40 text-stone-600 cursor-not-allowed" : " hover:bg-stone-600/40")
            }
          >
            Talk
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="audio-playback"
            type="checkbox"
            checked={isAudioPlaybackEnabled}
            onChange={(e) => setIsAudioPlaybackEnabled(e.target.checked)}
            disabled={!isConnected}
            className="w-4 h-4 text-stone-400 border-stone-600 rounded focus:ring-stone-500"
          />
          <label
            htmlFor="audio-playback"
            className="flex items-center cursor-pointer text-xs text-stone-500"
          >
            Audio playback
          </label>
        </div>
      </div>
    </div>
  );
}

export default ChatControls;
