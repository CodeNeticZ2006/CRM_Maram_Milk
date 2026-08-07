import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  MdPlayArrow, MdPause, MdReplay, MdSkipNext, MdSkipPrevious,
  MdPerson, MdCalendarToday, MdRoute, MdRefresh
} from 'react-icons/md';
import { SectionHeader, RouteReplayCard } from '../components/index.jsx';
import api from '../../../services/api';
import { MOCK_DELIVERY_PARTNERS, MOCK_REPLAY_EVENTS } from '../utils/mockData.js';
import {
  LeafletMapContainer, RoutePolyline, CustomerMarker,
  DeliveryPartnerMarker, HeadOfficeMarker, HEAD_OFFICE,
  MOCK_REPLAY_GIS_DATA
} from '../maps/index.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function RouteReplayPage() {
  const [isPlaying, setIsPlaying]     = useState(false);
  const [speed, setSpeed]             = useState('1x');
  const [dpList, setDpList]           = useState(MOCK_DELIVERY_PARTNERS);
  const [selectedDP, setSelectedDP]   = useState(MOCK_DELIVERY_PARTNERS[0].id);
  const [loading, setLoading]         = useState(true);
  const [isDb2Loaded, setIsDb2Loaded] = useState(false);

  const fetchReplayData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/route-intelligence/replay');
      if (res.data?.success && res.data?.data?.deliveryPartners?.length > 0) {
        const db2Dps = res.data.data.deliveryPartners;
        setDpList(db2Dps);
        if (db2Dps.length > 0 && !db2Dps.find(d => d.id === selectedDP)) {
          setSelectedDP(db2Dps[0].id);
        }
        setIsDb2Loaded(true);
      }
    } catch (err) {
      console.warn('⚠️ Failed to fetch DB2 replay list:', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDP]);

  useEffect(() => {
    fetchReplayData();
  }, [fetchReplayData]);

  const dp = dpList.find(d => d.id === selectedDP) || dpList[0];

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Route Replay"
        subtitle={
          <span>
            Replay historical delivery routes with a step-by-step event timeline
            {isDb2Loaded && <span className="badge badge-success" style={{ marginLeft: 10, fontSize: 11 }}>Connected to DB2</span>}
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
              <input type="date" className="ri-speed-select" defaultValue="2026-08-07" id="ri-replay-date" />
            </div>
            {/* Route */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
              <MdRoute style={{ color: 'var(--text-muted)', fontSize: 18 }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{dp?.route || dp?.zone || 'Zone A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map + Timeline */}
      <div className="ri-replay-layout">
        {/* Left: Map + Playback Controls */}
        <div>
          {/* Map */}
          <div style={{ marginBottom: 16 }}>
            <LeafletMapContainer
              height={380}
              center={MOCK_REPLAY_GIS_DATA.currentPos}
              zoom={13}
              legendItems={[
                { label: 'Head Office',      color: '#8b5cf6', icon: '🏢' },
                { label: 'Current Position', color: '#3b82f6', icon: '📍' },
                { label: 'Completed Segment',color: '#10b981', icon: '➖' },
                { label: 'Remaining Route',  color: '#94a3b8', icon: '➖' },
                { label: 'Delivered Stop',   color: '#10b981', icon: '🏠' },
                { label: 'Pending Stop',     color: '#f59e0b', icon: '🏠' },
              ]}
            >
              {({ showCustomers, showRoutes }) => (
                <>
                  <HeadOfficeMarker office={HEAD_OFFICE} />

                  {/* Full planned route (dashed / remaining) */}
                  {showRoutes && (
                    <RoutePolyline
                      coordinates={MOCK_REPLAY_GIS_DATA.fullPath}
                      color="#94a3b8"
                      weight={4}
                      dashArray="6, 6"
                      routeName={`${MOCK_REPLAY_GIS_DATA.route} (Planned)`}
                    />
                  )}

                  {/* Completed route segment */}
                  {showRoutes && (
                    <RoutePolyline
                      coordinates={MOCK_REPLAY_GIS_DATA.completedPath}
                      color="#10b981"
                      weight={5}
                      completed={true}
                      routeName={`${MOCK_REPLAY_GIS_DATA.route} (Completed)`}
                    />
                  )}

                  {/* Completed Stops */}
                  {showCustomers && MOCK_REPLAY_GIS_DATA.completedStops.map(stop => (
                    <CustomerMarker
                      key={stop.id}
                      customer={{
                        name: stop.name,
                        type: 'Completed Stop',
                        route: MOCK_REPLAY_GIS_DATA.route,
                        status: 'Delivered',
                        lat: stop.lat,
                        lng: stop.lng,
                        address: `Delivered at ${stop.time}`,
                      }}
                    />
                  ))}

                  {/* Remaining Pending Stops */}
                  {showCustomers && MOCK_REPLAY_GIS_DATA.remainingStops.map(stop => (
                    <CustomerMarker
                      key={stop.id}
                      customer={{
                        name: stop.name,
                        type: 'Pending Stop',
                        route: MOCK_REPLAY_GIS_DATA.route,
                        status: 'Pending',
                        lat: stop.lat,
                        lng: stop.lng,
                        address: 'In Transit',
                      }}
                    />
                  ))}

                  {/* Current Replay Marker */}
                  <DeliveryPartnerMarker
                    partner={{
                      name: dp?.name || MOCK_REPLAY_GIS_DATA.dpName,
                      type: 'Current Position',
                      route: dp?.route || MOCK_REPLAY_GIS_DATA.route,
                      status: 'active',
                      lat: MOCK_REPLAY_GIS_DATA.currentPos[0],
                      lng: MOCK_REPLAY_GIS_DATA.currentPos[1],
                      speed: '36 km/h',
                    }}
                    isCurrentPos={true}
                  />
                </>
              )}
            </LeafletMapContainer>
          </div>

          {/* Playback Controls */}
          <div className="card">
            <div className="card-body">
              <div className="ri-replay-controls">
                <button className="ri-replay-btn" title="Restart" id="ri-replay-restart">
                  <MdReplay />
                </button>
                <button className="ri-replay-btn" title="Previous Event" id="ri-replay-prev">
                  <MdSkipPrevious />
                </button>
                <button
                  className={`ri-replay-btn ${isPlaying ? 'active' : ''}`}
                  onClick={() => setIsPlaying(p => !p)}
                  title={isPlaying ? 'Pause' : 'Play'}
                  id="ri-replay-play"
                >
                  {isPlaying ? <MdPause /> : <MdPlayArrow />}
                </button>
                <button className="ri-replay-btn" title="Next Event" id="ri-replay-next">
                  <MdSkipNext />
                </button>

                {/* Timeline Scrubber */}
                <div className="ri-timeline-bar">
                  <div className="ri-timeline-track">
                    <div className="ri-timeline-fill">
                      <div className="ri-timeline-thumb" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>06:20 AM</span>
                    <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>06:41 AM</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>07:02 AM</span>
                  </div>
                </div>

                {/* Speed Control */}
                <select
                  className="ri-speed-select"
                  value={speed}
                  onChange={e => setSpeed(e.target.value)}
                  id="ri-replay-speed"
                >
                  {['0.5x','1x','2x','4x','8x'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Event Timeline */}
        <div className="card">
          <div className="card-header" style={{ paddingBottom: 12 }}>
            <span className="card-title">Event Timeline</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{MOCK_REPLAY_EVENTS.length} events</span>
          </div>
          <div className="card-body" style={{ padding: '8px 8px 16px' }}>
            <div className="ri-replay-event-list">
              {MOCK_REPLAY_EVENTS.map((ev, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  {/* Connector line */}
                  {i < MOCK_REPLAY_EVENTS.length - 1 && (
                    <div style={{ position: 'absolute', left: 22, top: 38, width: 2, height: 12, background: 'var(--border)', zIndex: 0 }} />
                  )}
                  <RouteReplayCard event={ev} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
