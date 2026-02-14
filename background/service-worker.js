import { StorageManager } from "../core/storage-manager.js";
import { calculateTotalCarbon, getDeviceEnergyConsumption } from "../core/carbon-calculator.js";

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
    byCategory: { media: 0, shopping: 0, browsing: 0 },
    byPlatform: {},
  };

  existing.totalCarbon += eventRecord.carbonGrams;
  
  // Update category totals
  const category = eventRecord.type || 'browsing';
  if (!existing.byCategory[category]) {
    existing.byCategory[category] = 0;
  }
  existing.byCategory[category] += eventRecord.carbonGrams;
  
  // Update platform totals
  if (!existing.byPlatform[eventRecord.platform]) {
    existing.byPlatform[eventRecord.platform] = 0;
  }
  existing.byPlatform[eventRecord.platform] += eventRecord.carbonGrams;

  await storageManager.saveDailySummary(existing);
};

/**
 * Calculate carbon emissions from event data.
 * 
 * Uses Performance API data (actual bytes transferred) to calculate
 * precise carbon footprint with user's device settings.
 */
const calculateEventCarbon = async (payload) => {
  // Get user's device energy consumption
  const deviceWatts = await getDeviceEnergyConsumption();
  
  console.log("CurbYourCarbon: Calculating with device watts:", deviceWatts, "W");
  
  // Use Performance API-based calculation with actual device
  const carbon = calculateTotalCarbon(payload, {
    deviceWatts,
    // FUTURE: Add regional carbon intensity
    // carbonIntensity: await getRegionalCarbonIntensity(userLocation),
  });
  
  console.log("CurbYourCarbon: Carbon breakdown - Network + Device =", carbon, "g");
  
  return carbon;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "TRACK_EVENT") {
    return;
  }

  console.log("CurbYourCarbon: Received TRACK_EVENT from", sender.tab?.url || "popup");

  (async () => {
    try {
      const payload = message.payload || {};
      const carbonGrams = await calculateEventCarbon(payload);
      
      const eventRecord = {
        timestamp: payload.timestamp || Date.now(),
        type: payload.type || 'browsing',
        platform: payload.platform || 'unknown',
        data: payload,
        carbonGrams,
      };

      await storageManager.saveEvent(eventRecord);
      await updateDailySummary(eventRecord);

      console.log("CurbYourCarbon: Event saved -", carbonGrams, "g CO2 from", payload.platform);

      // Notify popup if it's open (ignore errors if nothing is listening)
      chrome.runtime.sendMessage({ type: "EVENT_SAVED", payload: eventRecord }, () => {
        // Accessing lastError prevents console errors when popup is closed
        if (chrome.runtime.lastError) {
          // Popup not open, that's fine
        }
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

  return true; // Keep message channel open for async response
});

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // Set default device to auto-detect on first install
    await chrome.storage.sync.set({ deviceType: 'auto' });
    console.log("CurbYourCarbon: Extension installed - Universal tracking enabled");
    console.log("CurbYourCarbon: Device set to auto-detect by default");
  }
  if (details.reason === "update") {
    // On update, set auto-detect if no device preference exists
    const result = await chrome.storage.sync.get('deviceType');
    if (!result.deviceType) {
      await chrome.storage.sync.set({ deviceType: 'auto' });
      console.log("CurbYourCarbon: Device preference set to auto-detect");
    }
    console.log("CurbYourCarbon: Extension updated to", chrome.runtime.getManifest().version);
  }
});

console.log("CurbYourCarbon: Service worker initialized with Performance API tracking");
