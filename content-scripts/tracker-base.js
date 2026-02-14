/**
 * Shared helpers for content script trackers.
 */
let activeTracker = null;

/**
 * Send an event payload to the background service worker.
 * @param {Object} eventData
 * @returns {Promise<Object>}
 */
const sendEventToBackground = (eventData) => {
  return new Promise((resolve) => {
    // Check if extension context is valid
    if (!chrome.runtime?.id) {
      console.log("CurbYourCarbon: Extension reloaded/disabled, data will send on next navigation");
      resolve({ ok: false, error: "Extension context invalidated", shouldRetry: true });
      return;
    }

    chrome.runtime.sendMessage({ type: "TRACK_EVENT", payload: eventData }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("CurbYourCarbon: Service worker inactive, will retry later");
        resolve({ ok: false, error: chrome.runtime.lastError.message, shouldRetry: true });
        return;
      }
      resolve(response || { ok: true });
    });
  });
};

/**
 * Track active time while the tab is visible/focused.
 * @returns {{getActiveMinutes: () => number, reset: () => void}}
 */
const getActiveTime = () => {
  if (activeTracker) {
    return activeTracker;
  }

  let visibleSince = document.visibilityState === "visible" ? Date.now() : null;
  let totalMs = 0;

  const updateVisibility = () => {
    if (document.visibilityState === "visible") {
      if (visibleSince === null) {
        visibleSince = Date.now();
      }
    } else if (visibleSince !== null) {
      totalMs += Date.now() - visibleSince;
      visibleSince = null;
    }
  };

  const updateFocus = () => {
    if (document.hasFocus()) {
      if (visibleSince === null && document.visibilityState === "visible") {
        visibleSince = Date.now();
      }
    } else if (visibleSince !== null) {
      totalMs += Date.now() - visibleSince;
      visibleSince = null;
    }
  };

  document.addEventListener("visibilitychange", updateVisibility);
  window.addEventListener("focus", updateFocus);
  window.addEventListener("blur", updateFocus);

  activeTracker = {
    getActiveMinutes: () => {
      let total = totalMs;
      if (visibleSince !== null) {
        total += Date.now() - visibleSince;
      }
      return +(total / 60000).toFixed(2);
    },
    reset: () => {
      totalMs = 0;
      visibleSince = document.visibilityState === "visible" ? Date.now() : null;
    }
  };

  return activeTracker;
};

/**
 * Debounce helper for performance-sensitive callbacks.
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
const debounce = (func, wait) => {
  let timeoutId = null;
  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), wait);
  };
};

// Make functions available globally for other content scripts
window.CurbYourCarbon = window.CurbYourCarbon || {};
window.CurbYourCarbon.sendEventToBackground = sendEventToBackground;
window.CurbYourCarbon.getActiveTime = getActiveTime;
window.CurbYourCarbon.debounce = debounce;
