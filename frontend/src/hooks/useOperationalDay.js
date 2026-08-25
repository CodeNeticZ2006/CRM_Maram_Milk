import { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * useOperationalDay — Shared React hook for 7:00 PM IST Operational Day
 *
 * Returns the active operational day from the backend (source of truth).
 * Refreshes every 60 seconds to detect rollovers without page refresh.
 *
 * Usage:
 *   const { operationalDate, displayDate, status, loading } = useOperationalDay();
 *   // operationalDate: '2026-08-26'   — for API params
 *   // displayDate:     '26-Aug-2026'  — for UI display
 */
export default function useOperationalDay() {
  const [operationalDate, setOperationalDate] = useState('');
  const [displayDate, setDisplayDate] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);

  const fetchOpDay = async () => {
    try {
      const res = await api.get('/operational-day/current');
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setOperationalDate(d.date || '');
        setDisplayDate(d.displayDate || d.formattedDate || d.date || '');
        setStatus(d.status || 'ACTIVE');
      }
    } catch (err) {
      // Fallback: compute IST operational date client-side using 7 PM IST boundary
      // This is only a fallback — backend remains source of truth
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit',
        }).formatToParts(new Date());
        const map = {};
        parts.forEach(p => { map[p.type] = p.value; });
        const hour = parseInt(map.hour, 10);
        let opDate;
        if (hour >= 19) {
          // At or after 7 PM IST → next day is operational day
          const next = new Date();
          next.setDate(next.getDate() + 1);
          opDate = next.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        } else {
          opDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        }
        if (opDate && !operationalDate) {
          setOperationalDate(opDate);
          // Format as DD-MMM-YYYY
          const [y, m, d2] = opDate.split('-');
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          setDisplayDate(`${parseInt(d2)}-${months[parseInt(m)-1]}-${y}`);
        }
      } catch (_) { /* ignore */ }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpDay();
    const interval = setInterval(fetchOpDay, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  return { operationalDate, displayDate, status, loading, refresh: fetchOpDay };
}
