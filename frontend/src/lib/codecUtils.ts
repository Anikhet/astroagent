// WebRTC codec utilities for audio quality control
export function applyCodecPreferences(pc: RTCPeerConnection, codec: string): RTCPeerConnection {
  if (!pc.getTransceivers) {
    return pc;
  }

  const transceivers = pc.getTransceivers();
  transceivers.forEach((transceiver) => {
    if (transceiver.sender && transceiver.sender.track) {
      const params = transceiver.sender.getParameters();
      if (params.codecs) {
        // Reorder codecs to prefer the selected one
        const preferredCodec = params.codecs.find(c => 
          c.mimeType.toLowerCase().includes(codec.toLowerCase())
        );
        
        if (preferredCodec) {
          const otherCodecs = params.codecs.filter(c => c !== preferredCodec);
          params.codecs = [preferredCodec, ...otherCodecs];
          transceiver.sender.setParameters(params);
        }
      }
    }
  });

  return pc;
}

export function getCodecFromUrl(): string {
  if (typeof window === 'undefined') return 'opus';
  
  const urlParams = new URLSearchParams(window.location.search);
  const codec = urlParams.get('codec');
  return codec?.toLowerCase() || 'opus';
}

export function setCodecInUrl(codec: string): void {
  if (typeof window === 'undefined') return;
  
  const url = new URL(window.location.toString());
  url.searchParams.set('codec', codec);
  window.history.replaceState({}, '', url.toString());
}
