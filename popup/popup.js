import { StorageManager } from "../core/storage-manager.js";
import { aggregateByCategory, calculateEquivalencies } from "../core/carbon-calculator.js";

const storageManager = new StorageManager();

const formatGrams = (grams) => {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${grams.toFixed(1)} g`;
};

const updateBars = (categoryTotals, total) => {
  const mediaBar = document.getElementById("bar-video");
  const shoppingBar = document.getElementById("bar-social");
  const browsingBar = document.getElementById("bar-shopping");

  const safeTotal = total > 0 ? total : 1;
  const media = categoryTotals.media || 0;
  const shopping = categoryTotals.shopping || 0;
  const browsing = categoryTotals.browsing || 0;
  
  mediaBar.style.width = `${(media / safeTotal) * 100}%`;
  shoppingBar.style.width = `${(shopping / safeTotal) * 100}%`;
  browsingBar.style.width = `${(browsing / safeTotal) * 100}%`;
  
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
    const categoryTotals = aggregateByCategory(events);
    const total = Object.values(categoryTotals).reduce((sum, value) => sum + value, 0);

    document.getElementById("today-total").textContent = formatGrams(total);
    
    const { media, shopping, browsing } = updateBars(categoryTotals, total);
    document.getElementById("value-video").textContent = formatGrams(media);
    document.getElementById("value-social").textContent = formatGrams(shopping);
    document.getElementById("value-shopping").textContent = formatGrams(browsing);

    document.getElementById("quick-insight").textContent = getQuickInsight(total);

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
