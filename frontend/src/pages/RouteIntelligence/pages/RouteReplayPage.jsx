import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  MdPerson, MdCalendarToday, MdRoute, MdRefresh
} from 'react-icons/md';
import { SectionHeader, RoutePlayer, RouteReplayCard } from '../components/index.jsx';
import api from '../../../services/api';
import { MOCK_DELIVERY_PARTNERS, MOCK_REPLAY_EVENTS } from '../utils/mockData.js';
import { getAreaColor } from '../utils/areaPalette.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function RouteReplayPage() {
  const [dpList, setDpList]           = useState(MOCK_DELIVERY_PARTNERS);
  const [selectedDP, setSelectedDP]   = useState(MOCK_DELIVERY_PARTNERS[0].id);
  const [selectedDate, setSelectedDate] = useState('2026-11-23');
  const [loading, setLoading]         = useState(true);
  const [isDb2Loaded, setIsDb2Loaded] = useState(false);
  const [replayStream, setReplayStream] = useState(null);
  const [corridorPolyline, setCorridorPolyline] = useState([]);

  // Fetch DPs and corridor polyline
  const fetchReplayData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, corridorsRes, demoRes] = await Promise.all([
        api.get('/route-intelligence/replay').catch(() => null),
        api.get('/route-intelligence/route-corridors').catch(() => null),
        api.get('/route-intelligence/demo/replay-stream', { params: { dpId: selectedDP } }).catch(() => null),
      ]);

      if (res?.data?.success && res?.data?.data?.deliveryPartners?.length > 0) {
        const db2Dps = res.data.data.deliveryPartners;
        setDpList(db2Dps);
        if (db2Dps.length > 0 && !db2Dps.find(d => d.id === selectedDP)) {
          setSelectedDP(db2Dps[0].id);
        }
        setIsDb2Loaded(true);
      }

      // Check if demo replay stream has telemetry for this DP
      if (demoRes?.data?.success && demoRes.data?.data) {
        setReplayStream(demoRes.data.data);
      } else {
        setReplayStream(null);
      }

      // Set corridor polyline if available
      if (corridorsRes?.data?.success && Array.isArray(corridorsRes.data?.data?.routes)) {
        const currentDp = dpList.find(d => d.id === selectedDP);
        const matchRoute = corridorsRes.data.data.routes.find(
          r => r.id === currentDp?.route || r.name === currentDp?.route || r.id === currentDp?.zone || r.name === currentDp?.zone
        );
        if (matchRoute && matchRoute.polyline) {
          setCorridorPolyline(matchRoute.polyline);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch DB2 replay list:', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDP]);

  useEffect(() => {
    fetchReplayData();
  }, [fetchReplayData]);

  const dp = dpList.find(d => d.id === selectedDP) || dpList[0];
  const areaColor = getAreaColor(dp?.route || dp?.zone || 'Nungambakkam 1');
  const pings = replayStream?.pings || [];
  const isSimulated = Boolean(replayStream?.pings?.length > 0 && replayStream?.dpId?.startsWith('SIM'));

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Route Replay"
        subtitle={
          <span>
            Replay historical delivery routes with a step-by-step event timeline
            {isDb2Loaded && <span className="badge badge-success" style={{ marginLeft: 10, fontSize: 11 }}>Connected to DB2</span>}
            {isSimulated && <span className="badge" style={{ marginLeft: 8, fontSize: 11, background: '#fef3c7', color: '#b45309' }}>SIMULATION TELEMETRY</span>}
          </span>
        }
      >
        <button className="btn btn-secondary btn-sm" onClick={fetchReplayData} disabled={loading}>
          <MdRefresh className={loading ? 'spin' : ''} /> {loading ? 'Syncing...' : 'Refresh'}
        </button>
      </SectionHeader>

      {/* Controls Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* DP Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdPerson style={{ color: 'var(--text-muted)', fontSize: 18 }} />
              <select
                className="ri-speed-select"
                value={selectedDP}
                onChange={e => setSelectedDP(e.target.value)}
                id="ri-replay-dp-select"
              >
                {dpList.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.dpCode || 'DB2'})</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdCalendarToday style={{ color: 'var(--text-muted)', fontSize: 16 }} />
              <input
                type="date"
                className="ri-speed-select"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                id="ri-replay-date"
              />
            </div>

            {/* Route */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
              <MdRoute style={{ color: 'var(--text-muted)', fontSize: 18 }} />
              <span style={{ fontSize: 13, color: areaColor, fontWeight: 700 }}>
                {dp?.route || dp?.zone || 'Zone A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Map + Timeline */}
      <div className="ri-replay-layout">
        {/* Left: RoutePlayer Component */}
        <div>
          <RoutePlayer
            dp={{
              id: dp?.id,
              name: dp?.name,
              route: dp?.route || dp?.zone,
              areaColor,
            }}
            date={selectedDate}
            corridorPolyline={corridorPolyline}
            deviationTrail={replayStream?.deviationTrail || []}
            pings={pings}
            height={420}
            isSimulated={isSimulated}
            emptyMessage="No tracking data for this period"
          />
        </div>

        {/* Right: Event Timeline */}
        <div className="card">
          <div className="card-header" style={{ paddingBottom: 12 }}>
            <span className="card-title">Event Timeline</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {pings.length > 0 ? `${pings.length} telemetry points` : '0 events'}
            </span>
          </div>
          <div className="card-body" style={{ padding: '8px 8px 16px' }}>
            {pings.length > 0 ? (
              <div className="ri-replay-event-list">
                {pings.slice(-10).reverse().map((ping, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <div className="ri-replay-event">
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: ping.status === 'RED' ? '#fee2e2' : '#dcfce7',
                          color: ping.status === 'RED' ? '#dc2626' : '#16a34a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 11,
                          flexShrink: 0,
                        }}
                      >
                        {ping.status === 'RED' ? '!' : '✓'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {ping.status === 'RED' ? `Deviation: ${ping.distanceMeters || 0}m off corridor` : 'On corridor'}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          {ping.timestamp ? new Date(ping.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'} • {ping.speed || 0} km/h
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                No events logged for this delivery partner on {selectedDate}.
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
