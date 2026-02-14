import { StorageManager } from "../core/storage-manager.js";
import { aggregateByCategory, calculateEquivalencies } from "../core/carbon-calculator.js";
import { BASELINE_GRID_INTENSITY, DEVICE_ENERGY } from "../core/constants.js";

const storageManager = new StorageManager();
let categoryChart = null;
let platformChart = null;

const formatGrams = (grams) => {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${grams.toFixed(1)} g`;
};

const getRange = (rangeKey) => {
  const end = new Date();
  const start = new Date();
  if (rangeKey === "week") start.setDate(end.getDate() - 6);
  else if (rangeKey === "month") start.setDate(end.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const categoryNames = {
  media: "Streaming & Social",
  shopping: "Shopping",
  browsing: "General Browsing"
};

// Get cached location and grid info from storage (set by service worker)
const getLocationAndGridInfo = async () => {
  try {
    // Get cached grid intensity and location from storage (same keys as service worker)
    const result = await chrome.storage.local.get([
      'gridIntensityCache',
      'lastKnownLocation'
    ]);
    
    const gridCache = result.gridIntensityCache;
    const locationCache = result.lastKnownLocation;
    
    let locationText = 'Location not detected';
    let gridIntensityText = `${BASELINE_GRID_INTENSITY} gCO₂/kWh (Global Average)`;
    let gridIntensity = BASELINE_GRID_INTENSITY;
    
    // Display location if available
    if (locationCache?.lat && locationCache?.lon) {
      locationText = `Lat: ${locationCache.lat.toFixed(2)}, Lon: ${locationCache.lon.toFixed(2)}`;
    }
    
    // Display grid intensity if available and fresh
    if (gridCache?.intensity && typeof gridCache.intensity === 'number') {
      gridIntensity = gridCache.intensity;
      
      const percentDiff = ((BASELINE_GRID_INTENSITY - gridIntensity) / BASELINE_GRID_INTENSITY * 100);
      const comparison = percentDiff > 0 
        ? `${Math.abs(percentDiff).toFixed(0)}% cleaner than global avg` 
        : `${Math.abs(percentDiff).toFixed(0)}% dirtier than global avg`;
      
      const zoneText = gridCache.zone ? ` (${gridCache.zone})` : '';
      // Use HTML for better formatting with styled second line
      const mainText = `${gridIntensity.toFixed(0)} gCO₂/kWh${zoneText}`;
      const comparisonText = `<span style="font-size: 0.85rem; opacity: 0.9;">${comparison}</span>`;
      gridIntensityText = `${mainText}\n${comparisonText}`;
      
      console.log('CurbYourCarbon: Using cached grid intensity:', gridIntensity, 'gCO₂/kWh');
    } else {
      console.log('CurbYourCarbon: No grid intensity cache, using global average');
    }
    
    // Update displays
    document.getElementById('location-text').textContent = locationText;
    document.getElementById('grid-intensity-text').innerHTML = gridIntensityText;
    
    return { locationText, gridIntensity };
  } catch (error) {
    console.error('CurbYourCarbon: Error reading location/grid cache:', error);
    document.getElementById('location-text').textContent = 'Unable to load location';
    document.getElementById('grid-intensity-text').innerHTML = `${BASELINE_GRID_INTENSITY} gCO₂/kWh (Global Average)`;
    return { locationText: 'Unknown', gridIntensity: BASELINE_GRID_INTENSITY };
  }
};

// Update device info display
const updateDeviceInfo = async () => {
  try {
    const result = await chrome.storage.sync.get(['deviceType', 'detectedDevice']);
    const deviceType = result.deviceType || 'auto';
    const detectedDevice = result.detectedDevice || 'laptop';
    
    const deviceNames = {
      phone: '📱 Phone (5W)',
      tablet: '📱 Tablet (10W)',
      laptop: '💻 Laptop (20W)',
      desktop: '🖥️ Desktop (40W)',
      tv: '📺 TV (100W)',
      auto: `🔍 Auto (${detectedDevice} detected)`
    };
    
    document.getElementById('device-info-text').textContent = deviceNames[deviceType] || deviceNames.auto;
  } catch (error) {
    console.warn('Could not load device info', error);
  }
};

// Update calculation formulas - show how service worker actually calculates
const updateCalculationFormulas = (events, total) => {
  const totalMB = events.reduce((sum, e) => sum + (e.data?.totalMB || 0), 0);
  const totalTime = events.reduce((sum, e) => sum + (e.data?.timeActive || 0), 0);
  
  // Get the actual grid intensity used (from first event with grid data)
  const eventWithGrid = events.find(e => e.data?.gridIntensity);
  const actualIntensity = eventWithGrid?.data?.gridIntensity || BASELINE_GRID_INTENSITY;
  const gridMultiplier = eventWithGrid?.data?.gridMultiplier || 1.0;
  
  // Network formula
  const networkKwh = (totalMB / 1024) * 0.016;
  document.getElementById('network-formula').textContent = `${totalMB.toFixed(1)} MB transferred`;
  
  // Energy formula
  document.getElementById('energy-formula').textContent = `Network energy = ${networkKwh.toFixed(4)} kWh`;
  
  // Device formula (use average 20W for display)
  const deviceKwh = (totalTime / 60) * (20 / 1000);
  document.getElementById('device-formula').textContent = `${totalTime.toFixed(1)} min × 20W = ${deviceKwh.toFixed(4)} kWh`;
  
  // Carbon formula - explain the actual methodology used
  // Service worker calculates with baseline (400) then multiplies by regional factor
  const totalKwh = networkKwh + deviceKwh;
  const baselineCarbon = totalKwh * BASELINE_GRID_INTENSITY;
  const adjustedCarbon = baselineCarbon * gridMultiplier;
  
  document.getElementById('intensity-value').textContent = BASELINE_GRID_INTENSITY;
  
  // Show the actual stored total (which may differ slightly due to rounding/video overhead)
  document.getElementById('final-carbon').textContent = total.toFixed(1);
};

// Update education comparisons
const updateEducationComparisons = (events, total) => {
  const totalMB = events.reduce((sum, e) => sum + (e.data?.totalMB || 0), 0);
  const totalTime = events.reduce((sum, e) => sum + (e.data?.timeActive || 0), 0);
  
  // Comparison to average user
  const avgDaily = 1000; // 1000g per day
  const percentDiff = ((total - avgDaily) / avgDaily * 100);
  
  let vsAverageText;
  if (total < avgDaily * 0.8) {
    vsAverageText = `${Math.abs(percentDiff).toFixed(0)}% below average 🎉`;
  } else if (total > avgDaily * 1.2) {
    vsAverageText = `${percentDiff.toFixed(0)}% above average`;
  } else {
    vsAverageText = 'About average';
  }
  
  document.getElementById('vs-average').textContent = vsAverageText;
  document.getElementById('total-mb').textContent = `${totalMB.toFixed(1)} MB`;
  document.getElementById('total-time').textContent = totalTime.toFixed(0);
};

// Update modern equivalencies display
const updateModernEquivalencies = (total) => {
  const eq = calculateEquivalencies(total);
  document.getElementById('eq-miles').textContent = eq.milesDriven.toFixed(2);
  document.getElementById('eq-phones').textContent = eq.phonesCharged.toFixed(1);
  document.getElementById('eq-trees').textContent = (eq.treesNeeded * 365).toFixed(1);
};

const generateRecommendations = (events, categoryTotals, total) => {
  const recommendations = [];
  
  const totalMB = events.reduce((sum, e) => sum + (e.data?.totalMB || 0), 0);
  const videoMB = events.reduce((sum, e) => sum + (e.data?.videoMB || 0), 0);

  if (categoryTotals.media > total * 0.3 && videoMB > 100) {
    recommendations.push({ 
      action: "Lower video quality", 
      impact: `Save ~${formatGrams(categoryTotals.media * 0.3)} CO₂`, 
      description: "Streaming at 720p instead of 1080p can reduce data transfer by 30-40%." 
    });
  }

  if (totalMB > 500) {
    recommendations.push({ 
      action: "Use ad blocker", 
      impact: `Save ~${formatGrams(total * 0.2)} CO₂`, 
      description: "Ads and trackers account for ~20% of page weight. Blocking them reduces data transfer." 
    });
  }

  if (categoryTotals.media > total * 0.5) {
    recommendations.push({ 
      action: "Reduce autoplay", 
      impact: `Save ~${formatGrams(categoryTotals.media * 0.2)} CO₂`, 
      description: "Disable autoplay on videos and social media to reduce unnecessary data transfer." 
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({ 
      action: "Keep up the good work!", 
      impact: "Your usage is already efficient", 
      description: "Continue being mindful of your digital habits." 
    });
  }

  return recommendations;
};

const renderRecommendations = (recommendations) => {
  const container = document.getElementById("recommendations");
  if (!container) return;
  container.innerHTML = recommendations.map(rec => `
    <div class="recommendation">
      <div class="recommendation-header">
        <span class="recommendation-action">${rec.action}</span>
        <span class="recommendation-impact">${rec.impact}</span>
      </div>
      <div class="recommendation-description">${rec.description}</div>
    </div>
  `).join("");
};

const renderCategoryChart = (categoryTotals) => {
  const ctx = document.getElementById("category-chart");
  if (!window.Chart || !ctx) return;
  if (categoryChart) categoryChart.destroy();

  const total = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);
  const hasData = total > 0;
  const categories = Object.entries(categoryTotals)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);
  const labels = categories.map(([key]) => categoryNames[key] || key);
  const data = categories.map(([, value]) => value);
  // Yellow-green, green, blue-green for better distinction while staying eco-friendly
  const colors = ["#7CB342", "#43A047", "#26A69A"];

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: hasData ? labels : ["No data yet"],
      datasets: [{ 
        data: hasData ? data : [1], 
        backgroundColor: hasData ? colors.slice(0, data.length) : ["#e0e0e0"] 
      }],
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          enabled: hasData,
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const percent = ((value / total) * 100).toFixed(1);
              return `${label}: ${formatGrams(value)} (${percent}%)`;
            }
          }
        }
      },
    },
  });
};

const renderPlatformChart = (platformTotals) => {
  const ctx = document.getElementById("platform-chart");
  if (!window.Chart || !ctx) return;
  if (platformChart) platformChart.destroy();

  const sortedPlatforms = Object.entries(platformTotals)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  
  const labels = sortedPlatforms.map(([key]) => key);
  const data = sortedPlatforms.map(([, value]) => value);
  const hasData = data.length > 0;

  platformChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: hasData ? labels : ["No data yet"],
      datasets: [{ 
        label: "CO₂ (g)", 
        data: hasData ? data : [0], 
        backgroundColor: hasData ? "#2f7d32" : "#e0e0e0" 
      }],
    },
    options: {
      indexAxis: hasData && labels.length > 5 ? 'y' : 'x',
      scales: {
        x: hasData && labels.length > 5 ? { beginAtZero: true } : {},
        y: hasData && labels.length <= 5 ? { beginAtZero: true } : {}
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.parsed.y || context.parsed.x;
              return `${formatGrams(value)} CO₂`;
            }
          }
        }
      },
    },
  });
};

const renderDashboard = async (rangeKey) => {
  try {
    const { start, end } = getRange(rangeKey);
    const events = await storageManager.getEventsInRange(start, end);
    
    console.log('CurbYourCarbon: Loaded events:', events.length);
    console.log('CurbYourCarbon: First few events:', events.slice(0, 3));
    
    // Aggregate by category
    const categoryTotals = aggregateByCategory(events);
    const total = Object.values(categoryTotals).reduce((sum, value) => sum + value, 0);
    
    // Aggregate by platform
    const platformTotals = {};
    events.forEach((event, index) => {
      const platform = event.platform || 'unknown';
      const carbon = event.carbonGrams || 0;
      
      if (index < 3) {
        console.log(`CurbYourCarbon: Event ${index}: platform=${platform}, carbon=${carbon}g`);
      }
      
      if (!platformTotals[platform]) {
        platformTotals[platform] = 0;
      }
      platformTotals[platform] += carbon;
    });
    
    // Verify the platform totals sum matches the category totals sum
    const platformSum = Object.values(platformTotals).reduce((sum, v) => sum + v, 0);
    console.log('CurbYourCarbon: Aggregated data:');
    console.log('  - Total from categories:', total.toFixed(2), 'g');
    console.log('  - Total from platforms:', platformSum.toFixed(2), 'g');
    console.log('  - Categories:', categoryTotals);
    console.log('  - Platforms:', platformTotals);

    // Get cached location and grid info
    await getLocationAndGridInfo();
    
    // Update all displays with ACTUAL data
    document.getElementById("total-impact").textContent = `${formatGrams(total)} CO₂`;
    updateCalculationFormulas(events, total);
    updateEducationComparisons(events, total);
    updateModernEquivalencies(total);
    renderCategoryChart(categoryTotals);
    renderPlatformChart(platformTotals);
    
    // Only show recommendations if total > 50g
    const recommendationsSection = document.getElementById("recommendations-section");
    if (total > 50) {
      recommendationsSection.style.display = "block";
      renderRecommendations(generateRecommendations(events, categoryTotals, total));
    } else {
      recommendationsSection.style.display = "none";
    }
  } catch (error) {
    console.error("CurbYourCarbon: Failed to render dashboard", error);
  }
};

const bindRangeButtons = () => {
  document.querySelectorAll(".range-toggle button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".range-toggle button").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderDashboard(button.dataset.range);
    });
  });
};

const loadDeviceSetting = async () => {
  try {
    const result = await chrome.storage.sync.get(['deviceType', 'detectedDevice']);
    const deviceType = result.deviceType || 'auto';
    document.getElementById('device-type').value = deviceType;
    
    // Show what was detected if using auto
    if (deviceType === 'auto' && result.detectedDevice) {
      console.log('CurbYourCarbon: Auto-detected as', result.detectedDevice);
    }
  } catch (error) {
    console.warn('Could not load device setting', error);
  }
};

const saveDeviceSetting = async (deviceType) => {
  try {
    // If user manually selects a device (not auto), clear the auto-detection flag
    if (deviceType !== 'auto') {
      await chrome.storage.sync.set({ deviceType, deviceDetected: false });
      console.log('CurbYourCarbon: Device manually set to', deviceType);
    } else {
      await chrome.storage.sync.set({ deviceType: 'auto' });
      console.log('CurbYourCarbon: Device set to auto-detect');
    }
    updateDeviceInfo(); // Update the display
    alert('Device setting saved!');
  } catch (error) {
    console.warn('Could not save device setting', error);
    alert('Error saving device setting');
  }
};

const loadApiKey = async () => {
  try {
    const result = await chrome.storage.local.get('ELECTRICITY_MAPS_TOKEN');
    const apiKey = result.ELECTRICITY_MAPS_TOKEN;
    if (apiKey) {
      document.getElementById('api-key').value = apiKey;
    }
  } catch (error) {
    console.warn('Could not load API key', error);
  }
};

const saveApiKey = async () => {
  try {
    const apiKey = document.getElementById('api-key').value.trim();
    if (apiKey) {
      await chrome.storage.local.set({ 'ELECTRICITY_MAPS_TOKEN': apiKey });
      console.log('CurbYourCarbon: ElectricityMap API key saved');
      alert('API key saved! Grid intensity will update on next tracking event.');
    } else {
      await chrome.storage.local.remove('ELECTRICITY_MAPS_TOKEN');
      console.log('CurbYourCarbon: API key removed');
      alert('API key removed. Using global average intensity.');
    }
    // Refresh the dashboard to show updated info
    const active = document.querySelector(".range-toggle .active");
    renderDashboard(active ? active.dataset.range : "today");
  } catch (error) {
    console.warn('Could not save API key', error);
    alert('Error saving API key');
  }
};

document.addEventListener("DOMContentLoaded", () => {
  bindRangeButtons();
  loadDeviceSetting();
  loadApiKey();
  updateDeviceInfo();
  renderDashboard("today");
  
  // Event listeners for settings
  document.getElementById('device-type').addEventListener('change', (e) => {
    saveDeviceSetting(e.target.value);
  });
  
  document.getElementById('save-api-key').addEventListener('click', saveApiKey);
  
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "EVENT_SAVED") {
      const active = document.querySelector(".range-toggle .active");
      renderDashboard(active ? active.dataset.range : "today");
    }
  });
});
