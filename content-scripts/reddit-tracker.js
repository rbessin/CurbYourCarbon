// Reddit browsing tracking content script with enhanced media tracking
(function() {
  'use strict';

  console.log("CurbYourCarbon: Reddit tracker initialized");

  if (!location.hostname.includes("reddit.com")) {
    console.log("CurbYourCarbon: Not a Reddit page");
    return;
  }

  // Wait for tracker base to be available
  if (!window.CurbYourCarbon) {
    console.error("CurbYourCarbon: tracker-base.js not loaded properly");
    return;
  }

  const { getActiveTime, sendEventToBackground, debounce } = window.CurbYourCarbon;

  const state = {
    activeTime: getActiveTime(),
    postsLoaded: 0,
    mediaCount: 0,
    imagesLoaded: new Set(),
    videosLoaded: new Set()
  };

  // Helper: Track images with size detection
  const scanImages = () => {
    const images = document.querySelectorAll('img[src]');
    images.forEach(img => {
      const src = img.src;
      if (!src || state.imagesLoaded.has(src)) return;

      // Filter for content images (exclude UI elements, avatars < 100px)
      if (img.naturalWidth > 100 && img.naturalHeight > 100) {
        state.imagesLoaded.add(src);
      } else if (!img.complete) {
        // Wait for image to load to check size
        img.addEventListener('load', () => {
          if (img.naturalWidth > 100 && img.naturalHeight > 100) {
            state.imagesLoaded.add(src);
          }
        }, { once: true });
      }
    });
  };

  // Helper: Track videos
  const scanVideos = () => {
    // Native video elements
    const videos = document.querySelectorAll('video[src], video source[src]');
    videos.forEach(video => {
      const src = video.src || video.querySelector('source')?.src;
      if (src && !state.videosLoaded.has(src)) {
        state.videosLoaded.add(src);
      }
    });

    // Reddit video containers
    const redditVideos = document.querySelectorAll('[data-click-id="video"], shreddit-player');
    redditVideos.forEach(container => {
      const videoId = container.getAttribute('data-video-id') || container.id;
      if (videoId && !state.videosLoaded.has(videoId)) {
        state.videosLoaded.add(videoId);
      }
    });
  };

  // Comprehensive content scan
  const scanContent = () => {
    // Count posts - try multiple selectors for different Reddit layouts
    const posts = document.querySelectorAll(
      "shreddit-post, " +
      "[slot='post-container'], " +
      "div[data-testid='post-container'], " +
      "article[data-testid='post-container'], " +
      "[data-test-id='post-content']"
    );
    state.postsLoaded = Math.max(state.postsLoaded, posts.length);

    // Legacy media count (for backward compatibility)
    const allMedia = document.querySelectorAll("img, video");
    state.mediaCount = Math.max(state.mediaCount, allMedia.length);

    // Detailed media tracking
    scanImages();
    scanVideos();

    if (state.postsLoaded > 0 || state.imagesLoaded.size > 0) {
      console.log("CurbYourCarbon: Reddit - Posts:", state.postsLoaded, 
                  "Media:", state.mediaCount, 
                  "Images:", state.imagesLoaded.size,
                  "Videos:", state.videosLoaded.size);
    }
  };

  const debouncedScan = debounce(scanContent, 400);

  // Send summary to background
  const sendSummary = async (reason = "navigation") => {
    const timeActive = state.activeTime.getActiveMinutes();
    if (timeActive <= 0 && state.postsLoaded === 0) {
      console.log("CurbYourCarbon: Reddit - no activity to report");
      return;
    }

    console.log("CurbYourCarbon: Sending Reddit summary -", {
      reason,
      timeActive: timeActive.toFixed(2),
      posts: state.postsLoaded,
      media: state.mediaCount,
      images: state.imagesLoaded.size,
      videos: state.videosLoaded.size
    });

    const result = await sendEventToBackground({
      type: "social",
      platform: "reddit",
      timeActive: +timeActive.toFixed(2),
      postsLoaded: state.postsLoaded,
      mediaCount: state.mediaCount,
      imagesLoaded: state.imagesLoaded.size,
      videosLoaded: state.videosLoaded.size,
      timestamp: Date.now(),
    });

    if (result.ok) {
      console.log("CurbYourCarbon: Reddit event saved successfully, carbon:", result.carbonGrams, "g");
      // Reset state after successful send
      state.activeTime.reset();
      state.postsLoaded = 0;
      state.mediaCount = 0;
      state.imagesLoaded.clear();
      state.videosLoaded.clear();
    } else {
      console.error("CurbYourCarbon: Failed to save Reddit event:", result.error);
    }
  };

  // Periodic summary (every 30 seconds for testing/demo)
  const PERIODIC_INTERVAL = 30 * 1000; // 30 seconds
  const periodicSummary = setInterval(() => {
    const timeActive = state.activeTime.getActiveMinutes();
    if (timeActive >= 0.45) { // Only send if we have ~30 seconds of activity
      console.log("CurbYourCarbon: Sending periodic Reddit summary");
      sendSummary("periodic");
    }
  }, PERIODIC_INTERVAL);

  // Event listeners
  window.addEventListener("scroll", debouncedScan, { passive: true });
  window.addEventListener("resize", debouncedScan);

  // Use MutationObserver for dynamic content (infinite scroll)
  const observer = new MutationObserver(debouncedScan);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Send summary on page exit
  window.addEventListener("pagehide", () => {
    clearInterval(periodicSummary);
    sendSummary("pagehide");
  });
  window.addEventListener("beforeunload", () => {
    clearInterval(periodicSummary);
    sendSummary("beforeunload");
  });

  // Initial scan
  scanContent();

  console.log("CurbYourCarbon: Reddit tracker ready with enhanced media tracking");
})();
