/**
 * Service Worker - Event orchestration only
 *
 * Routes messages and coordinates between services
 */
import { processTrackingEvent, storageManager } from "./event-processor.js";
import {
  requestGeolocationFromOffscreen,
  setLastKnownLocation,
} from "../services/electricity-maps.js";

// Expose for debugging
globalThis.storageManager = storageManager;

/**
 * Handle location request from dashboard
 */
const handleLocationRequest = async (sendResponse) => {
  try {
    const location = await requestGeolocationFromOffscreen();

    if (location) {
      await setLastKnownLocation(location.lat, location.lon);
      sendResponse({ success: true, location });
    } else {
      sendResponse({
        success: false,
        error: "Location permission denied or unavailable",
      });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
};

/**
 * Handle tracking event from content script
 */
const handleTrackingEvent = async (payload, sender, sendResponse) => {
  try {
    const result = await processTrackingEvent(payload);

    // Notify dashboard if open
    chrome.runtime.sendMessage({ type: "EVENT_SAVED", payload: result }, () => {
      if (chrome.runtime.lastError) {
        // Dashboard not open; OK
      }
    });

    sendResponse(result);
  } catch (error) {
    sendResponse({
      ok: false,
      error: error.message || "Failed to save event",
    });
  }
};

/**
 * Message router
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REQUEST_LOCATION") {
    handleLocationRequest(sendResponse);
    return true;
  }

  if (message.type === "TRACK_EVENT") {
    handleTrackingEvent(message.payload, sender, sendResponse);
    return true;
  }

  return false;
});

/**
 * Extension lifecycle events
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await chrome.storage.sync.set({ deviceType: "auto" });
  }
});
