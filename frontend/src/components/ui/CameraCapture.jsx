import { useEffect, useRef, useState } from 'react';

/**
 * In-browser camera modal using getUserMedia.
 * Works on desktop (webcam) and mobile (front/back camera).
 *
 * Props:
 *   onCapture(dataUrl, mimeType, fileName) — called when user takes a photo
 *   onClose() — called when modal is dismissed
 */
export default function CameraCapture({ onCapture, onClose }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' = back, 'user' = front
  const [error,      setError]      = useState('');
  const [capturing,  setCapturing]  = useState(false);
  const [preview,    setPreview]    = useState(null); // dataUrl after capture

  async function startCamera(mode) {
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setError('');
    setPreview(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setError('Camera not available. Please allow camera access or use "Upload File" instead.');
    }
  }

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [facingMode]);

  function capture() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setPreview(dataUrl);
    // Pause stream while showing preview
    if (streamRef.current) streamRef.current.getTracks().forEach(t => { t.enabled = false; });
  }

  function retake() {
    setPreview(null);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => { t.enabled = true; });
  }

  function confirm() {
    if (!preview) return;
    setCapturing(true);
    const ts   = Date.now();
    const name = `qc-photo-${ts}.jpg`;
    onCapture(preview, 'image/jpeg', name);
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#111827', borderRadius: 12, overflow: 'hidden', width: '100%', maxWidth: 520, boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>

        {/* Title bar */}
        <div style={{ background: '#1e293b', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>📷 Camera Capture</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* Viewfinder */}
        <div style={{ position: 'relative', background: '#000', aspectRatio: '4/3', overflow: 'hidden' }}>
          {!preview ? (
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: error ? 'none' : 'block' }} />
          ) : (
            <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
                <div style={{ color: '#f87171', fontSize: 13, lineHeight: 1.6 }}>{error}</div>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Flip camera button — top right */}
          {!preview && !error && (
            <button onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
              style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '7px 10px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              🔄 {facingMode === 'environment' ? 'Front' : 'Back'}
            </button>
          )}
        </div>

        {/* Controls */}
        <div style={{ padding: '14px 16px', display: 'flex', gap: 10, justifyContent: 'center', background: '#0f172a' }}>
          {!preview ? (
            <>
              <button onClick={onClose}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={capture} disabled={!!error}
                style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: error ? '#374151' : '#0f7173', color: '#fff', fontSize: 14, fontWeight: 700, cursor: error ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>⊙</span> Capture Photo
              </button>
            </>
          ) : (
            <>
              <button onClick={retake}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ↩ Retake
              </button>
              <button onClick={confirm} disabled={capturing}
                style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                ✓ Use This Photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
