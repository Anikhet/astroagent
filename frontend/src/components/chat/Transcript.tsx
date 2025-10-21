"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TranscriptItem } from "@/types/chat";
import { useTranscript } from "@/contexts/TranscriptContext";
import { DownloadIcon, ClipboardCopyIcon } from "@radix-ui/react-icons";
import { GuardrailChip } from "./GuardrailChip";

export interface TranscriptProps {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
  downloadRecording: () => void;
}

function Transcript({
  userText,
  setUserText,
  onSendMessage,
  canSend,
  downloadRecording,
}: TranscriptProps) {
  const { transcriptItems, toggleTranscriptItemExpand } = useTranscript();
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [prevLogs, setPrevLogs] = useState<TranscriptItem[]>([]);
  const [justCopied, setJustCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function scrollToBottom() {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }

  useEffect(() => {
    const hasNewMessage = transcriptItems.length > prevLogs.length;
    const hasUpdatedMessage = transcriptItems.some((newItem, index) => {
      const oldItem = prevLogs[index];
      return (
        oldItem &&
        (newItem.title !== oldItem.title || newItem.data !== oldItem.data)
      );
    });

    if (hasNewMessage || hasUpdatedMessage) {
      scrollToBottom();
    }

    setPrevLogs(transcriptItems);
  }, [transcriptItems]);

  // Autofocus on text box input on load
  useEffect(() => {
    if (canSend && inputRef.current) {
      inputRef.current.focus();
    }
  }, [canSend]);

  const handleCopyTranscript = async () => {
    if (!transcriptRef.current) return;
    try {
      await navigator.clipboard.writeText(transcriptRef.current.innerText);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy transcript:", error);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-stone-800/50 backdrop-blur-sm min-h-0 rounded-xl">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10 text-base border-b border-stone-700/40 bg-stone-800/30 backdrop-blur-sm rounded-t-xl">
          <span className="font-medium text-stone-50 text-sm tracking-wide">Astronomy Assistant</span>
          <div className="flex gap-2">
            <button
              onClick={handleCopyTranscript}
              className="w-8 h-8 text-stone-400 hover:text-stone-200 hover:bg-stone-700/30 rounded-md p-1.5 flex items-center justify-center"
            >
              <ClipboardCopyIcon className="w-4 h-4" />
            </button>
            <button
              onClick={downloadRecording}
              className="w-8 h-8 text-stone-400 hover:text-stone-200 hover:bg-stone-700/30 rounded-md p-1.5 flex items-center justify-center"
            >
              <DownloadIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Transcript Content */}
        <div
          ref={transcriptRef}
          className="overflow-auto p-6 flex flex-col gap-6 h-full"
        >
          {[...transcriptItems]
            .sort((a, b) => a.createdAtMs - b.createdAtMs)
            .map((item) => {
              const {
                itemId,
                type,
                role,
                data,
                expanded,
                timestamp,
                title = "",
                isHidden,
                guardrailResult,
              } = item;

            if (isHidden) {
              return null;
            }

            if (type === "MESSAGE") {
              const isUser = role === "user";
              const containerClasses = `flex justify-end flex-col ${
                isUser ? "items-end" : "items-start"
              }`;
              const bubbleBase = `max-w-lg px-4 py-3 ${
                isUser ? "bg-stone-700/40 text-stone-50" : "bg-stone-800/40 text-stone-100"
              }`;
              const isBracketedMessage =
                title.startsWith("[") && title.endsWith("]");
              const messageStyle = isBracketedMessage
                ? 'italic text-gray-400'
                : '';
              const displayTitle = isBracketedMessage
                ? title.slice(1, -1)
                : title;

              return (
                <div key={itemId} className={`${containerClasses} group`}>
                  <div className="max-w-lg">
                    <div
                      className={`${bubbleBase} rounded-2xl ${
                        guardrailResult ? "" : "rounded-2xl"
                      } shadow-sm`}
                    >
                      <div
                        className={`text-xs ${
                          isUser ? "text-stone-300" : "text-stone-500"
                        } font-mono mb-1 opacity-0 group-hover:opacity-100 transition-opacity`}
                      >
                        {timestamp}
                      </div>
                      <div className={`whitespace-pre-wrap text-sm leading-relaxed ${messageStyle}`}>
                        <ReactMarkdown>{displayTitle}</ReactMarkdown>
                      </div>
                    </div>
                    {guardrailResult && (
                      <div className="bg-stone-800/50 border border-stone-700/40 px-3 py-2 rounded-b-2xl">
                        <GuardrailChip guardrailResult={guardrailResult} />
                      </div>
                    )}
                  </div>
                </div>
              );
            } else if (type === "BREADCRUMB") {
              return (
                <div
                  key={itemId}
                  className="flex flex-col justify-start items-start text-stone-400 text-sm"
                >
                  <span className="text-xs font-mono text-stone-500">{timestamp}</span>
                  <div
                    className={`whitespace-pre-wrap flex items-center font-mono text-sm text-stone-300 ${
                      data ? "cursor-pointer hover:text-stone-200" : ""
                    }`}
                    onClick={() => data && toggleTranscriptItemExpand(itemId)}
                  >
                    {data && (
                      <span
                        className={`text-stone-500 mr-1 transform transition-transform duration-200 select-none font-mono ${
                          expanded ? "rotate-90" : "rotate-0"
                        }`}
                      >
                        ▶
                      </span>
                    )}
                    {title}
                  </div>
                  {expanded && data && (
                    <div className="text-stone-300 text-left">
                      <pre className="border-l-2 ml-1 border-stone-600 whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2 bg-stone-800/50 p-2 rounded">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            } else {
              // Fallback if type is neither MESSAGE nor BREADCRUMB
              return (
                <div
                  key={itemId}
                  className="flex justify-center text-stone-500 text-sm italic font-mono"
                >
                  Unknown item type: {type}{" "}
                  <span className="ml-2 text-xs">{timestamp}</span>
                </div>
              );
            }
          })}
        </div>
      </div>

      <div className="p-6 flex items-center gap-3 flex-shrink-0 border-t border-stone-700/40 bg-stone-800/40">
        <input
          ref={inputRef}
          type="text"
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend) {
              onSendMessage();
            }
          }}
          className="flex-1 px-4 py-3 focus:outline-none border border-stone-600/30 rounded-lg bg-stone-700/30 text-stone-50 placeholder-stone-500 focus:border-stone-500 focus:ring-1 focus:ring-stone-500"
          placeholder="Ask about planets, stars, or observation planning..."
        />
        <button
          onClick={onSendMessage}
          disabled={!canSend || !userText.trim()}
          className="bg-stone-700/40 hover:bg-stone-600/40 text-stone-300 rounded-full p-3 disabled:opacity-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default Transcript;
