import { useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useTranscript } from '../contexts/TranscriptContext';
import { useEvent } from '../contexts/EventContext';
import { useCamera } from '../contexts/CameraContext';
import { TranscriptItem, GuardrailResultType } from '../types/chat';

export function useHandleSessionHistory() {
  const { addTranscriptMessage, updateTranscriptMessage, addTranscriptBreadcrumb, updateTranscriptItem } = useTranscript();
  const { logServerEvent } = useEvent();
  
  // Use camera context directly since it's now available at page level
  const { pointToPlanet } = useCamera();
  
  // Track processed tool calls to prevent duplicates
  const processedToolCallsRef = useRef<Set<string>>(new Set());

  const handleTranscriptionCompleted = useCallback((event: any) => {
    const { item_id, transcript } = event;
    if (item_id && transcript) {
      addTranscriptMessage(item_id, "user", transcript, false);
    }
    logServerEvent(event, "transcription_completed");
  }, [addTranscriptMessage, logServerEvent]);

  const handleTranscriptionDelta = useCallback((event: any) => {
    const { item_id, delta } = event;
    if (item_id && delta) {
      updateTranscriptMessage(item_id, delta, true);
    }
    logServerEvent(event, "transcription_delta");
  }, [updateTranscriptMessage, logServerEvent]);

  const handleAgentToolStart = useCallback((event: any) => {
    // Extract tool call from the history array
    const history = event.context?.history || [];
    const lastFunctionCall = history.find((item: any) => item.type === 'function_call' && item.status === 'completed');
    
    if (lastFunctionCall) {
      const { name, arguments: args } = lastFunctionCall;
      let parsedArgs;
      
      try {
        parsedArgs = JSON.parse(args);
      } catch (error) {
        console.error('Failed to parse tool arguments:', error);
        parsedArgs = { error: 'Failed to parse arguments' };
      }
      
      const toolId = uuidv4();
      addTranscriptBreadcrumb(`Tool: ${name}`, parsedArgs);
    }
    
    logServerEvent(event, "tool_start");
  }, [addTranscriptBreadcrumb, logServerEvent]);

  const handleAgentToolEnd = useCallback((event: any) => {
    // Extract tool results from the history array
    const history = event.context?.history || [];
    const lastFunctionCall = history.find((item: any) => item.type === 'function_call' && item.status === 'completed');
    
    if (lastFunctionCall) {
      const { name, output, itemId } = lastFunctionCall;
      
      // Create unique key for this tool call
      const toolCallKey = `${name}-${itemId}`;

      // Skip if we've already processed this tool call
      if (processedToolCallsRef.current.has(toolCallKey)) {
        return;
      }
      
      // Mark as processed
      processedToolCallsRef.current.add(toolCallKey);
      
      let result;
      
      try {
        result = JSON.parse(output);
      } catch (error) {
        console.error('Failed to parse tool output:', error);
        result = { error: 'Failed to parse tool output' };
      }
      
      // Trigger camera animation for point_to_planet tool
      if (name === 'point_to_planet' && result?.success) {
        console.log('[useHandleSessionHistory] point_to_planet tool completed successfully');
        console.log('[useHandleSessionHistory] Tool result:', result);
        try {
          console.log(`[useHandleSessionHistory] Calling pointToPlanet for ${result.planet}`);
          pointToPlanet(result.planet.toLowerCase(), result.altitude, result.azimuth);
        } catch (error) {
          console.error('[useHandleSessionHistory] Error triggering camera animation:', error);
        }
      }
      
      addTranscriptBreadcrumb(`Tool Result: ${name}`, result);
    }
    
    logServerEvent(event, "tool_end");
  }, [addTranscriptBreadcrumb, logServerEvent, pointToPlanet]);

  const handleHistoryUpdated = useCallback((event: any) => {
    const { history } = event;
    if (history && history.length > 0) {
      const lastMessage = history[history.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.content) {
        const messageId = lastMessage.id || uuidv4();
        const content = lastMessage.content.map((c: any) => c.text || c.transcript || '').join('');
        addTranscriptMessage(messageId, "assistant", content, false);
      }
    }
    logServerEvent(event, "history_updated");
  }, [addTranscriptMessage, logServerEvent]);

  const handleHistoryAdded = useCallback((event: any) => {
    const { item } = event;
    if (item && item.role === 'assistant' && item.content) {
      const messageId = item.id || uuidv4();
      const content = item.content.map((c: any) => c.text || c.transcript || '').join('');
      addTranscriptMessage(messageId, "assistant", content, false);
    }
    logServerEvent(event, "history_added");
  }, [addTranscriptMessage, logServerEvent]);

  const handleGuardrailTripped = useCallback((event: any) => {
    const { item_id, guardrail_result } = event;
    if (item_id && guardrail_result) {
      const guardrailData: GuardrailResultType = {
        status: "DONE",
        category: guardrail_result.category,
        rationale: guardrail_result.rationale,
        testText: guardrail_result.testText,
      };
      updateTranscriptItem(item_id, { guardrailResult: guardrailData });
    }
    logServerEvent(event, "guardrail_tripped");
  }, [updateTranscriptItem, logServerEvent]);

  return useRef({
    handleTranscriptionCompleted,
    handleTranscriptionDelta,
    handleAgentToolStart,
    handleAgentToolEnd,
    handleHistoryUpdated,
    handleHistoryAdded,
    handleGuardrailTripped,
  });
}
