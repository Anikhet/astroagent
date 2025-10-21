import { useRef, useCallback, useState } from 'react';
import { startAudioRecording, downloadAudioBlob } from '../lib/audioUtils';

export function useAudioDownload() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback((stream: MediaStream) => {
    if (mediaRecorderRef.current) {
      return; // Already recording
    }

    const mediaRecorder = startAudioRecording(stream);
    if (!mediaRecorder) {
      console.error('Failed to create MediaRecorder');
      return;
    }

    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      setRecordedBlob(audioBlob);
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setIsRecording(false);
    };

    mediaRecorder.start(1000); // Collect data every second
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const downloadRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      stopRecording();
    } else if (recordedBlob) {
      downloadAudioBlob(recordedBlob, `recording-${Date.now()}.webm`);
      setRecordedBlob(null);
    }
  }, [stopRecording, recordedBlob]);

  return {
    startRecording,
    stopRecording,
    downloadRecording,
    isRecording,
  };
}

