import { StorageManager } from "../core/storage-manager.js";
import { aggregateByCategory, calculateEquivalencies } from "../core/carbon-calculator.js";

const storageManager = new StorageManager();
let categoryChart = null;
let timelineChart = null;
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

const generateInsights = (events, total, rangeKey) => {
  const insights = [];
  if (total === 0) {
    insights.push({ type: "neutral", text: "Start browsing to track your carbon footprint!" });
    return insights;
  }

  const dayCount = rangeKey === "today" ? 1 : (rangeKey === "week" ? 7 : 30);
  const avgPerDay = total / dayCount;
  const categoryTotals = aggregateByCategory(events);
  const sortedCategories = Object.entries(categoryTotals)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);
  const [dominantCategory, dominantValue] = sortedCategories[0] || ['browsing', 0];
  const dominantPercent = (dominantValue / total) * 100;

  if (rangeKey !== "today") {
    insights.push({ type: "neutral", text: `You average ${formatGrams(avgPerDay)} CO₂ per day over this period.` });
  }

  if (dominantPercent > 50) {
    const categoryName = categoryNames[dominantCategory] || dominantCategory;
    insights.push({ type: "info", text: `${categoryName} accounts for ${dominantPercent.toFixed(0)}% of your carbon footprint.` });
  }

  const typicalDaily = 1000;
  if (avgPerDay < typicalDaily * 0.7) {
    insights.push({ type: "positive", text: `✨ You're doing great! Your usage is ${((1 - avgPerDay/typicalDaily) * 100).toFixed(0)}% below the average digital user.` });
  } else if (avgPerDay > typicalDaily * 1.5) {
    insights.push({ type: "warning", text: `Your digital carbon footprint is ${((avgPerDay/typicalDaily - 1) * 100).toFixed(0)}% higher than average. Small changes can make a big difference!` });
  }

  const totalMB = events.reduce((sum, e) => sum + (e.data?.totalMB || 0), 0);
  if (totalMB > 100) {
    insights.push({ type: "neutral", text: `You've transferred ${totalMB.toFixed(0)} MB of data - about ${formatGrams(total)} worth of carbon.` });
  }

  return insights;
};

const generateRecommendations = (events, categoryTotals) => {
  const recommendations = [];
  const total = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);
  if (total === 0) {
    recommendations.push({ action: "Start tracking", impact: "Build awareness", description: "Browse any website to start measuring your carbon footprint with Performance API." });
    return recommendations;
  }

  const totalMB = events.reduce((sum, e) => sum + (e.data?.totalMB || 0), 0);
  const videoMB = events.reduce((sum, e) => sum + (e.data?.videoMB || 0), 0);

  if (categoryTotals.media > total * 0.3 && videoMB > 100) {
    recommendations.push({ action: "Lower video quality", impact: `Save ~${formatGrams(categoryTotals.media * 0.3)} CO₂`, description: "Streaming at 720p instead of 1080p can reduce data transfer by 30-40%." });
  }

  if (totalMB > 500) {
    recommendations.push({ action: "Use ad blocker", impact: `Save ~${formatGrams(total * 0.2)} CO₂`, description: "Ads and trackers account for ~20% of page weight. Blocking them reduces data transfer." });
  }

  if (recommendations.length === 0) {
    recommendations.push({ action: "Keep up the good work!", impact: "Your usage is already efficient", description: "Continue being mindful of your digital habits." });
  }

  return recommendations;
};

const renderInsights = (insights) => {
  const container = document.getElementById("insights");
  if (!container) return;
  const typeIcons = { positive: "✓", warning: "⚠", info: "ℹ", neutral: "→" };
  container.innerHTML = insights.map(insight => `
    <div class="insight insight-${insight.type}">
      <span class="insight-icon">${typeIcons[insight.type]}</span>
      <span class="insight-text">${insight.text}</span>
    </div>
  `).join("");
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

const renderEquivalencies = (total) => {
  const container = document.getElementById("equivalencies");
  const eq = calculateEquivalencies(total);
  container.innerHTML = `
    <div class="equivalency-item">
      <div class="equivalency-value">${eq.milesDriven.toFixed(1)}</div>
      <div class="equivalency-label">miles driven</div>
    </div>
    <div class="equivalency-item">
      <div class="equivalency-value">${eq.phonesCharged.toFixed(0)}</div>
      <div class="equivalency-label">phones charged</div>
    </div>
    <div class="equivalency-item">
      <div class="equivalency-value">${(eq.treesNeeded * 365).toFixed(2)}</div>
      <div class="equivalency-label">tree-days needed</div>
    </div>
  `;
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
  const colors = ["#3fa34d", "#4b8f59", "#6fa36c"];

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: hasData ? labels : ["No data yet"],
      datasets: [{ data: hasData ? data : [1], backgroundColor: hasData ? colors.slice(0, data.length) : ["#e0e0e0"] }],
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
      datasets: [{ label: "CO₂ (g)", data: hasData ? data : [0], backgroundColor: hasData ? "#2f7d32" : "#e0e0e0" }],
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
              return `${formatGrams(context.parsed.y || context.parsed.x)} CO₂`;
            }
          }
        }
      },
    },
  });
};

const renderTimelineChart = (events) => {
  const ctx = document.getElementById("timeline-chart");
  if (!window.Chart || !ctx) return;
  if (timelineChart) timelineChart.destroy();

  const grouped = events.reduce((acc, event) => {
    const dateKey = new Date(event.timestamp).toLocaleDateString();
    acc[dateKey] = (acc[dateKey] || 0) + (event.carbonGrams || 0);
    return acc;
  }, {});
  const labels = Object.keys(grouped);
  const data = Object.values(grouped);
  const hasData = data.length > 0 && data.some(v => v > 0);

  timelineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: hasData ? labels : ["No data yet"],
      datasets: [{
        label: "CO₂ (g)",
        data: hasData ? data : [0],
        borderColor: hasData ? "#2f7d32" : "#e0e0e0",
        backgroundColor: hasData ? "rgba(47, 125, 50, 0.2)" : "rgba(224, 224, 224, 0.2)",
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      scales: { y: { beginAtZero: true } },
      plugins: {
        tooltip: {
          callbacks: { label: function(context) { return `${formatGrams(context.parsed.y)} CO₂`; } }
        }
      }
    },
  });
};

const renderDashboard = async (rangeKey) => {
  try {
    const { start, end } = getRange(rangeKey);
    const events = await storageManager.getEventsInRange(start, end);
    const categoryTotals = aggregateByCategory(events);
    const total = Object.values(categoryTotals).reduce((sum, value) => sum + value, 0);
    const platformTotals = events.reduce((acc, event) => {
      const platform = event.platform || 'unknown';
      if (!acc[platform]) acc[platform] = 0;
      acc[platform] += event.carbonGrams || 0;
      return acc;
    }, {});

    document.getElementById("total-impact").textContent = `${formatGrams(total)} CO₂`;
    renderInsights(generateInsights(events, total, rangeKey));
    renderRecommendations(generateRecommendations(events, categoryTotals));
    renderEquivalencies(total);
    renderCategoryChart(categoryTotals);
    renderPlatformChart(platformTotals);
    renderTimelineChart(events);
  } catch (error) {
    console.warn("Failed to render dashboard", error);
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
      alert('API key saved! Regional carbon intensity will be used on next tracking event.');
    } else {
      await chrome.storage.local.remove('ELECTRICITY_MAPS_TOKEN');
      console.log('CurbYourCarbon: API key removed');
      alert('API key removed. Using baseline intensity.');
    }
  } catch (error) {
    console.warn('Could not save API key', error);
    alert('Error saving API key');
  }
};

document.addEventListener("DOMContentLoaded", () => {
  bindRangeButtons();
  loadDeviceSetting();
  loadApiKey();
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
