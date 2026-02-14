import { StorageManager } from "../core/storage-manager.js";
import { aggregateByCategory, calculateEquivalencies } from "../core/carbon-calculator.js";

const storageManager = new StorageManager();
let categoryChart = null;

const categoryColors = {
  media: "#3fa34d",
  shopping: "#4b8f59",
  browsing: "#6fa36c"
};

const formatGrams = (grams) => {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${grams.toFixed(1)} g`;
};

const renderCategoryChart = (categoryTotals) => {
  const ctx = document.getElementById("category-chart");
  if (!window.Chart || !ctx) return;
  if (categoryChart) categoryChart.destroy();

  const media = categoryTotals.media || 0;
  const shopping = categoryTotals.shopping || 0;
  const browsing = categoryTotals.browsing || 0;
  const total = media + shopping + browsing;
  const hasData = total > 0;
  const data = hasData ? [media, shopping, browsing] : [1];
  const colors = hasData
    ? [categoryColors.media, categoryColors.shopping, categoryColors.browsing]
    : ["#e0e0e0"];

  categoryChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Streaming & Social", "Shopping", "General Browsing"],
      datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      }
    }
  });

  return { media, shopping, browsing };
};

const getQuickInsight = (total) => {
  const typical = 1000;
  if (total === 0) return "Browse any website to start tracking!";
  if (total < typical * 0.5) return "✨ Excellent! You're well below average.";
  if (total < typical * 0.8) return "👍 Good job! Your usage is below average.";
  if (total < typical * 1.2) return "Average digital footprint for today.";
  return "💡 Consider reducing usage or quality.";
};

const renderPopup = async () => {
  try {
    const events = await storageManager.getEventsToday();
    const mostRecentEvent = events.reduce((latest, event) => {
      if (!latest) return event;
      return (event.timestamp || 0) > (latest.timestamp || 0) ? event : latest;
    }, null);
    const carbonRate = mostRecentEvent?.carbonRate ? `${mostRecentEvent.carbonRate} g CO2/hr` : 'N/A';
    const categoryTotals = aggregateByCategory(events);
    const total = Object.values(categoryTotals).reduce((sum, value) => sum + value, 0);
    const media = categoryTotals.media || 0;
    const shopping = categoryTotals.shopping || 0;
    const browsing = categoryTotals.browsing || 0;

    document.getElementById("today-total").textContent = formatGrams(total);

    renderCategoryChart(categoryTotals);
    document.getElementById("value-media").textContent = formatGrams(media);
    document.getElementById("value-shopping").textContent = formatGrams(shopping);
    document.getElementById("value-browsing").textContent = formatGrams(browsing);

    document.getElementById("quick-insight").textContent = getQuickInsight(total);

    document.getElementById("carbon-rate").textContent = `Current Carbon Rate: ${carbonRate}`;

    const equivalencies = calculateEquivalencies(total);
    let eqText = `${equivalencies.milesDriven.toFixed(1)} miles driven`;
    if (equivalencies.phonesCharged >= 1) {
      eqText += ` • ${equivalencies.phonesCharged.toFixed(0)} phones charged`;
    }
    document.getElementById("equivalency-text").textContent = eqText;
  } catch (error) {
    console.warn("Failed to render popup", error);
  }
};

const init = () => {
  renderPopup();
  
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "EVENT_SAVED") renderPopup();
  });
  
  document.getElementById("dashboard-button").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
  });
};

document.addEventListener("DOMContentLoaded", init);
