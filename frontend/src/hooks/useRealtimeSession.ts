import { useCallback, useRef, useState } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

import { applyCodecPreferences } from '../lib/codecUtils';
import { useEvent } from '../contexts/EventContext';
import { useHandleSessionHistory } from './useHandleSessionHistory';
import { SessionStatus } from '../types/chat';

export interface RealtimeSessionCallbacks {
  onConnectionChange?: (status: SessionStatus) => void;
  onAgentHandoff?: (agentName: string) => void;
}

export interface ConnectOptions {
  getEphemeralKey: () => Promise<string>;
  initialAgents: RealtimeAgent[];
  audioElement?: HTMLAudioElement;
  extraContext?: Record<string, any>;
  outputGuardrails?: any[];
}

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
      case "conversation.item.input_audio_transcription.delta": {
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

  const codecParamRef = useRef<string>(
    (typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('codec') ?? 'opus')
      : 'opus')
      .toLowerCase(),
  );

  // Wrapper to pass current codec param
  const applyCodec = useCallback(
    (pc: RTCPeerConnection) => applyCodecPreferences(pc, codecParamRef.current),
    [],
  );

  const handleAgentHandoff = useCallback((contextOrAgent: any, agent?: any, handoffAgent?: any) => {
    const history = contextOrAgent?.context?.history ?? contextOrAgent?.history ?? [];
    const lastMessage = history[history.length - 1];
    const rawName = lastMessage?.name;
    if (typeof rawName === 'string') {
      const agentName = rawName.split('transfer_to_')[1];
      if (agentName) {
        callbacks.onAgentHandoff?.(agentName);
        return;
      }
    }
    const fallbackName = handoffAgent?.name ?? agent?.name;
    if (typeof fallbackName === 'string') {
      callbacks.onAgentHandoff?.(fallbackName);
    }
  }, [callbacks]);

  const attachSessionListeners = useCallback((session: RealtimeSession | null) => {
    if (!session) return;

    listenersCleanupRef.current?.();

    const onError = (...args: unknown[]) => {
      const [message] = args;
      logServerEvent({
        type: "error",
        message,
      });
    };

    session.on("error", onError);
    session.on("agent_handoff", handleAgentHandoff);
    session.on("agent_tool_start", handleAgentToolStart);
    session.on("agent_tool_end", handleAgentToolEnd);
    session.on("history_updated", handleHistoryUpdated);
    session.on("history_added", handleHistoryAdded);
    session.on("guardrail_tripped", handleGuardrailTripped);
    session.on("transport_event", handleTransportEvent);

    listenersCleanupRef.current = () => {
      session.off("error", onError);
      session.off("agent_handoff", handleAgentHandoff);
      session.off("agent_tool_start", handleAgentToolStart);
      session.off("agent_tool_end", handleAgentToolEnd);
      session.off("history_updated", handleHistoryUpdated);
      session.off("history_added", handleHistoryAdded);
      session.off("guardrail_tripped", handleGuardrailTripped);
      session.off("transport_event", handleTransportEvent);
    };
  }, [
    handleAgentHandoff,
    handleAgentToolStart,
    handleAgentToolEnd,
    handleHistoryUpdated,
    handleHistoryAdded,
    handleGuardrailTripped,
    handleTransportEvent,
    logServerEvent,
  ]);

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

  const assertconnected = () => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
  };

  /* ----------------------- message helpers ------------------------- */

  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);
  
  const sendUserText = useCallback((text: string) => {
    assertconnected();
    sessionRef.current!.sendMessage(text);
  }, []);

  const sendEvent = useCallback((ev: any) => {
    sessionRef.current?.transport.sendEvent(ev);
  }, []);

  const mute = useCallback((m: boolean) => {
    sessionRef.current?.mute(m);
  }, []);

  const pushToTalkStart = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.clear' } as any);
  }, []);

  const pushToTalkStop = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.commit' } as any);
    sessionRef.current.transport.sendEvent({ type: 'response.create' } as any);
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    mute,
    pushToTalkStart,
    pushToTalkStop,
    interrupt,
  } as const;
}
