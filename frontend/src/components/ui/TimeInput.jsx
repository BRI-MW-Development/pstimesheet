import { useState, useEffect, useRef } from 'react';

// Parse freeform time text → "HH:mm" (24-hr) or '' on failure.
// Accepts: "8", "8a", "8p", "830", "830a", "8:30", "8:30am", "08:30 AM",
//          "1430", "14:30" (24-hr pass-through)
function parseTime(raw) {
  if (!raw) return '';
  const s = raw.trim().toLowerCase().replace(/\s/g, '');

  const amFlag = s.endsWith('am') || s.endsWith('a');
  const pmFlag = s.endsWith('pm') || s.endsWith('p');
  const digits = s.replace(/[^0-9:]/g, '');

  let h, m;

  if (digits.includes(':')) {
    [h, m] = digits.split(':').map(Number);
  } else if (digits.length <= 2) {
    h = Number(digits); m = 0;
  } else if (digits.length === 3) {
    h = Number(digits[0]); m = Number(digits.slice(1));
  } else {
    h = Number(digits.slice(0, 2)); m = Number(digits.slice(2, 4));
  }

  if (isNaN(h) || isNaN(m) || m > 59) return '';

  // 24-hr pass-through if no am/pm and h > 12
  if (!amFlag && !pmFlag) {
    if (h > 23 || h < 0) return '';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  if (h === 0 || h > 12) return '';
  if (amFlag) { if (h === 12) h = 0; }
  else        { if (h !== 12) h += 12; }

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Format "HH:mm" → "8:30 AM"
function fmt(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function TimeInput({ value, onChange, className = '', style }) {
  const [text, setText]       = useState(fmt(value));
  const [invalid, setInvalid] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      setText(fmt(value));
      setInvalid(false);
      prevValue.current = value;
    }
  }, [value]);

  const commit = () => {
    if (!text.trim()) {
      setInvalid(false);
      prevValue.current = '';
      onChange('');
      return;
    }
    const parsed = parseTime(text);
    if (parsed) {
      const display = fmt(parsed);
      setText(display);
      setInvalid(false);
      prevValue.current = parsed;
      onChange(parsed);
    } else {
      setInvalid(true);
    }
  };

  return (
    <input
      type="text"
      className={`time-text-12h${invalid ? ' is-invalid' : ''} ${className}`}
      style={style}
      value={text}
      placeholder="8:30 AM"
      onChange={(e) => { setText(e.target.value); setInvalid(false); }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') commit(); }}
    />
  );
}
