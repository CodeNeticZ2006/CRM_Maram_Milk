import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MdPlayArrow, MdPause, MdReplay, MdSkipNext, MdSkipPrevious,
  MdSpeed, MdAccessTime, MdRoute
} from 'react-icons/md';
import {
  LeafletMapContainer, RoutePolyline, CustomerMarker,
  DeliveryPartnerMarker, HeadOfficeMarker, HEAD_OFFICE
} from '../maps/index.js';
import { getAreaColor } from '../utils/areaPalette.js';

export default function RoutePlayer({
  dp = null,
  date = '2026-11-23',
  timeWindow = null,
  corridorPolyline = [],
  deviationTrail = [],
  events = [],
  pings = [],
  height = 380,
  isSimulated = false,
  emptyMessage = 'No tracking data for this period',
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState('1x');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Derive points to play along: pings -> deviationTrail -> corridorPolyline -> fallback
  const playbackPoints = useMemo(() => {
    if (pings && pings.length > 0) {
      return pings.map(p => ({
        lat: p.lat,
        lng: p.lng,
        speed: p.speed || 0,
        heading: p.heading || 0,
        time: p.timestamp ? new Date(p.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '',
        status: p.status || 'GREEN',
      }));
    }
    if (deviationTrail && deviationTrail.length > 0) {
      return deviationTrail.map((p, idx) => ({
        lat: Array.isArray(p) ? p[0] : p.lat,
        lng: Array.isArray(p) ? p[1] : p.lng,
        speed: p.speed || 25,
        heading: p.heading || (idx < deviationTrail.length - 1 ? 45 : 0),
        time: p.timestamp ? new Date(p.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `Point ${idx + 1}`,
        status: 'RED',
      }));
    }
    // When no telemetry pings exist, do not generate fake playback points
    return [];
  }, [pings, deviationTrail]);

  const totalPoints = playbackPoints.length;
  const currentPt = playbackPoints[currentIndex] || playbackPoints[0] || { lat: HEAD_OFFICE.lat, lng: HEAD_OFFICE.lng, speed: 0, heading: 0, time: '—', status: 'GREEN' };

  // Timer loop for playback
  useEffect(() => {
    if (!isPlaying || totalPoints <= 1) return;
    const speedMult = parseFloat(speed) || 1;
    const intervalMs = Math.max(80, Math.round(1000 / speedMult));

    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= totalPoints - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, totalPoints, speed]);

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    setCurrentIndex(p => Math.max(0, p - 1));
  };

  const handleNext = () => {
    setCurrentIndex(p => Math.min(totalPoints - 1, p + 1));
  };

  const handleScrub = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) setCurrentIndex(val);
  };

  const areaColor = dp?.areaColor || getAreaColor(dp?.route || dp?.assignedRouteName);

  // Completed path slice
  const completedCoords = useMemo(() => {
    return playbackPoints.slice(0, currentIndex + 1).map(p => [p.lat, p.lng]);
  }, [playbackPoints, currentIndex]);

  const deviationCoords = useMemo(() => {
    if (!deviationTrail || deviationTrail.length === 0) return [];
    return deviationTrail.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng]);
  }, [deviationTrail]);

  if (totalPoints === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <MdRoute size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="ri-player-container">
      {/* Map Display */}
      <div style={{ marginBottom: 14, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <LeafletMapContainer
          height={height}
          center={[currentPt.lat, currentPt.lng]}
          zoom={14}
          legendItems={[
            { label: `${dp?.route || 'Area'} Corridor`, color: areaColor },
            { label: 'Completed Segment', color: '#10b981' },
            ...(deviationCoords.length > 0 ? [{ label: 'Deviation Segment (Off-Route)', color: '#dc2626' }] : []),
            { label: 'Current Bike', color: areaColor, shape: 'circle' },
          ]}
        >
          {({ showRoutes }) => (
            <>
              <HeadOfficeMarker office={HEAD_OFFICE} />

              {/* Base Assigned Route Corridor */}
              {showRoutes && corridorPolyline.length > 0 && (
                <RoutePolyline
                  coordinates={corridorPolyline}
                  color={areaColor}
                  weight={4}
                  routeName={`${dp?.route || 'Assigned'} Corridor`}
                />
              )}

              {/* Completed Journey Segment */}
              {showRoutes && completedCoords.length > 1 && (
                <RoutePolyline
                  coordinates={completedCoords}
                  color="#10b981"
                  weight={5}
                  routeName="Completed Telemetry"
                />
              )}

              {/* Off-Route Deviation Highlighted in Red */}
              {showRoutes && deviationCoords.length > 1 && (
                <RoutePolyline
                  coordinates={deviationCoords}
                  color="#dc2626"
                  weight={5.5}
                  dashArray="4, 4"
                  routeName="Off-Route Deviation Trail"
                />
              )}

              {/* Current Playback Bike Marker */}
              <DeliveryPartnerMarker
                partner={{
                  id: dp?.id || 'replay-dp',
                  name: dp?.name || 'Delivery Partner',
                  initials: dp?.initials || 'DP',
                  route: dp?.route || dp?.assignedRouteName,
                  status: currentPt.status || 'GREEN',
                  areaColor,
                  lat: currentPt.lat,
                  lng: currentPt.lng,
                  speed: currentPt.speed,
                  heading: currentPt.heading,
                  source: isSimulated ? 'simulator' : 'replay',
                  isSimulated,
                }}
              />
            </>
          )}
        </LeafletMapContainer>
      </div>

      {/* Playback Controls Card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ padding: '12px 18px' }}>
          <div className="ri-replay-controls" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="ri-replay-btn" onClick={handleRestart} title="Restart Replay" id="ri-player-restart">
              <MdReplay size={18} />
            </button>
            <button className="ri-replay-btn" onClick={handlePrev} title="Previous Point" id="ri-player-prev">
              <MdSkipPrevious size={18} />
            </button>
            <button
              className={`ri-replay-btn ${isPlaying ? 'active' : ''}`}
              onClick={() => setIsPlaying(p => !p)}
              title={isPlaying ? 'Pause' : 'Play'}
              id="ri-player-play"
              style={{ background: isPlaying ? 'var(--primary, #2563eb)' : undefined, color: isPlaying ? '#fff' : undefined }}
            >
              {isPlaying ? <MdPause size={18} /> : <MdPlayArrow size={18} />}
            </button>
            <button className="ri-replay-btn" onClick={handleNext} title="Next Point" id="ri-player-next">
              <MdSkipNext size={18} />
            </button>

            {/* Scrubbable Timeline Track */}
            <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <input
                type="range"
                min={0}
                max={Math.max(0, totalPoints - 1)}
                value={currentIndex}
                onChange={handleScrub}
                style={{ width: '100%', cursor: 'pointer' }}
                id="ri-player-timeline-slider"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>{playbackPoints[0]?.time || 'Start'}</span>
                <span style={{ fontWeight: 700, color: 'var(--primary, #2563eb)' }}>
                  {currentPt.time} ({currentIndex + 1}/{totalPoints})
                </span>
                <span>{playbackPoints[totalPoints - 1]?.time || 'End'}</span>
              </div>
            </div>

            {/* Speed Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdSpeed style={{ color: 'var(--text-muted)' }} />
              <select
                className="ri-speed-select"
                value={speed}
                onChange={e => setSpeed(e.target.value)}
                id="ri-player-speed"
                style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6 }}
              >
                {['0.5x', '1x', '2x', '4x', '8x'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
