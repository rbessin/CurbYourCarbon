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

const renderPopup = async () => {
  try {
    const events = await storageManager.getEventsToday();
    const categoryTotals = aggregateByCategory(events);
    const total = Object.values(categoryTotals).reduce(
      (sum, value) => sum + value,
      0,
    );

    document.getElementById("today-total").textContent = formatGrams(total);
    document.getElementById("value-video").textContent = formatGrams(
      categoryTotals.video,
    );
    document.getElementById("value-social").textContent = formatGrams(
      categoryTotals.social,
    );
    document.getElementById("value-shopping").textContent = formatGrams(
      categoryTotals.shopping,
    );

    updateBars(categoryTotals, total);

    const equivalencies = calculateEquivalencies(total);
    document.getElementById("equivalency-text").textContent =
      `${equivalencies.milesDriven} miles driven`;
  } catch (error) {
    console.warn("Failed to render popup", error);
  }
};

const init = () => {
  renderPopup();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "EVENT_SAVED") {
      renderPopup();
    }
  });

  const button = document.getElementById("dashboard-button");
  button.addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("dashboard/dashboard.html"),
    });
  });
};

document.addEventListener("DOMContentLoaded", init);
