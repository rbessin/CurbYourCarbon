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
      console.log(
        "CurbYourCarbon: Extension reloaded/disabled, data will send on next navigation",
      );
      resolve({
        ok: false,
        error: "Extension context invalidated",
        shouldRetry: true,
      });
      return;
    }

    chrome.runtime.sendMessage(
      { type: "TRACK_EVENT", payload: eventData },
      (response) => {
        if (chrome.runtime.lastError) {
          console.log(
            "CurbYourCarbon: Service worker inactive, will retry later",
          );
          resolve({
            ok: false,
            error: chrome.runtime.lastError.message,
            shouldRetry: true,
          });
          return;
        }
        resolve(response || { ok: true });
      },
    );
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
    },
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

/**
 * Detect device type and OS, cache in memory and chrome.storage.local.
 * @returns {Promise<{deviceClass: string, os: string, isMobile: boolean, screenSize: string}>}
 */
const getDeviceInfo = async () => {
  // Check cache first (avoid recomputing on every call)
  if (window._cachedDeviceInfo) {
    console.log(window._cachedDeviceInfo);
    return window._cachedDeviceInfo;
  }

  // Try to read from chrome.storage.local
  return new Promise((resolve) => {
    chrome.storage.local.get(["deviceInfo"], (result) => {
      if (result.deviceInfo) {
        window._cachedDeviceInfo = result.deviceInfo;
        console.log(result.deviceInfo);
        resolve(result.deviceInfo);
        return;
      }

      // Detect device info
      const userAgent = navigator.userAgent.toLowerCase();
      const platform = navigator.platform?.toLowerCase() || "";
      const maxTouchPoints = navigator.maxTouchPoints || 0;
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;

      // Detect OS
      let os = "Unknown";
      if (userAgent.includes("win")) os = "Windows";
      else if (userAgent.includes("mac")) os = "macOS";
      else if (userAgent.includes("linux")) os = "Linux";
      else if (userAgent.includes("android")) os = "Android";
      else if (userAgent.includes("iphone") || userAgent.includes("ipad"))
        os = "iOS";
      else if (userAgent.includes("cros")) os = "ChromeOS";

      // Detect device class
      const isMobile = /android|iphone|ipad|ipod|mobile/.test(userAgent);
      const isTablet =
        (isMobile && Math.min(screenWidth, screenHeight) >= 600) ||
        userAgent.includes("ipad");

      let deviceClass = "desktop";
      if (isTablet) {
        deviceClass = "tablet";
      } else if (isMobile) {
        deviceClass = "phone";
      } else if (maxTouchPoints > 0 && screenWidth < 1366) {
        deviceClass = "laptop-touchscreen";
      } else if (screenWidth >= 1920) {
        deviceClass = "desktop";
      } else {
        deviceClass = "laptop";
      }

      // Screen size category
      let screenSize = "medium";
      const minDimension = Math.min(screenWidth, screenHeight);
      if (minDimension < 600) screenSize = "small";
      else if (minDimension >= 1200) screenSize = "large";

      const deviceInfo = {
        deviceClass,
        os,
        isMobile,
        screenSize,
        detectedAt: Date.now(),
      };

      // Cache in memory and storage
      window._cachedDeviceInfo = deviceInfo;
      chrome.storage.local.set({ deviceInfo }, () => {
        console.log(
          "CurbYourCarbon: Device info detected and stored",
          deviceInfo,
        );
      });

      resolve(deviceInfo);
    });
  });
};

// Make functions available globally for other content scripts
window.CurbYourCarbon = window.CurbYourCarbon || {};
window.CurbYourCarbon.sendEventToBackground = sendEventToBackground;
window.CurbYourCarbon.getActiveTime = getActiveTime;
window.CurbYourCarbon.debounce = debounce;
window.CurbYourCarbon.getDeviceInfo = getDeviceInfo;
