# CurbYourCarbon 🌱

A browser extension that tracks the carbon footprint of your web browsing using actual measured data from the Performance API.

## Sneak Peak

To be added later.

## What It Does

Measures your client-side carbon emissions from network data transfer and device energy consumption while browsing. 
Works on any website automatically, tailoring insights to your usage.

## How It Works

1. **Measures** actual bytes transferred using Performance API
2. **Calculates** carbon emissions using research-backed formulas:
   - Network: `(GB × 0.016 kWh/GB) × regional_carbon_intensity`
   - Device: `(minutes/60 × watts/1000) × regional_carbon_intensity`
   - Uses your region's grid carbon intensity (via ElectricityMaps API) or global baseline (475 gCO₂/kWh)
3. **Displays** breakdown by category and platform with actionable recommendations

Average web user: ~75g CO₂/day from browsing

## Installation

**Developers:** Load unpacked from `chrome://extensions/` with developer mode enabled
**Users:** Install from [Chrome Web Store](https://chromewebstore.google.com/detail/curbyourcarbon/fbojjgdaemhnolpjiepkhbcnelcckoed)

## Research-Backed

Calculations based on IEA (2024), Carbon Trust (2021), and ElectricityMaps data. Regional carbon intensity varies from 18 gCO₂/kWh (Iceland) to 800+ gCO₂/kWh (coal-heavy grids).

---

Built for a more sustainable internet 🌍
