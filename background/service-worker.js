import { StorageManager } from "../core/storage-manager.js";
import {
  calculateShoppingImpact,
  calculateSocialImpact,
  calculateVideoImpact,
} from "../core/carbon-calculator.js";

const storageManager = new StorageManager();

const getDateKey = (timestamp) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const updateDailySummary = async (eventRecord) => {
  const dateKey = getDateKey(eventRecord.timestamp);
  const existing = (await storageManager.getDailySummary(dateKey)) || {
    date: dateKey,
    totalCarbon: 0,
    byCategory: { video: 0, social: 0, shopping: 0 },
    byPlatform: {},
  };

  existing.totalCarbon += eventRecord.carbonGrams;
  if (existing.byCategory[eventRecord.type] !== undefined) {
    existing.byCategory[eventRecord.type] += eventRecord.carbonGrams;
  }
  if (!existing.byPlatform[eventRecord.platform]) {
    existing.byPlatform[eventRecord.platform] = 0;
  }
  existing.byPlatform[eventRecord.platform] += eventRecord.carbonGrams;

  await storageManager.saveDailySummary(existing);
};

const calculateEventCarbon = (payload) => {
  if (payload.type === "video") {
    return calculateVideoImpact(
      payload.duration || 0,
      payload.resolution || "1080p",
    );
  }
  if (payload.type === "social") {
    return calculateSocialImpact(
      payload.timeActive || 0,
      payload.mediaCount || 0,
      payload.imagesLoaded || 0,
      payload.videosLoaded || 0,
    );
  }
  if (payload.type === "shopping") {
    return calculateShoppingImpact(
      payload.timeActive || 0,
      payload.productsViewed || 0,
      payload.productCardsLoaded || 0,
      payload.imagesLoaded || 0,
      payload.highResImages || 0,
      payload.videosLoaded || 0,
    );
  }
  return 0;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "TRACK_EVENT") {
    return;
  }

  console.log("CurbYourCarbon: Received TRACK_EVENT", message.payload);

  (async () => {
    try {
      const payload = message.payload || {};
      const carbonGrams = calculateEventCarbon(payload);
      const eventRecord = {
        timestamp: payload.timestamp || Date.now(),
        type: payload.type,
        platform: payload.platform,
        data: payload,
        carbonGrams,
      };

      await storageManager.saveEvent(eventRecord);
      await updateDailySummary(eventRecord);

      console.log("CurbYourCarbon: Event saved successfully", eventRecord);

      // Notify popup if it's open (ignore errors if nothing is listening)
      chrome.runtime.sendMessage({ type: "EVENT_SAVED", payload: eventRecord }, () => {
        // Ignore "no receiver" errors - popup might not be open
        chrome.runtime.lastError;
      });
      
      sendResponse({ ok: true, carbonGrams });
    } catch (error) {
      console.error("CurbYourCarbon: Failed to save event", error);
      sendResponse({
        ok: false,
        error: error.message || "Failed to save event",
      });
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("CurbYourCarbon: Extension installed");
  }
  if (details.reason === "update") {
    console.log("CurbYourCarbon: Extension updated");
  }
});

console.log("CurbYourCarbon: Service worker initialized");
