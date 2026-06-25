import { useEffect } from 'react';

/**
 * Full-screen lightbox for previewing a single file attachment.
 *
 * Props:
 *   file     – { src: string, name: string, mimeType: string }
 *              src must be a data-URI (data:image/...;base64,...)
 *   onClose  – called when the overlay or × is clicked
 *   onDownload – optional; if provided, a "Download" button is shown
 */
export default function FileLightbox({ file, onClose, onDownload }) {
  // Close on Escape
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!file) return null;
  const isImage = file.mimeType?.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(file.name);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,.82)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out', padding: 16,
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: 14, right: 18, background: 'none', border: 'none', color: '#fff', fontSize: 30, cursor: 'pointer', lineHeight: 1, zIndex: 1 }}
      >×</button>

      {/* File name */}
      <div style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 600, marginBottom: 10, maxWidth: '80vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.name}
      </div>

      {/* Content */}
      {isImage ? (
        <img
          src={file.src}
          alt={file.name}
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '90vw', maxHeight: '78vh', borderRadius: 8, boxShadow: '0 24px 64px rgba(0,0,0,.6)', objectFit: 'contain', cursor: 'default' }}
        />
      ) : (
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: '#1e293b', borderRadius: 12, padding: '36px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
        >
          <div style={{ fontSize: 56 }}>📄</div>
          <div style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600 }}>{file.name}</div>
        </div>
      )}

      {/* Download button */}
      {onDownload && (
        <button
          onClick={e => { e.stopPropagation(); onDownload(); }}
          style={{
            marginTop: 16, padding: '8px 22px', borderRadius: 8,
            background: '#2563eb', color: '#fff', border: 'none',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          ↓ Download
        </button>
      )}
    </div>
  );
}
