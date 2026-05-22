import { useState, useMemo, useEffect } from 'react';

const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none"
    style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af' }}>
    <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
    <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export function WipListHeader({ title, count, search, onSearch, actions }) {
  return (
    <div className="wip-list-header">
      <div>
        <div className="wip-list-title">{title}</div>
        {count != null && (
          <div className="wip-list-meta">{count} {count === 1 ? 'item' : 'items'}</div>
        )}
      </div>
      <div className="wip-list-actions">
        {onSearch && (
          <div className="wip-search-wrap">
            <SearchIcon />
            <input
              className="wip-search-input"
              placeholder="Search this list"
              value={search ?? ''}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        )}
        {actions}
      </div>
    </div>
  );
}

function SortIcon({ dir }) {
  if (dir === 'asc') return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ marginLeft: 4, flexShrink: 0 }}>
      <path d="M5 2 L9 8 L1 8 Z" />
    </svg>
  );
  if (dir === 'desc') return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ marginLeft: 4, flexShrink: 0 }}>
      <path d="M5 8 L9 2 L1 2 Z" />
    </svg>
  );
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ marginLeft: 4, flexShrink: 0, opacity: 0.35 }}>
      <path d="M5 1 L8 4.5 L2 4.5 Z" />
      <path d="M5 9 L8 5.5 L2 5.5 Z" />
    </svg>
  );
}

function getValue(row, col) {
  if (col.sortValue) return col.sortValue(row);
  const v = row[col.key];
  if (v == null) return '';
  return typeof v === 'string' ? v.toLowerCase() : v;
}

export default function Table({ columns, data, loading, emptyText = 'No records found.', pageSize }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  // Reset to first page whenever the data or page size changes
  useEffect(() => { setPage(1); }, [data, pageSize]);

  function handleSort(col) {
    if (col.sort === false || col.num) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
    setPage(1);
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;
    return [...data].sort((a, b) => {
      const av = getValue(a, col);
      const bv = getValue(b, col);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir, columns]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage   = Math.min(page, totalPages);
  const visible    = pageSize
    ? sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
    : sorted;

  if (loading) return <div className="table-loading">Loading…</div>;

  return (
    <div className="wip-table-wrap">
      <table className="wip-table">
        <thead>
          <tr>
            {columns.map((col) => {
              const sortable = !col.num && col.sort !== false;
              const isActive = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  className={col.num ? 'wip-th-num' : sortable ? 'wip-th-sort' : undefined}
                  style={{
                    ...(col.width ? { width: col.width } : {}),
                    ...(sortable ? { cursor: 'pointer', userSelect: 'none' } : {}),
                    ...(isActive ? { color: 'var(--accent)' } : {}),
                  }}
                  onClick={() => handleSort(col)}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    {col.label}
                    {sortable && <SortIcon dir={isActive ? sortDir : null} />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="table-empty">{emptyText}</td>
            </tr>
          ) : (
            visible.map((row, i) => (
              <tr key={row.id ?? row._id ?? i}>
                {columns.map((col) => (
                  <td key={col.key} className={col.num ? 'wip-td-num' : undefined}>
                    {col.render ? col.render(row, (safePage - 1) * (pageSize ?? 0) + i) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {pageSize && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px 2px', fontSize: 13, color: 'var(--text2)' }}>
          <span>
            Showing {((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              style={pagerBtn(safePage === 1)}
              title="First page"
            >«</button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              style={pagerBtn(safePage === 1)}
            >‹ Prev</button>
            <span style={{ padding: '0 8px', fontWeight: 500, color: 'var(--text)' }}>
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              style={pagerBtn(safePage === totalPages)}
            >Next ›</button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              style={pagerBtn(safePage === totalPages)}
              title="Last page"
            >»</button>
          </div>
        </div>
      )}
    </div>
  );
}

function pagerBtn(disabled) {
  return {
    padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid var(--border2)',
    background: 'var(--surface)', color: disabled ? 'var(--text3, #bbb)' : 'var(--text)',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
  };
}
