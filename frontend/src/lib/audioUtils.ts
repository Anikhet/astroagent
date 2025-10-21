// Audio utilities for recording and playback
export interface AudioFormat {
  sampleRate: number;
  channels: number;
}

export const AUDIO_FORMATS = {
  opus: { sampleRate: 48000, channels: 1 },
  pcmu: { sampleRate: 8000, channels: 1 },
  pcma: { sampleRate: 8000, channels: 1 },
} as const;

export function audioFormatForCodec(codec: string): AudioFormat {
  const normalizedCodec = codec.toLowerCase();
  return AUDIO_FORMATS[normalizedCodec as keyof typeof AUDIO_FORMATS] || AUDIO_FORMATS.opus;
}

export function createAudioElement(): HTMLAudioElement {
  const audioElement = document.createElement('audio');
  audioElement.autoplay = true;
  audioElement.style.display = 'none';
  document.body.appendChild(audioElement);
  return audioElement;
}

export function cleanupAudioElement(audioElement: HTMLAudioElement): void {
  if (audioElement && audioElement.parentNode) {
    audioElement.parentNode.removeChild(audioElement);
  }
}

export function startAudioRecording(stream: MediaStream): MediaRecorder | null {
  try {
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    });
    return mediaRecorder;
  } catch (error) {
    console.error('Failed to create MediaRecorder:', error);
    return null;
  }
}

export function downloadAudioBlob(blob: Blob, filename: string = 'recording.webm'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}



