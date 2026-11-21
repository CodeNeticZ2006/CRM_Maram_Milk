# CRM_Maram_Milk

Maram Milk CRM & Route Intelligence System.

---

## Route Intelligence Module Notes

### Delivery Partner (DP) Mobile App Protocol Note: `nextIntervalSeconds`
When delivery partner devices send location updates via `POST /api/route-intelligence/gps-ping`:
```http
POST /api/route-intelligence/gps-ping
Content-Type: application/json

{
  "dpId": "dp-nung-1",
  "lat": 13.0604,
  "lng": 80.2496,
  "speed": 22.5,
  "accuracy": 8.0,
  "timestamp": "2026-11-22T05:30:00.000Z"
}
```

The server response returns an additive field **`nextIntervalSeconds`**:
```json
{
  "success": true,
  "status": "GREEN",
  "isWithinCorridor": true,
  "currentState": "ON_ROUTE",
  "distanceMeters": 0,
  "stoppedSeconds": 0,
  "nextIntervalSeconds": 30
}
```

**Mobile App Developer Guidelines:**
1. **Dynamic Frequency Calibration:** The mobile app's background GPS scheduler should read `nextIntervalSeconds` from every ping response and reschedule its next ping timer accordingly.
2. **Operational Control:** This allows dispatchers to dynamically tune GPS ping frequency from the Route Intelligence Settings page (e.g., between 10s and 300s) to balance battery conservation with tracking precision without deploying a mobile app update.
3. **Fallback:** If offline or if `nextIntervalSeconds` is missing, the mobile client should fall back to a default interval of 30 seconds.

---

### Production Notes: Route Intelligence Settings Storage (File vs DB Table)
*Currently, Route Intelligence settings are persisted to a local JSON file: `backend/data/routeSettings.json` with atomic `.tmp` write and rename.*

**Migration to DB Table (Later Step for Production Deployment):**
When deploying to a clustered, containerized production environment (e.g., Kubernetes, AWS ECS, multi-core PM2):
1. **Multi-Replica Single Source of Truth:** Local file writes on one container pod are isolated and not visible to other pods. A relational database table (e.g. `route_intelligence_settings` in PostgreSQL) provides a synchronized source of truth across all worker pods.
2. **Ephemeral Containers:** In Docker and Kubernetes, container filesystems are ephemeral. Storing settings in a persistent database prevents configuration loss during pod rescheduling or new image rollouts.
3. **Audit History Table:** A database migration should introduce an append-only `route_intelligence_settings_audit` table (`id`, `settings_json`, `updated_at`, `updated_by`, `reason`) to retain an immutable audit log of threshold modifications (e.g., corridor tolerance, grace periods), critical for resolving delivery partner SLA and penalty disputes.
4. **Cache Invalidation:** Worker instances can cache active settings in memory and invalidate/reload via PostgreSQL `LISTEN/NOTIFY` or Redis pub/sub when a dispatcher updates settings from the dashboard.
