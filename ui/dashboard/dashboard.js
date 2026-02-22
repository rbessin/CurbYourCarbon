import { StorageManager } from "../../storage/storage-manager.js";
import { aggregateByCategory, calculateEquivalencies } from "../../calculators/carbon.js";
import { BASELINE_GRID_INTENSITY } from "../../config/energy-constants.js";
import { CATEGORY_DISPLAY_NAMES } from "../../config/categories.js";
import { getGridZoneName } from "../../config/grid-zones.js";
import { getDeviceDisplayName } from "../../config/devices.js";
import { reverseGeocode } from "../../services/geocoding.js";

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



// Helper to show API key status messages
const showApiStatus = (type, message, isHTML = false) => {
  const statusEl = document.getElementById('api-key-status');
  statusEl.className = `api-status ${type}`;
  if (isHTML) {
    statusEl.innerHTML = message;
  } else {
    statusEl.textContent = message;
  }
};



const tryGetLocationAutomatically = async () => {
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'REQUEST_LOCATION' }, (response) => {
      resolve(response || { success: false });
    });
  });
  
  if (response?.success) {
    await new Promise(resolve => setTimeout(resolve, 500));
    await getLocationAndGridInfo();
  } else {
    document.getElementById('location-text').innerHTML = 'Location blocked';
    showApiStatus('warning', `⚠️ Location access blocked. Please authorize location in your browser settings.`);
  }
};

// Get cached location and grid info from storage (set by service worker)
const getLocationAndGridInfo = async () => {
  try {
    const result = await chrome.storage.local.get([
      'gridIntensityCache',
      'lastKnownLocation'
    ]);
    
    const gridCache = result.gridIntensityCache;
    const locationCache = result.lastKnownLocation;
    
    let locationText = 'Location not detected';
    let gridIntensityText = `${BASELINE_GRID_INTENSITY} gCO₂/kWh (Global Average)`;
    let gridIntensity = BASELINE_GRID_INTENSITY;
    if (locationCache?.lat && locationCache?.lon) {
      const cityName = await reverseGeocode(locationCache.lat, locationCache.lon);
      locationText = cityName || `Lat: ${locationCache.lat.toFixed(2)}, Lon: ${locationCache.lon.toFixed(2)}`;
    } else {
      locationText = 'Location not detected';
    }
    
    if (gridCache?.intensity && typeof gridCache.intensity === 'number') {
      gridIntensity = gridCache.intensity;
      
      const percentDiff = ((BASELINE_GRID_INTENSITY - gridIntensity) / BASELINE_GRID_INTENSITY * 100);
      const comparison = percentDiff > 0 
        ? `${Math.abs(percentDiff).toFixed(0)}% cleaner than global avg` 
        : `${Math.abs(percentDiff).toFixed(0)}% dirtier than global avg`;
      
      const zoneName = gridCache.zone ? getGridZoneName(gridCache.zone) : null;
      
      // Three lines: intensity, zone, comparison
      const intensityLine = `${gridIntensity.toFixed(0)} gCO₂/kWh`;
      const zoneLine = zoneName ? `<span style="font-size: 0.85rem; opacity: 0.9;">${zoneName}</span>` : '';
      const comparisonLine = `<span style="font-size: 0.75rem; opacity: 0.85;">${comparison}</span>`;
      
      gridIntensityText = zoneName 
        ? `${intensityLine}\n${zoneLine}\n${comparisonLine}`
        : `${intensityLine}\n${comparisonLine}`;
    }
    
    document.getElementById('location-text').textContent = locationText;
    document.getElementById('grid-intensity-text').innerHTML = gridIntensityText;
    
    return { locationText, gridIntensity };
  } catch (error) {
    document.getElementById('location-text').textContent = 'Unable to load location';
    document.getElementById('grid-intensity-text').innerHTML = `${BASELINE_GRID_INTENSITY} gCO₂/kWh (Global Average)`;
    return { locationText: 'Unknown', gridIntensity: BASELINE_GRID_INTENSITY };
  }
};

const updateDeviceInfo = async () => {
  try {
    const result = await chrome.storage.sync.get(['deviceType', 'detectedDevice']);
    const deviceType = result.deviceType || 'auto';
    const detectedDevice = result.detectedDevice || 'laptop';
    
    document.getElementById('device-info-text').textContent = getDeviceDisplayName(deviceType, detectedDevice);
  } catch (error) {
    // Silently fail - use defaults
  }
};

const updateCalculationFormulas = (events, total) => {
  const totalMB = events.reduce((sum, e) => sum + (e.data?.totalMB || 0), 0);
  const totalTime = events.reduce((sum, e) => sum + (e.data?.timeActive || 0), 0);
  
  const eventWithGrid = events.find(e => e.data?.gridIntensity);
  const actualIntensity = eventWithGrid?.data?.gridIntensity || BASELINE_GRID_INTENSITY;
  const gridMultiplier = eventWithGrid?.data?.gridMultiplier || 1.0;
  
  const networkKwh = (totalMB / 1024) * 0.016;
  document.getElementById('network-formula').textContent = `${totalMB.toFixed(1)} MB transferred`;
  
  document.getElementById('energy-formula').textContent = `Network energy = ${networkKwh.toFixed(4)} kWh`;
  
  const deviceKwh = (totalTime / 60) * (20 / 1000);
  document.getElementById('device-formula').textContent = `${totalTime.toFixed(1)} min × 20W = ${deviceKwh.toFixed(4)} kWh`;
  
  document.getElementById('intensity-value').textContent = BASELINE_GRID_INTENSITY;
  document.getElementById('final-carbon').textContent = total.toFixed(1);
};

const updateEducationComparisons = (events, total, rangeKey) => {
  const totalMB = events.reduce((sum, e) => sum + (e.data?.totalMB || 0), 0);
  const totalTime = events.reduce((sum, e) => sum + (e.data?.timeActive || 0), 0);
  
  const avgDaily = 75;
  const days = rangeKey === 'today' ? 1 : (rangeKey === 'week' ? 7 : 30);
  const avgForPeriod = avgDaily * days;
  
  // Update label based on range
  const labelEl = document.getElementById('vs-average-label');
  if (labelEl) {
    const labelText = rangeKey === 'today' 
      ? 'vs average user (75g/day)'
      : rangeKey === 'week'
      ? 'vs average user (525g/week)'
      : 'vs average user (2.25kg/month)';
    labelEl.textContent = labelText;
  }
  
  let vsAverageText;
  if (total === 0) {
    vsAverageText = 'No carbon tracked yet';
  } else if (total < avgForPeriod * 0.5) {
    const percentOfAverage = ((total / avgForPeriod) * 100).toFixed(1);
    vsAverageText = `${percentOfAverage}% of average 🎉`;
  } else if (total < avgForPeriod * 0.8) {
    const percentDiff = ((avgForPeriod - total) / avgForPeriod * 100);
    vsAverageText = `${percentDiff.toFixed(0)}% less than average 🎉`;
  } else if (total > avgForPeriod * 1.2) {
    const percentDiff = ((total - avgForPeriod) / avgForPeriod * 100);
    vsAverageText = `${percentDiff.toFixed(0)}% more than average`;
  } else {
    vsAverageText = 'About average';
  }
  
  document.getElementById('vs-average').textContent = vsAverageText;
  document.getElementById('total-mb').textContent = `${totalMB.toFixed(1)} MB`;
  
  // Format time: show hours if >= 60 minutes
  const timeText = totalTime >= 60 
    ? `${(totalTime / 60).toFixed(1)} hr`
    : `${totalTime.toFixed(0)} min`;
  document.getElementById('total-time').textContent = timeText;
};

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
  const labels = categories.map(([key]) => CATEGORY_DISPLAY_NAMES[key] || key);
  const data = categories.map(([, value]) => value);
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
              // When horizontal (indexAxis: 'y'), value is in x. When vertical, value is in y.
              const isHorizontal = context.chart.options.indexAxis === 'y';
              const value = isHorizontal ? context.parsed.x : context.parsed.y;
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
    
    const categoryTotals = aggregateByCategory(events);
    const total = Object.values(categoryTotals).reduce((sum, value) => sum + value, 0);
    
    const platformTotals = {};
    events.forEach((event) => {
      const platform = event.platform || 'unknown';
      const carbon = event.carbonGrams || 0;
      if (!platformTotals[platform]) platformTotals[platform] = 0;
      platformTotals[platform] += carbon;
    });

    await getLocationAndGridInfo();
    
    document.getElementById("total-impact").textContent = `${formatGrams(total)} CO₂`;
    updateCalculationFormulas(events, total);
    updateEducationComparisons(events, total, rangeKey);
    updateModernEquivalencies(total);
    renderCategoryChart(categoryTotals);
    renderPlatformChart(platformTotals);
    renderRecommendations(generateRecommendations(events, categoryTotals, total));
  } catch (error) {
    // Silently fail - dashboard will show defaults
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

const initModals = () => {
  const overlay = document.getElementById('modal-overlay');
  
  // Open modal
  document.querySelectorAll('.modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = `${btn.dataset.modal}-modal`;
      const modal = document.getElementById(modalId);
      
      overlay.classList.add('active');
      modal.classList.add('active');
    });
  });
  
  // Close modal
  const closeModal = () => {
    overlay.classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  };
  
  // Close on X button
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  
  // Close on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
};

const loadDeviceSetting = async () => {
  try {
    const result = await chrome.storage.sync.get(['deviceType', 'detectedDevice']);
    const deviceType = result.deviceType || 'auto';
    document.getElementById('device-type').value = deviceType;
  } catch (error) {
    // Silently fail - use defaults
  }
};

const saveDeviceSetting = async (deviceType) => {
  try {
    if (deviceType !== 'auto') {
      await chrome.storage.sync.set({ deviceType, deviceDetected: false });
    } else {
      await chrome.storage.sync.set({ deviceType: 'auto' });
    }
    updateDeviceInfo();
    alert('Device setting saved!');
  } catch (error) {
    alert('Error saving device setting');
  }
};

// Test API key with real API call
const testApiKey = async (apiKey) => {
  try {
    const locationResult = await chrome.storage.local.get('lastKnownLocation');
    const location = locationResult.lastKnownLocation;
    
    let url = 'https://api.electricitymaps.com/v3/carbon-intensity/latest';
    
    if (location?.lat && location?.lon) {
      url += `?lat=${location.lat}&lon=${location.lon}`;
    } else {
      url += '?zone=US';
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'auth-token': apiKey }
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: 'Invalid API key' };
      }
      return { valid: false, error: `API error (${response.status})` };
    }
    
    const data = await response.json();
    const intensity = data?.carbonIntensity || data?.carbonIntensityAvg || data?.intensity;
    
    if (typeof intensity !== 'number') {
      return { valid: false, error: 'Invalid API response' };
    }
    
    return { 
      valid: true, 
      intensity, 
      zone: data?.zone || 'Unknown'
    };
  } catch (error) {
    return { valid: false, error: 'Network error' };
  }
};

const loadApiKey = async () => {
  try {
    const result = await chrome.storage.local.get(['ELECTRICITY_MAPS_TOKEN', 'gridIntensityCache']);
    const apiKey = result.ELECTRICITY_MAPS_TOKEN;
    const gridCache = result.gridIntensityCache;
    
    if (apiKey) {
      document.getElementById('api-key').value = apiKey;
      
      if (gridCache?.intensity && typeof gridCache.intensity === 'number') {
        const percentDiff = ((BASELINE_GRID_INTENSITY - gridCache.intensity) / BASELINE_GRID_INTENSITY * 100);
        const comparison = percentDiff > 0 
          ? `${Math.abs(percentDiff).toFixed(0)}% cleaner` 
          : `${Math.abs(percentDiff).toFixed(0)}% dirtier`;
        
        const zoneName = gridCache.zone ? getGridZoneName(gridCache.zone) : 'Unknown zone';
        showApiStatus('success', `✅ Active - ${zoneName} (${gridCache.intensity.toFixed(0)} gCO₂/kWh, ${comparison} than global average)`);
      } else {
        // API key exists but no location - try to get it automatically
        const locationResult = await chrome.storage.local.get('lastKnownLocation');
        if (!locationResult.lastKnownLocation) {
          await tryGetLocationAutomatically();
        }
      }
    } else {
      const warningHTML = `⚠️ No API key - using global average (${BASELINE_GRID_INTENSITY} gCO₂/kWh). <a href="https://api-portal.electricitymap.org/" target="_blank">Get free API key</a>`;
      showApiStatus('warning', warningHTML, true);
    }
  } catch (error) {
    // Silently fail - show default warning
  }
};

const exportDataAsCSV = async () => {
  try {
    // Get all events from storage
    const db = await storageManager.initDB();
    const events = await new Promise((resolve, reject) => {
      const tx = db.transaction('events', 'readonly');
      const store = tx.objectStore('events');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    
    if (events.length === 0) {
      alert('No data to export yet. Browse some websites first!');
      return;
    }
    
    // Create CSV content
    const headers = ['Date', 'Time', 'Platform', 'Category', 'Carbon (g)', 'Data (MB)', 'Time (min)', 'Grid (gCO2/kWh)', 'Zone'];
    const rows = events.map(event => {
      const date = new Date(event.timestamp);
      const dateStr = date.toLocaleDateString('en-US');
      const timeStr = date.toLocaleTimeString('en-US');
      
      return [
        dateStr,
        timeStr,
        event.platform || 'unknown',
        event.type || 'browsing',
        (event.carbonGrams || 0).toFixed(2),
        (event.data?.totalMB || 0).toFixed(2),
        (event.data?.timeActive || 0).toFixed(2),
        event.data?.gridIntensity || BASELINE_GRID_INTENSITY,
        event.data?.gridZone || 'N/A'
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const today = new Date().toISOString().split('T')[0];
    link.download = `curbyourcarbon-export-${today}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert(`Exported ${events.length} events successfully!`);
  } catch (error) {
    alert('Error exporting data. Please try again.');
  }
};

const saveApiKey = async () => {
  const apiKey = document.getElementById('api-key').value.trim();
  const statusEl = document.getElementById('api-key-status');
  
  try {
    // If removing key
    if (!apiKey) {
      await chrome.storage.local.remove('ELECTRICITY_MAPS_TOKEN');
      await chrome.storage.local.remove('gridIntensityCache');
      console.log('CurbYourCarbon: API key removed');
      
      const warningHTML = `⚠️ No API key - using global average (${BASELINE_GRID_INTENSITY} gCO₂/kWh). <a href="https://api-portal.electricitymap.org/" target="_blank">Get free API key</a>`;
      showApiStatus('warning', warningHTML, true);
      
      const active = document.querySelector(".range-toggle .active");
      renderDashboard(active ? active.dataset.range : "today");
      return;
    }
    
    // Show testing status
    showApiStatus('testing', '🔄 Testing API key...');
    
    // Test the key
    const result = await testApiKey(apiKey);
    
    if (result.valid) {
      await chrome.storage.local.set({ 'ELECTRICITY_MAPS_TOKEN': apiKey });
      await chrome.storage.local.set({
        'gridIntensityCache': {
          intensity: result.intensity,
          zone: result.zone,
          updatedAt: Date.now()
        }
      });
      
      const percentDiff = ((BASELINE_GRID_INTENSITY - result.intensity) / BASELINE_GRID_INTENSITY * 100);
      const comparison = percentDiff > 0 
        ? `${Math.abs(percentDiff).toFixed(0)}% cleaner` 
        : `${Math.abs(percentDiff).toFixed(0)}% dirtier`;
      
      const zoneName = getGridZoneName(result.zone);
      showApiStatus('success', `✅ API key valid! Using regional data (${zoneName}, ${result.intensity.toFixed(0)} gCO₂/kWh - ${comparison} than global average)`);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      await getLocationAndGridInfo();
      
      // If no location, try to get it automatically
      const locationCheck = await chrome.storage.local.get('lastKnownLocation');
      if (!locationCheck.lastKnownLocation) {
        await tryGetLocationAutomatically();
      }
      
      const active = document.querySelector(".range-toggle .active");
      renderDashboard(active ? active.dataset.range : "today");
    } else {
      // Invalid key - clear any cached grid data and don't save the key
      await chrome.storage.local.remove('gridIntensityCache');
      showApiStatus('error', `❌ ${result.error}. Please check your API key and try again.`);
      
      // Update grid display to show fallback to global average
      await getLocationAndGridInfo();
    }
  } catch (error) {
    showApiStatus('error', '❌ Error testing API key. Check your internet connection.');
  }
};

document.addEventListener("DOMContentLoaded", () => {
  bindRangeButtons();
  initModals();
  loadDeviceSetting();
  loadApiKey();
  updateDeviceInfo();
  renderDashboard("today");
  
  document.getElementById('device-type').addEventListener('change', (e) => {
    saveDeviceSetting(e.target.value);
  });
  
  document.getElementById('save-api-key').addEventListener('click', saveApiKey);
  
  document.getElementById('export-csv').addEventListener('click', exportDataAsCSV);
  
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "EVENT_SAVED") {
      const active = document.querySelector(".range-toggle .active");
      renderDashboard(active ? active.dataset.range : "today");
    }
  });
});
