import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 16,
      color: 'var(--text2)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 64, fontWeight: 700, color: 'var(--text3)', lineHeight: 1 }}>404</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text1)' }}>Page Not Found</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 320 }}>
        The page you were looking for doesn't exist or has been moved.
      </div>
      <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>
        Go to Dashboard
      </button>
    </div>
  );
}
