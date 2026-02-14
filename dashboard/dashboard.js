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

// Calculate insights from usage patterns
const generateInsights = (events, total, rangeKey) => {
  const insights = [];

  // Calculate per-day average
  const dayCount = rangeKey === "today" ? 1 : rangeKey === "week" ? 7 : 30;
  const avgPerDay = total / dayCount;

  // Calculate category breakdown
  const categoryTotals = aggregateByCategory(events);
  const videoPercent = (categoryTotals.video / total) * 100;
  const socialPercent = (categoryTotals.social / total) * 100;
  const shoppingPercent = (categoryTotals.shopping / total) * 100;

  // Insight 1: Daily average context
  if (rangeKey !== "today") {
    const avgFormatted = formatGrams(avgPerDay);
    insights.push({
      type: "neutral",
      text: `You average ${avgFormatted} CO₂ per day over this period.`,
    });
  }

  // Insight 2: Dominant category
  if (videoPercent > 60) {
    insights.push({
      type: "info",
      text: `Video streaming accounts for ${videoPercent.toFixed(0)}% of your carbon footprint. Consider lowering video quality to 720p or 480p to reduce emissions.`,
    });
  } else if (socialPercent > 60) {
    insights.push({
      type: "info",
      text: `Social media browsing is your biggest contributor (${socialPercent.toFixed(0)}%). Taking breaks from scrolling can significantly reduce your footprint.`,
    });
  } else if (shoppingPercent > 60) {
    insights.push({
      type: "info",
      text: `Online shopping accounts for ${shoppingPercent.toFixed(0)}% of your digital footprint. Thoughtful browsing and fewer product searches help.`,
    });
  }

  // Insight 3: Comparison to typical user
  const typicalDaily = 1000; // grams per day for typical user
  if (avgPerDay < typicalDaily * 0.7) {
    insights.push({
      type: "positive",
      text: `✨ You're doing great! Your usage is ${((1 - avgPerDay / typicalDaily) * 100).toFixed(0)}% below the average digital user.`,
    });
  } else if (avgPerDay > typicalDaily * 1.5) {
    insights.push({
      type: "warning",
      text: `Your digital carbon footprint is ${((avgPerDay / typicalDaily - 1) * 100).toFixed(0)}% higher than average. Small changes can make a big difference!`,
    });
  }

  // Insight 4: Total context
  if (total > 5000) {
    insights.push({
      type: "neutral",
      text: `This is equivalent to driving ${(total / 404).toFixed(1)} miles in a car.`,
    });
  }

  return insights;
};

// Generate actionable recommendations
const generateRecommendations = (events, categoryTotals) => {
  const recommendations = [];
  const total = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);

  // Video recommendations
  if (categoryTotals.video > total * 0.3) {
    const videoEvents = events.filter((e) => e.type === "video");
    const highRes = videoEvents.filter(
      (e) => e.data?.resolution === "1080p" || e.data?.resolution === "2160p",
    ).length;
    const totalVideo = videoEvents.length;

    if (highRes / totalVideo > 0.7) {
      const savings = categoryTotals.video * 0.3; // ~30% savings possible
      recommendations.push({
        action: "Lower video quality from 1080p to 720p",
        impact: `Save ~${formatGrams(savings)} CO₂`,
        description:
          "On most mobile screens, 720p looks nearly identical to 1080p but uses 30% less data.",
      });
    }
  }

  // Social media recommendations
  if (categoryTotals.social > total * 0.3) {
    recommendations.push({
      action: "Set a daily social media time limit",
      impact: `Save ~${formatGrams(categoryTotals.social * 0.25)} CO₂`,
      description:
        "Reducing scrolling by just 15 minutes per day can significantly lower your footprint.",
    });
  }

  // Shopping recommendations
  if (categoryTotals.shopping > total * 0.2) {
    recommendations.push({
      action: "Browse more intentionally",
      impact: `Save ~${formatGrams(categoryTotals.shopping * 0.3)} CO₂`,
      description:
        "Make a wishlist before browsing, and avoid endless scrolling through product pages.",
    });
  }

  // General recommendation
  if (recommendations.length === 0) {
    recommendations.push({
      action: "Keep up the good work!",
      impact: "Your usage is already efficient",
      description: "Continue being mindful of your digital habits.",
    });
  }

  return recommendations;
};

const renderInsights = (insights) => {
  const container = document.getElementById("insights");
  if (!container) return;

  const typeIcons = {
    positive: "✓",
    warning: "⚠",
    info: "ℹ",
    neutral: "→",
  };

  container.innerHTML = insights
    .map(
      (insight) => `
    <div class="insight insight-${insight.type}">
      <span class="insight-icon">${typeIcons[insight.type]}</span>
      <span class="insight-text">${insight.text}</span>
    </div>
  `,
    )
    .join("");
};

const renderRecommendations = (recommendations) => {
  const container = document.getElementById("recommendations");
  if (!container) return;

  container.innerHTML = recommendations
    .map(
      (rec) => `
    <div class="recommendation">
      <div class="recommendation-header">
        <span class="recommendation-action">${rec.action}</span>
        <span class="recommendation-impact">${rec.impact}</span>
      </div>
      <div class="recommendation-description">${rec.description}</div>
    </div>
  `,
    )
    .join("");
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

  if (categoryChart) {
    categoryChart.destroy();
  }

  const total = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);
  const hasData = total > 0;

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Video Streaming", "Social Media", "Online Shopping"],
      datasets: [
        {
          data: hasData
            ? [
                categoryTotals.video,
                categoryTotals.social,
                categoryTotals.shopping,
              ]
            : [1, 1, 1],
          backgroundColor: hasData
            ? ["#3fa34d", "#4b8f59", "#6fa36c"]
            : ["#e0e0e0", "#e0e0e0", "#e0e0e0"],
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          enabled: hasData,
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.parsed || 0;
              const percent = ((value / total) * 100).toFixed(1);
              return `${label}: ${formatGrams(value)} (${percent}%)`;
            },
          },
        },
      },
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
  const hasData = data.length > 0 && data.some((v) => v > 0);

  platformChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: hasData ? labels : ["No data yet"],
      datasets: [
        {
          label: "CO₂ (g)",
          data: hasData ? data : [0],
          backgroundColor: hasData ? "#2f7d32" : "#e0e0e0",
        },
      ],
    },
    options: {
      scales: { y: { beginAtZero: true } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${formatGrams(context.parsed.y)} CO₂`;
            },
          },
        },
      },
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
  const hasData = data.length > 0 && data.some((v) => v > 0);

  timelineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: hasData ? labels : ["No data yet"],
      datasets: [
        {
          label: "CO₂ (g)",
          data: hasData ? data : [0],
          borderColor: hasData ? "#2f7d32" : "#e0e0e0",
          backgroundColor: hasData
            ? "rgba(47, 125, 50, 0.2)"
            : "rgba(224, 224, 224, 0.2)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      scales: { y: { beginAtZero: true } },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${formatGrams(context.parsed.y)} CO₂`;
            },
          },
        },
      },
    },
  });
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
      `${formatGrams(total)} CO₂`;

    // Generate and render insights
    const insights = generateInsights(events, total, rangeKey);
    renderInsights(insights);

    // Generate and render recommendations
    const recommendations = generateRecommendations(events, categoryTotals);
    renderRecommendations(recommendations);

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
