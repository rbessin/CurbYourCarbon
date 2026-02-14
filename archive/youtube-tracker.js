// YouTube video tracking content script with SPA navigation support
(function() {
  'use strict';

  console.log("CurbYourCarbon: YouTube tracker initialized");

  if (!location.hostname.includes("youtube.com")) {
    console.log("CurbYourCarbon: Not a YouTube page");
    return;
  }

  // Wait for tracker base to be available
  if (!window.CurbYourCarbon || !window.CurbYourCarbon.sendEventToBackground) {
    console.error("CurbYourCarbon: tracker-base.js not loaded properly");
    return;
  }

  const { sendEventToBackground, getDeviceInfo } = window.CurbYourCarbon;

  const state = {
    playStart: null,
    resolution: "1080p",
    currentVideo: null,
    lastUrl: location.href,
    accumulatedTime: 0 // Track time across video changes
  };

  const getResolutionLabel = (height) => {
    if (height >= 2160) return "2160p";
    if (height >= 1440) return "1440p";
    if (height >= 1080) return "1080p";
    if (height >= 720) return "720p";
    if (height >= 480) return "480p";
    return "360p";
  };

  const sendVideoEvent = async (durationMinutes, resolution) => {
    if (durationMinutes <= 0.05) return;

    console.log("CurbYourCarbon: Sending event -", durationMinutes.toFixed(2), "minutes at", resolution);
    
    // Get device info to include in payload
    const deviceInfo = await getDeviceInfo();
    
    const result = await sendEventToBackground({
      type: "video",
      platform: "youtube",
      duration: +durationMinutes.toFixed(2),
      resolution: resolution,
      deviceInfo: deviceInfo,
      timestamp: Date.now()
    });

    if (result.ok) {
      console.log("CurbYourCarbon: Event saved successfully, carbon:", result.carbonGrams, "g");
    } else if (!result.shouldRetry) {
      // Only log real errors, not service worker being inactive
      console.error("CurbYourCarbon: Failed to save event:", result.error);
    }
    // If shouldRetry is true, event will be captured on next pause/navigation
  };

  const detachFromVideo = (video) => {
    if (!video || !video._curbYourCarbonAttached) return;

    // Remove all listeners
    video.removeEventListener("play", video._curbPlayHandler);
    video.removeEventListener("pause", video._curbPauseHandler);
    video.removeEventListener("ended", video._curbEndHandler);
    video.removeEventListener("loadedmetadata", video._curbMetadataHandler);
    
    video._curbYourCarbonAttached = false;
    console.log("CurbYourCarbon: Detached from video element");
  };

  const attachToVideo = (video) => {
    if (!video) {
      console.warn("CurbYourCarbon: No video element to attach to");
      return;
    }

    // Don't attach twice to the same video
    if (video._curbYourCarbonAttached) {
      console.log("CurbYourCarbon: Already attached to this video");
      return;
    }

    console.log("CurbYourCarbon: Attaching to video element");

    // Check if video is already playing when we attach
    const isAlreadyPlaying = !video.paused && !video.ended && video.currentTime > 0;
    if (isAlreadyPlaying) {
      console.log("CurbYourCarbon: Video is already playing, initializing state");
    }

    const updateResolution = () => {
      const nextResolution = getResolutionLabel(video.videoHeight || 1080);
      if (state.resolution !== nextResolution) {
        state.resolution = nextResolution;
        console.log("CurbYourCarbon: Resolution updated to", state.resolution);
      }
    };

    const handlePlay = () => {
      updateResolution();
      state.playStart = Date.now();
      console.log("CurbYourCarbon: Video started playing at", state.resolution);
    };

    const handlePause = async () => {
      if (!state.playStart) return;
      
      const durationMinutes = (Date.now() - state.playStart) / 60000;
      state.accumulatedTime += durationMinutes;
      state.playStart = null;

      console.log("CurbYourCarbon: Video paused, session:", durationMinutes.toFixed(2), "min, total:", state.accumulatedTime.toFixed(2), "min");

      // Send event immediately on pause
      if (durationMinutes > 0.05) {
        await sendVideoEvent(durationMinutes, state.resolution);
      }
    };

    const handleEnded = async () => {
      if (!state.playStart) return;
      
      const durationMinutes = (Date.now() - state.playStart) / 60000;
      state.accumulatedTime += durationMinutes;
      state.playStart = null;

      console.log("CurbYourCarbon: Video ended, session:", durationMinutes.toFixed(2), "min, total:", state.accumulatedTime.toFixed(2), "min");

      // Send event on video end
      if (durationMinutes > 0.05) {
        await sendVideoEvent(durationMinutes, state.resolution);
      }
    };

    // Store handlers on the video element for later removal
    video._curbPlayHandler = handlePlay;
    video._curbPauseHandler = handlePause;
    video._curbEndHandler = handleEnded;
    video._curbMetadataHandler = updateResolution;
    video._curbYourCarbonAttached = true;

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("loadedmetadata", updateResolution);

    state.currentVideo = video;
    console.log("CurbYourCarbon: Event listeners attached to video");

    // If video is already playing, initialize tracking state
    if (isAlreadyPlaying) {
      updateResolution();
      if (!state.playStart) {
        state.playStart = Date.now();
        console.log("CurbYourCarbon: Initialized playStart because video was already playing");
      }
      console.log("CurbYourCarbon: Started tracking already-playing video at", state.resolution);
    }
  };

  // Handle SPA navigation (URL changes without page reload)
  const handleNavigation = () => {
    const currentUrl = location.href;
    if (currentUrl !== state.lastUrl) {
      console.log("CurbYourCarbon: YouTube navigation detected");
      
      // If currently playing, send summary for previous video
      if (state.playStart) {
        const durationMinutes = (Date.now() - state.playStart) / 60000;
        if (durationMinutes > 0.05) {
          sendVideoEvent(durationMinutes, state.resolution);
        }
        state.playStart = null;
      }

      state.lastUrl = currentUrl;
      
      // Look for new video element after navigation
      setTimeout(() => {
        const newVideo = document.querySelector("video");
        if (newVideo && newVideo !== state.currentVideo) {
          detachFromVideo(state.currentVideo);
          attachToVideo(newVideo);
        }
      }, 1000);
    }
  };

  // Periodic check for video element (in case it changes)
  const periodicVideoCheck = setInterval(() => {
    const video = document.querySelector("video");
    if (video && video !== state.currentVideo) {
      console.log("CurbYourCarbon: New video element detected");
      detachFromVideo(state.currentVideo);
      attachToVideo(video);
    }
  }, 3000);

  // Periodic summary for long watching sessions (every 60 seconds for testing/demo)
  const PERIODIC_INTERVAL = 60 * 1000; // 60 seconds
  const periodicSummary = setInterval(() => {
    if (state.playStart) {
      const durationMinutes = (Date.now() - state.playStart) / 60000;
      if (durationMinutes >= 0.95) { // ~60 seconds
        console.log("CurbYourCarbon: Sending periodic YouTube summary");
        sendVideoEvent(durationMinutes, state.resolution);
        state.playStart = Date.now(); // Reset timer
      }
    }
  }, PERIODIC_INTERVAL);

  // Monitor URL changes (YouTube uses pushState for navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function() {
    originalPushState.apply(history, arguments);
    handleNavigation();
  };

  history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    handleNavigation();
  };

  window.addEventListener('popstate', handleNavigation);

  // Cleanup on page exit
  window.addEventListener('pagehide', () => {
    clearInterval(periodicVideoCheck);
    clearInterval(periodicSummary);
    if (state.playStart) {
      const durationMinutes = (Date.now() - state.playStart) / 60000;
      if (durationMinutes > 0.05) {
        sendVideoEvent(durationMinutes, state.resolution);
      }
    }
  });

  const init = () => {
    console.log("CurbYourCarbon: Initializing YouTube tracker");
    
    const video = document.querySelector("video");
    if (video) {
      console.log("CurbYourCarbon: Video element found immediately");
      attachToVideo(video);
      return;
    }

    console.log("CurbYourCarbon: Video element not found, observing DOM...");

    const observer = new MutationObserver(() => {
      const player = document.querySelector("video");
      if (player) {
        console.log("CurbYourCarbon: Video element found via observer");
        observer.disconnect();
        attachToVideo(player);
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log("CurbYourCarbon: YouTube tracker ready with SPA navigation support");
})();
