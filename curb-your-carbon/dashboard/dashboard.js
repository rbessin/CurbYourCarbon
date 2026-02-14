import { StorageManager } from "../core/storage-manager.js";
import {
  aggregateByCategory,
  calculateEquivalencies,
} from "../core/carbon-calculator.js";

const storageManager = new StorageManager();
let categoryChart = null;
let timelineChart = null;
let platformChart = null;

const formatGrams = (grams) => {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(2)} kg`;
  }
  return `${grams.toFixed(1)} g`;
};

const getRange = (rangeKey) => {
  const end = new Date();
  const start = new Date();

  if (rangeKey === "week") {
    start.setDate(end.getDate() - 6);
  } else if (rangeKey === "month") {
    start.setDate(end.getDate() - 29);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const renderEquivalencies = (total) => {
  const container = document.getElementById("equivalencies");
  const eq = calculateEquivalencies(total);
  container.innerHTML = `
    <div>${eq.milesDriven} miles driven</div>
    <div>${eq.phonesCharged} phones charged</div>
    <div>${eq.treesNeeded} trees needed (year)</div>
  `;
};

const renderCategoryChart = (categoryTotals) => {
  const ctx = document.getElementById("category-chart");
  if (!window.Chart || !ctx) return;

  if (categoryChart) {
    categoryChart.destroy();
  }

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Video", "Social", "Shopping"],
      datasets: [
        {
          data: [
            categoryTotals.video,
            categoryTotals.social,
            categoryTotals.shopping,
          ],
          backgroundColor: ["#3fa34d", "#4b8f59", "#6fa36c"],
        },
      ],
    },
    options: {
      plugins: { legend: { position: "bottom" } },
    },
  });
};

const renderPlatformChart = (platformTotals) => {
  const ctx = document.getElementById("platform-chart");
  if (!window.Chart || !ctx) return;

  if (platformChart) {
    platformChart.destroy();
  }

  const labels = Object.keys(platformTotals);
  const data = Object.values(platformTotals);

  platformChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "CO2 (g)",
          data,
          backgroundColor: "#2f7d32",
        },
      ],
    },
    options: {
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });
};

const renderTimelineChart = (events) => {
  const ctx = document.getElementById("timeline-chart");
  if (!window.Chart || !ctx) return;

  if (timelineChart) {
    timelineChart.destroy();
  }

  const grouped = events.reduce((acc, event) => {
    const dateKey = new Date(event.timestamp).toLocaleDateString();
    acc[dateKey] = (acc[dateKey] || 0) + (event.carbonGrams || 0);
    return acc;
  }, {});

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);

  timelineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "CO2 (g)",
          data,
          borderColor: "#2f7d32",
          backgroundColor: "rgba(47, 125, 50, 0.2)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      scales: { y: { beginAtZero: true } },
    },
  });

  // TODO: Replace with daily summary aggregation for performance.
};

const renderDashboard = async (rangeKey) => {
  try {
    const { start, end } = getRange(rangeKey);
    const events = await storageManager.getEventsInRange(start, end);

    const categoryTotals = aggregateByCategory(events);
    const total = Object.values(categoryTotals).reduce(
      (sum, value) => sum + value,
      0,
    );

    const platformTotals = events.reduce((acc, event) => {
      if (!acc[event.platform]) {
        acc[event.platform] = 0;
      }
      acc[event.platform] += event.carbonGrams || 0;
      return acc;
    }, {});

    document.getElementById("total-impact").textContent =
      `${formatGrams(total)} CO2`;

    renderEquivalencies(total);
    renderCategoryChart(categoryTotals);
    renderPlatformChart(platformTotals);
    renderTimelineChart(events);
  } catch (error) {
    console.warn("Failed to render dashboard", error);
  }
};

const bindRangeButtons = () => {
  const buttons = document.querySelectorAll(".range-toggle button");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderDashboard(button.dataset.range);
    });
  });
};

document.addEventListener("DOMContentLoaded", () => {
  bindRangeButtons();
  renderDashboard("today");

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "EVENT_SAVED") {
      const active = document.querySelector(".range-toggle .active");
      renderDashboard(active ? active.dataset.range : "today");
    }
  });
});
