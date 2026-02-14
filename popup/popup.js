import { StorageManager } from "../core/storage-manager.js";
import {
  aggregateByCategory,
  calculateEquivalencies,
} from "../core/carbon-calculator.js";

const storageManager = new StorageManager();

const formatGrams = (grams) => {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(2)} kg`;
  }
  return `${grams.toFixed(1)} g`;
};

const updateBars = (categoryTotals, total) => {
  const videoBar = document.getElementById("bar-video");
  const socialBar = document.getElementById("bar-social");
  const shoppingBar = document.getElementById("bar-shopping");

  const safeTotal = total > 0 ? total : 1;
  videoBar.style.width = `${(categoryTotals.video / safeTotal) * 100}%`;
  socialBar.style.width = `${(categoryTotals.social / safeTotal) * 100}%`;
  shoppingBar.style.width = `${(categoryTotals.shopping / safeTotal) * 100}%`;
};

const getQuickInsight = (total, categoryTotals) => {
  // Typical daily usage: 1000g
  const typical = 1000;
  
  if (total === 0) {
    return "Start browsing to track your footprint!";
  }
  
  if (total < typical * 0.5) {
    return "✨ Excellent! You're well below average.";
  } else if (total < typical * 0.8) {
    return "👍 Good job! Your usage is below average.";
  } else if (total < typical * 1.2) {
    return "Average digital footprint for today.";
  } else {
    return "💡 Consider reducing usage or quality.";
  }
};

const renderPopup = async () => {
  try {
    const events = await storageManager.getEventsToday();
    const categoryTotals = aggregateByCategory(events);
    const total = Object.values(categoryTotals).reduce(
      (sum, value) => sum + value,
      0,
    );

    // Update main total
    document.getElementById("today-total").textContent = formatGrams(total);
    
    // Update category values
    document.getElementById("value-video").textContent = formatGrams(
      categoryTotals.video,
    );
    document.getElementById("value-social").textContent = formatGrams(
      categoryTotals.social,
    );
    document.getElementById("value-shopping").textContent = formatGrams(
      categoryTotals.shopping,
    );

    // Update bars
    updateBars(categoryTotals, total);

    // Update insight
    const insight = getQuickInsight(total, categoryTotals);
    document.getElementById("quick-insight").textContent = insight;

    // Update equivalency
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

  // Update when new events are saved
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "EVENT_SAVED") {
      renderPopup();
    }
  });

  // Dashboard button
  const button = document.getElementById("dashboard-button");
  button.addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("dashboard/dashboard.html"),
    });
  });
};

document.addEventListener("DOMContentLoaded", init);
