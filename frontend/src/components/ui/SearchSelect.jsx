import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Searchable dropdown that renders its list via a Portal (position:fixed)
 * so it escapes parent overflow:hidden in modals.
 *
 * Props:
 *   options    — [{ value, label }]
 *   value      — currently selected value (or null)
 *   onChange   — (value) => void
 *   placeholder
 *   disabled
 */
export default function SearchSelect({ options = [], value, onChange, placeholder = 'Select…', disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const selected = options.find((o) => o.value === value);
  // triggerLabel: what to show in the closed button (defaults to label)
  const triggerText = selected ? (selected.triggerLabel ?? selected.label) : placeholder;

  function openDropdown() {
    if (disabled) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
    setQuery('');
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const q = query.toLowerCase().trim();
  const filtered = !q ? options : options.filter((o) => {
    const label = o.label.toLowerCase();
    if (!o.search) return label.includes(q);
    // token-start match: split label and name by spaces+hyphens, check if any token starts with query
    const tokens = o.search.toLowerCase().split(/[\s-]+/).filter(Boolean);
    return tokens.some((t) => t.startsWith(q));
  });

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`search-select-trigger${open ? ' open' : ''}${disabled ? ' disabled' : ''}`}
        onClick={openDropdown}
        disabled={disabled}
      >
        <span className={selected ? '' : 'placeholder'}>
          {triggerText}
        </span>
        <span className="search-select-arrow">▾</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="search-select-dropdown"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
            }}
          >
            <input
              ref={inputRef}
              className="search-select-input"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="search-select-list">
              {filtered.length === 0 ? (
                <li className="search-select-empty">No results</li>
              ) : (
                filtered.map((o, i) => (
                  <li
                    key={`${i}-${o.value}`}
                    className={`search-select-item${o.value === value ? ' selected' : ''}`}
                    onMouseDown={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    {o.label}
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}
