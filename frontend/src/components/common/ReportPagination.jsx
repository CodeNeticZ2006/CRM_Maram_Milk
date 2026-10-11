import React from 'react';

/**
 * Reusable Windowed Pagination for Reports
 * Prevents horizontal overflow when totalPages is large (e.g. 50+ pages).
 */
export default function ReportPagination({ page, totalPages, onPageChange, loading = false }) {
  if (!totalPages || totalPages <= 1) return null;

  const delta = 2;
  const left = Math.max(1, page - delta);
  const right = Math.min(totalPages, page + delta);
  const range = [];

  if (left > 1) {
    range.push(1);
    if (left > 2) range.push('...');
  }

  for (let i = left; i <= right; i++) {
    range.push(i);
  }

  if (right < totalPages) {
    if (right < totalPages - 1) range.push('...');
    range.push(totalPages);
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginTop: 24,
        flexWrap: 'wrap',
      }}
    >
      <button
        type="button"
        onClick={() => onPageChange(Math.max(page - 1, 1))}
        disabled={page === 1 || loading}
        className="btn btn-outline"
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 14,
          cursor: page === 1 ? 'not-allowed' : 'pointer',
        }}
      >
        «
      </button>

      {range.map((item, idx) => {
        if (item === '...') {
          return (
            <span
              key={`dots-${idx}`}
              style={{
                padding: '6px 8px',
                color: 'var(--text-muted)',
                fontSize: 14,
                userSelect: 'none',
              }}
            >
              ...
            </span>
          );
        }
        const pNum = Number(item);
        const isActive = page === pNum;
        return (
          <button
            key={pNum}
            type="button"
            onClick={() => onPageChange(pNum)}
            disabled={loading}
            className={isActive ? 'btn btn-primary' : 'btn btn-outline'}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: isActive ? 700 : 500,
              backgroundColor: isActive ? 'var(--primary)' : 'transparent',
              color: isActive ? '#fff' : 'var(--text-main)',
              minWidth: 36,
            }}
          >
            {pNum}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(page + 1, totalPages))}
        disabled={page === totalPages || loading}
        className="btn btn-outline"
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 14,
          cursor: page === totalPages ? 'not-allowed' : 'pointer',
        }}
      >
        »
      </button>
    </div>
  );
}
