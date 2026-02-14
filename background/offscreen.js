"use strict";

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 5 * 60 * 1000,
};

const sendRuntimeMessage = (message) => {
  chrome.runtime.sendMessage(message, () => {
    chrome.runtime.lastError;
  });
};

const handleGeolocationRequest = (requestId) => {
  if (!navigator.geolocation) {
    sendRuntimeMessage({
      type: "GEOLOCATION_ERROR",
      requestId,
      error: "Geolocation API unavailable",
    });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      sendRuntimeMessage({
        type: "GEOLOCATION_RESULT",
        requestId,
        payload: {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        },
      });
    },
    (error) => {
      sendRuntimeMessage({
        type: "GEOLOCATION_ERROR",
        requestId,
        error: error?.message || "Failed to get geolocation",
      });
    },
    GEOLOCATION_OPTIONS,
  );
};

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "GET_GEOLOCATION") {
    return;
  }
  handleGeolocationRequest(message.requestId || null);
});
