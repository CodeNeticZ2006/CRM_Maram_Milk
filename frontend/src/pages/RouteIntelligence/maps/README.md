# Route Intelligence — Leaflet GIS Map Architecture

This directory contains the **Leaflet GIS Map System** built with **React Leaflet 5**, **Leaflet 1.9**, and **OpenStreetMap** for the Maram Milk CRM platform.

---

## 📁 Directory & Component Structure

```
src/pages/RouteIntelligence/maps/
│
├── LeafletMapContainer.jsx  # Core map wrapper (<MapContainer>, OpenStreetMap tiles, floating controls & legend)
├── CustomerMarker.jsx       # Marker for customer locations (Orange home pin + popup)
├── DeliveryPartnerMarker.jsx# Marker for delivery partners (Green bike pin + status pulse ring + current position indicator)
├── HeadOfficeMarker.jsx     # Marker for processing HQ (Purple office pin + popup)
├── RoutePolyline.jsx        # Polyline overlay for delivery routes (custom colors, tooltips, completed segments)
├── RoutePolygon.jsx         # Polygon & Circle overlay for territory zones and geofences
├── MapControls.jsx          # Floating control bar (Layer toggles & Reset View button)
├── MapLegend.jsx            # Floating color-coded map legend overlay
├── MarkerPopup.jsx          # Standardized enterprise popup content template
├── LayerControl.jsx         # View controller hook (fitBounds / setView helper)
├── mockGisData.js           # Reusable GIS datasets (Head Office, Customers, DPs, Routes, Territories, Geofences)
└── index.js                 # Unified module re-export file
```

---

## 🧩 Component Breakdown & Responsibilities

### 1. `LeafletMapContainer.jsx`
- **Role**: Base container for all interactive maps.
- **Responsibility**: Wraps `<MapContainer>`, loads OpenStreetMap tile layer, injects `<ScaleControl>`, renders floating `MapControls` & `MapLegend`, and manages layer visibility states (`showCustomers`, `showPartners`, `showTerritories`, `showRoutes`).

### 2. `HeadOfficeMarker.jsx`
- **Role**: Displays the Central Milk Processing & Dispatch HQ.
- **Icon**: Distinctive purple marker (`#8b5cf6`) with office symbol (`🏢`).

### 3. `CustomerMarker.jsx`
- **Role**: Displays customer delivery addresses.
- **Icon**: Vibrant orange marker (`#f59e0b`) with home symbol (`🏠`).

### 4. `DeliveryPartnerMarker.jsx`
- **Role**: Displays active delivery partners / current live positions.
- **Icon**: Green marker (`#10b981`) with delivery bike symbol (`🛵`) and animated pulsing ring (`marker-pulse-ring`). Red (`#ef4444`) when deviated, Yellow (`#f59e0b`) when stopped.

### 5. `RoutePolyline.jsx`
- **Role**: Renders route paths connecting HQ to stops and DPs.
- **Features**: Customizable color, stroke weight, dashArray, line opacity, sticky tooltips, and completed segment styling.

### 6. `RoutePolygon.jsx`
- **Role**: Renders territory zone boundaries and geofence circles.
- **Features**: Supports both `type="polygon"` and `type="circle"`.

### 7. `MapControls.jsx`
- **Role**: Interactive floating action bar overlay with layer toggles & Reset View button.

### 8. `MapLegend.jsx`
- **Role**: Floating map legend overlay showing color codes.

### 9. `MarkerPopup.jsx`
- **Role**: Enterprise UI template for map popups.

### 10. `LayerControl.jsx`
- **Role**: React-Leaflet controller component using `useMap()` for programmatically setting view or bounds.
