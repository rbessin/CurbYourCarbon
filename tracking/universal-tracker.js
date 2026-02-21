// Universal website tracker using Performance API
// Works on ANY website by measuring actual data transfer
(function () {
  "use strict";

  console.log(
    "CurbYourCarbon: Universal tracker initialized on",
    window.location.hostname,
  );

  // Wait for tracker base to be available
  if (!window.CurbYourCarbon) {
    console.error("CurbYourCarbon: tracker-base.js not loaded properly");
    return;
  }

  const { getActiveTime, sendEventToBackground } = window.CurbYourCarbon;

  // State management
  const state = {
    activeTime: getActiveTime(),
    startTime: Date.now(),
    lastSendTime: Date.now(),

    // Data transfer tracking (in bytes)
    totalBytes: 0,
    imageBytes: 0,
    videoBytes: 0,
    scriptBytes: 0,
    stylesheetBytes: 0,
    documentBytes: 0,
    otherBytes: 0,

    // Resource counts
    resourceCounts: {
      image: 0,
      video: 0,
      script: 0,
      stylesheet: 0,
      document: 0,
      other: 0,
    },

    // Processed resources (to avoid double-counting)
    processedResources: new Set(),
  };

  /**
   * Get the domain for categorization
   */
  const getDomain = () => {
    return window.location.hostname.replace(/^www\./, "");
  };

  /**
   * Categorize website into simplified user-friendly categories.
   *
   * 3 categories:
   * - media: Streaming & Social (YouTube, Netflix, Instagram, Reddit, etc.)
   * - shopping: E-commerce (Amazon, eBay, etc.)
   * - browsing: Everything else (news, docs, search, etc.)
   */
  const categorizeWebsite = (domain) => {
    const categories = {
      // Streaming & Social Media
      media: [
        // Video streaming
        "youtube.com",
        "youtu.be",
        "netflix.com",
        "twitch.tv",
        "vimeo.com",
        "hulu.com",
        "disneyplus.com",
        "hbomax.com",
        "primevideo.com",
        "crunchyroll.com",
        // Social media
        "reddit.com",
        "instagram.com",
        "facebook.com",
        "twitter.com",
        "x.com",
        "tiktok.com",
        "linkedin.com",
        "pinterest.com",
        "snapchat.com",
        "tumblr.com",
      ],

      // E-commerce & Shopping
      shopping: [
        "amazon.com",
        "ebay.com",
        "etsy.com",
        "walmart.com",
        "target.com",
        "bestbuy.com",
        "aliexpress.com",
        "shopify.com",
        "wayfair.com",
      ],

      // Everything else defaults to 'browsing'
      // (news, docs, email, search, blogs, productivity)
    };

    for (const [category, domains] of Object.entries(categories)) {
      if (domains.some((d) => domain.includes(d))) {
        return category;
      }
    }

    return "browsing"; // Default: news, docs, productivity, etc.
  };

  /**
   * Detect if a URL is likely video streaming content.
   */
  const isVideoStreamingUrl = (url) => {
    // Common video CDN patterns
    const videoPatterns = [
      "googlevideo.com", // YouTube
      "cloudfront.net/video", // Generic video CDN
      "twitch.tv/video", // Twitch HLS
      ".m3u8", // HLS manifest
      ".ts", // HLS chunks (can be ambiguous)
      "video.twitch.tv", // Twitch video
      "vod-", // Video on demand
      "nflxvideo.net", // Netflix
      "hls.ttvnw.net", // Twitch HLS
      "video-edge", // Generic video edge
      "/manifest/", // Streaming manifests
      "playlist.m3u8", // HLS playlists
    ];

    return videoPatterns.some((pattern) => url.toLowerCase().includes(pattern));
  };

  /**
   * Process a performance entry (resource loaded).
   */
  const processResource = (entry) => {
    // Skip if already processed or no size data
    if (state.processedResources.has(entry.name)) {
      return;
    }

    state.processedResources.add(entry.name);

    const size = entry.transferSize || entry.encodedBodySize || 0;
    if (size === 0) return; // Skip cached resources with no transfer

    const type = entry.initiatorType || "other";
    const url = entry.name || "";

    // Add to total
    state.totalBytes += size;

    // Check if this is video streaming content (even if marked as fetch/xhr)
    if (type === "video" || isVideoStreamingUrl(url)) {
      state.videoBytes += size;
      state.resourceCounts.video++;
      return;
    }

    // Categorize by type
    switch (type) {
      case "img":
      case "image":
        state.imageBytes += size;
        state.resourceCounts.image++;
        break;

      case "script":
        state.scriptBytes += size;
        state.resourceCounts.script++;
        break;

      case "css":
      case "link":
        state.stylesheetBytes += size;
        state.resourceCounts.stylesheet++;
        break;

      case "navigation":
      case "xmlhttprequest":
      case "fetch":
        state.documentBytes += size;
        state.resourceCounts.document++;
        break;

      default:
        state.otherBytes += size;
        state.resourceCounts.other++;
    }
  };

  /**
   * Scan resources that were loaded before tracker initialized.
   */
  const scanExistingResources = () => {
    try {
      const resources = performance.getEntriesByType("resource");
      const navigation = performance.getEntriesByType("navigation")[0];

      // Process navigation (main page load)
      if (navigation) {
        processResource(navigation);
      }

      // Process all resources
      resources.forEach(processResource);

      if (state.totalBytes > 0) {
        const totalMB = (state.totalBytes / 1024 / 1024).toFixed(2);
        console.log("CurbYourCarbon: Initial scan -", totalMB, "MB loaded");
      }
    } catch (error) {
      console.warn("CurbYourCarbon: Performance API not available", error);
    }
  };

  /**
   * Observe new resources as they load (lazy-loading, AJAX, etc.).
   */
  const observeNewResources = () => {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(processResource);
      });

      observer.observe({ entryTypes: ["resource", "navigation"] });
      console.log("CurbYourCarbon: Observing new resources");
    } catch (error) {
      console.warn("CurbYourCarbon: PerformanceObserver not available", error);
    }
  };

  /**
   * Send summary to background service worker.
   */
  const sendSummary = async (reason = "navigation") => {
    const timeActive = state.activeTime.getActiveMinutes();
    const totalMB = state.totalBytes / 1024 / 1024;

    // Only send if there's meaningful activity
    if (timeActive < 0.05 && totalMB < 0.1) {
      console.log("CurbYourCarbon: No significant activity to report");
      return;
    }

    const domain = getDomain();
    const category = categorizeWebsite(domain);

    console.log("CurbYourCarbon: Sending summary -", {
      reason,
      domain,
      category,
      timeActive: timeActive.toFixed(2) + " min",
      totalMB: totalMB.toFixed(2) + " MB",
      breakdown: {
        images: (state.imageBytes / 1024 / 1024).toFixed(2) + " MB",
        videos: (state.videoBytes / 1024 / 1024).toFixed(2) + " MB",
        scripts: (state.scriptBytes / 1024 / 1024).toFixed(2) + " MB",
      },
    });

    const result = await sendEventToBackground({
      type: category,
      platform: domain,

      // Time tracking
      timeActive: +timeActive.toFixed(2),

      // Data transfer (in MB for easier handling)
      totalMB: +totalMB.toFixed(3),
      imageMB: +(state.imageBytes / 1024 / 1024).toFixed(3),
      videoMB: +(state.videoBytes / 1024 / 1024).toFixed(3),
      scriptMB: +(state.scriptBytes / 1024 / 1024).toFixed(3),
      stylesheetMB: +(state.stylesheetBytes / 1024 / 1024).toFixed(3),
      documentMB: +(state.documentBytes / 1024 / 1024).toFixed(3),
      otherMB: +(state.otherBytes / 1024 / 1024).toFixed(3),

      // Resource counts
      resourceCounts: { ...state.resourceCounts },

      // Metadata
      url: window.location.href,
      timestamp: Date.now(),
    });

    if (result.ok) {
      console.log("CurbYourCarbon: Event saved -", result.carbonGrams, "g CO2");
      console.log("CurbYourCarbon: Session summary:", {
        timeActive: timeActive.toFixed(2) + " min",
        totalMB: totalMB.toFixed(2) + " MB",
        carbonGrams: result.carbonGrams + "g",
      });

      // Reset state after successful send
      state.activeTime.reset();
      state.totalBytes = 0;
      state.imageBytes = 0;
      state.videoBytes = 0;
      state.scriptBytes = 0;
      state.stylesheetBytes = 0;
      state.documentBytes = 0;
      state.otherBytes = 0;
      state.resourceCounts = {
        image: 0,
        video: 0,
        script: 0,
        stylesheet: 0,
        document: 0,
        other: 0,
      };
      state.processedResources.clear();
      state.lastSendTime = Date.now();
    } else if (!result.shouldRetry) {
      console.error("CurbYourCarbon: Failed to save event:", result.error);
    }
  };

  // Periodic summary (every 15 seconds for responsive updates)
  const PERIODIC_INTERVAL = 15 * 1000; // 15 seconds
  const periodicSummary = setInterval(() => {
    const timeActive = state.activeTime.getActiveMinutes();
    const timeSinceLastSend = (Date.now() - state.lastSendTime) / 60000;

    // Send if we have 10+ seconds of activity OR 15 seconds have passed
    if (timeActive >= 0.17 || timeSinceLastSend >= 0.23) {
      sendSummary("periodic");
    }
  }, PERIODIC_INTERVAL);

  // Send summary on page exit
  window.addEventListener("pagehide", () => {
    clearInterval(periodicSummary);
    sendSummary("pagehide");
  });

  window.addEventListener("beforeunload", () => {
    clearInterval(periodicSummary);
    sendSummary("beforeunload");
  });

  // Auto-detect device on first run
  const detectAndStoreDevice = async () => {
    try {
      const result = await chrome.storage.sync.get([
        "deviceType",
        "deviceDetected",
      ]);

      // Only auto-detect if user hasn't manually selected or if they chose auto
      if (!result.deviceDetected || result.deviceType === "auto") {
        const ua = navigator.userAgent;
        const width = window.screen.width;
        const height = window.screen.height;
        const screenArea = width * height;
        const hasTouch = "ontouchstart" in window;

        let detected = "laptop"; // Safe default

        if (screenArea > 8000000) {
          detected = "tv";
        } else if (/iPhone|iPod/i.test(ua)) {
          detected = "phone";
        } else if (/iPad/i.test(ua)) {
          detected = "tablet";
        } else if (/Android/i.test(ua)) {
          detected = /Mobile/i.test(ua) ? "phone" : "tablet";
        } else if (hasTouch && width < 768) {
          detected = "phone";
        } else if (hasTouch && width >= 768 && width < 1366) {
          detected = "tablet";
        }
        // Note: Cannot reliably distinguish laptop/desktop, so default to laptop

        await chrome.storage.sync.set({
          detectedDevice: detected,
          deviceDetected: true,
        });

        console.log("CurbYourCarbon: Auto-detected device:", detected);
      }
    } catch (error) {
      console.warn("CurbYourCarbon: Could not auto-detect device", error);
    }
  };

  // Initialize
  detectAndStoreDevice();
  scanExistingResources();
  observeNewResources();

  const category = categorizeWebsite(getDomain());
  console.log("CurbYourCarbon: Universal tracker ready -", category, "site");
})();
