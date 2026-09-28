import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MdBarChart, MdInfoOutline, MdOutlineAnalytics } from 'react-icons/md';

export default function ReportPlaceholderPage({ title: propTitle, group: propGroup }) {
  const location = useLocation();

  // Fallback title formatting from pathname if prop is omitted
  const pathParts = location.pathname.split('/').filter(Boolean);
  const rawTitle = pathParts[pathParts.length - 1] || 'Report';
  const formattedTitle = propTitle || rawTitle.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* Header Breadcrumb & Title */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted, #64748b)', fontWeight: 600, marginBottom: 6 }}>
            Reports &nbsp;&rsaquo;&nbsp; {propGroup || 'Report Navigation'}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #1e293b)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdBarChart style={{ color: 'var(--primary, #3b82f6)' }} />
            {formattedTitle}
          </h1>
          <p style={{ color: 'var(--text-muted, #64748b)', fontSize: 14, marginTop: 4 }}>
            SuperAdmin CRM Report Navigation Placeholder
          </p>
        </div>

        {/* Info Card */}
        <div
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '12px',
            padding: '40px 32px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--primary, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28
            }}
          >
            <MdOutlineAnalytics />
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary, #1e293b)', margin: 0 }}>
            {formattedTitle}
          </h3>

          <p style={{ color: 'var(--text-muted, #64748b)', fontSize: 14, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
            This navigation item has been successfully structured in the SuperAdmin CRM sidebar under the <strong>{propGroup || 'Reports'}</strong> section.
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.2)',
              color: '#b45309',
              fontSize: 13,
              fontWeight: 500,
              marginTop: 8
            }}
          >
            <MdInfoOutline style={{ fontSize: 16 }} />
            <span>Placeholder Navigation Entry — No Backend/API logic attached at this stage.</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
