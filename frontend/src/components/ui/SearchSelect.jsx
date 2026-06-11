import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const DROPDOWN_MAX_H = 260; // px — container max height (input ~30px + list 220px + breathing room)
const GAP = 4;              // px — gap between trigger bottom and dropdown top

export default function SearchSelect({ options = [], value, onChange, placeholder = 'Select…', disabled }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 0, openUp: false });
  const triggerRef  = useRef(null);
  const inputRef    = useRef(null);
  const dropdownRef = useRef(null);

  const selected    = options.find((o) => o.value === value);
  const triggerText = selected ? (selected.triggerLabel ?? selected.label) : placeholder;

  /* ── Calculate where to place the dropdown ── */
  function calcPos() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    // Open upward if not enough room below AND more room above
    const openUp = spaceBelow < DROPDOWN_MAX_H && spaceAbove > spaceBelow;
    return {
      left:   rect.left,       // viewport-relative for position:fixed
      width:  rect.width,
      openUp,
      // For downward: top = trigger bottom. For upward: bottom = viewport height - trigger top
      top:    openUp ? undefined : rect.bottom + GAP,
      bottom: openUp ? vh - rect.top + GAP : undefined,
    };
  }

  function openDropdown() {
    if (disabled) return;
    const p = calcPos();
    if (!p) return;
    setPos(p);
    setQuery('');
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  /* ── Close on outside mousedown ── */
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target))
        setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  /* ── Close when an ancestor scrolls, but NOT when the dropdown list itself scrolls ── */
  useEffect(() => {
    if (!open) return;
    function onScroll(e) {
      if (dropdownRef.current?.contains(e.target)) return; // scroll inside dropdown list — keep open
      setOpen(false);
    }
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

  /* ── Filter ── */
  const q = query.toLowerCase().trim();
  const filtered = !q ? options : options.filter((o) =>
    (o.search ?? o.label).toLowerCase().includes(q)
  );

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`search-select-trigger${open ? ' open' : ''}${disabled ? ' disabled' : ''}`}
        onClick={openDropdown}
        disabled={disabled}
      >
        <span className={selected ? '' : 'placeholder'}>{triggerText}</span>
        <span className="search-select-arrow">▾</span>
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="search-select-dropdown"
          style={{
            position:  'fixed',
            left:      pos.left,
            width:     pos.width,
            zIndex:    9999,
            maxHeight: DROPDOWN_MAX_H,
            // Downward or upward
            ...(pos.openUp
              ? { bottom: pos.bottom, top: 'auto' }
              : { top: pos.top,       bottom: 'auto' }),
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
                  onMouseDown={() => { onChange(o.value); setOpen(false); }}
                >
                  {o.label}
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}
