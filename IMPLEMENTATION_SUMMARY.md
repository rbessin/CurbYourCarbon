# CurbYourCarbon - Implementation Summary (Current)

## Current Architecture

CurbYourCarbon is now a **universal website tracker** (Manifest V3) using:
- **Performance API** for measured data transfer and activity
- **Universal content script** (`content-scripts/universal-tracker.js`) on all `http/https` pages
- **Background service worker** for carbon calculation, storage, and messaging
- **IndexedDB** (`core/storage-manager.js`) for event history + daily summaries
- **Popup + Dashboard** for real-time and historical reporting

---

## What Is Implemented

### 1) Universal Tracking
- Tracks any site (not only specific platforms)
- Captures:
  - active time
  - total data transfer (MB)
  - image/video/script/stylesheet/document/other breakdown
  - platform/domain + category (`media`, `shopping`, `browsing`)

### 2) Carbon Calculation
- Uses `core/carbon-calculator.js`:
  - `calculateNetworkCarbon()`
  - `calculateDeviceCarbon()`
  - `calculateTotalCarbon()`
- Uses `BASELINE_GRID_INTENSITY` in `core/constants.js` for baseline math.

### 3) Real-Time Grid Intensity (Electricity Maps)
Implemented in `background/service-worker.js`:
- Token from `chrome.storage.local` key: `ELECTRICITY_MAPS_TOKEN`
- Cache in `chrome.storage.local` key: `gridIntensityCache`
- Cache TTL: 10 minutes
- Last location cache key: `lastKnownLocation`
- In-flight dedupe lock to avoid duplicate fetches on concurrent events
- Fallback behavior:
  - use cached value if available
  - if geolocation unavailable, fallback to `zone=US`

### 4) MV3-Safe Geolocation
Implemented with offscreen document:
- `background/offscreen.html`
- `background/offscreen.js`
- `manifest.json` includes permissions: `offscreen`, `geolocation`
- Service worker requests location via runtime message (`GET_GEOLOCATION`)

### 5) UI and Storage Alignment
- Popup and dashboard use universal categories (`media`, `shopping`, `browsing`)
- `core/storage-manager.js#getTotalImpact()` now normalizes legacy categories (`video`/`social`) into `media`

---

## Data Flow
1. `universal-tracker.js` measures session data
2. Sends `TRACK_EVENT` to service worker
3. Service worker gets grid context (cached/fetched), computes carbon
4. Event saved to IndexedDB (`events`)
5. Daily summary updated (`daily_summary`)
6. Worker emits `EVENT_SAVED` for live popup/dashboard refresh

---

## Current Status

### Stable
- Universal tracking pipeline
- Carbon computation + equivalencies
- Grid intensity cache + fallback logic
- Popup/dashboard rendering with live updates

### Notes
- `archive/` contains old platform-specific trackers for reference
- `.DS_Store` files are non-functional macOS metadata

