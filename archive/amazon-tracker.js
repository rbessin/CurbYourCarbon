// Amazon shopping tracking content script with enhanced tracking
(function() {
  'use strict';

  console.log("CurbYourCarbon: Amazon tracker initialized");

  if (!location.hostname.includes("amazon.com")) {
    console.log("CurbYourCarbon: Not an Amazon page");
    return;
  }

  // Wait for tracker base to be available
  if (!window.CurbYourCarbon) {
    console.error("CurbYourCarbon: tracker-base.js not loaded properly");
    return;
  }

  const { getActiveTime, sendEventToBackground, debounce } = window.CurbYourCarbon;

  // State management
  const state = {
    activeTime: getActiveTime(),
    productsViewed: new Set(),
    productCardsLoaded: new Set(),
    imagesLoaded: new Set(),
    highResImages: new Set(),
    videosLoaded: new Set(),
    searchesPerformed: 0,
    lastSearchTerm: "",
    lastUrl: location.href
  };

  // Helper: Extract product ID from URL
  const getProductIdFromUrl = (url) => {
    const match = url.match(/\/dp\/([A-Z0-9]{6,})/i) || url.match(/\/gp\/product\/([A-Z0-9]{6,})/i);
    return match ? match[1] : null;
  };

  // Helper: Check if image is high resolution
  const isHighResImage = (img) => {
    if (!img.naturalWidth || !img.naturalHeight) return false;
    const pixels = img.naturalWidth * img.naturalHeight;
    return pixels > 500000; // ~700x700 or higher
  };

  // Track product detail page views
  const checkProductPage = () => {
    const productId = getProductIdFromUrl(location.pathname);
    if (productId && !state.productsViewed.has(productId)) {
      state.productsViewed.add(productId);
      console.log("CurbYourCarbon: Amazon product viewed:", productId);
    }
  };

  // Track search queries
  const checkSearch = () => {
    const params = new URLSearchParams(location.search);
    const term = params.get("k") || "";
    if (term && term !== state.lastSearchTerm) {
      state.lastSearchTerm = term;
      state.searchesPerformed += 1;
      console.log("CurbYourCarbon: Amazon search performed:", term);
    }
  };

  // Track product cards (search results, recommendations, etc.)
  const scanProductCards = () => {
    // Search result cards
    const searchResults = document.querySelectorAll('[data-component-type="s-search-result"]');
    searchResults.forEach(card => {
      const asin = card.getAttribute('data-asin');
      if (asin && !state.productCardsLoaded.has(asin)) {
        state.productCardsLoaded.add(asin);
      }
    });

    // Product cards with ASIN attribute (recommendations, etc.)
    const productCards = document.querySelectorAll('[data-asin]:not([data-asin=""])');
    productCards.forEach(card => {
      const asin = card.getAttribute('data-asin');
      if (asin && asin.length >= 10 && !state.productCardsLoaded.has(asin)) {
        state.productCardsLoaded.add(asin);
      }
    });

    // Recommendation carousels
    const carouselItems = document.querySelectorAll('[data-csa-c-item-id]');
    carouselItems.forEach(item => {
      const itemId = item.getAttribute('data-csa-c-item-id');
      if (itemId && !state.productCardsLoaded.has(itemId)) {
        state.productCardsLoaded.add(itemId);
      }
    });

    if (state.productCardsLoaded.size > 0) {
      console.log("CurbYourCarbon: Amazon product cards loaded:", state.productCardsLoaded.size);
    }
  };

  // Track images loaded (with quality detection)
  const scanImages = () => {
    const images = document.querySelectorAll('img[src]');
    images.forEach(img => {
      const src = img.src;
      if (!src || state.imagesLoaded.has(src)) return;

      // Filter for product images (Amazon uses specific patterns)
      if (src.includes('images-amazon.com') || src.includes('ssl-images-amazon.com')) {
        state.imagesLoaded.add(src);
        
        // Check if high resolution
        if (img.complete && isHighResImage(img)) {
          state.highResImages.add(src);
        } else if (!img.complete) {
          // Wait for image to load to check resolution
          img.addEventListener('load', () => {
            if (isHighResImage(img)) {
              state.highResImages.add(src);
            }
          }, { once: true });
        }
      }
    });
  };

  // Track product videos
  const scanVideos = () => {
    // Video elements
    const videos = document.querySelectorAll('video[src], video source[src]');
    videos.forEach(video => {
      const src = video.src || video.querySelector('source')?.src;
      if (src && !state.videosLoaded.has(src)) {
        state.videosLoaded.add(src);
        console.log("CurbYourCarbon: Amazon product video loaded");
      }
    });

    // Video thumbnails/preview containers
    const videoContainers = document.querySelectorAll('[data-video-url], [data-a-video-url]');
    videoContainers.forEach(container => {
      const videoUrl = container.getAttribute('data-video-url') || container.getAttribute('data-a-video-url');
      if (videoUrl && !state.videosLoaded.has(videoUrl)) {
        state.videosLoaded.add(videoUrl);
      }
    });
  };

  // Comprehensive content scan
  const scanContent = () => {
    checkProductPage();
    checkSearch();
    scanProductCards();
    scanImages();
    scanVideos();
  };

  // Debounced scan for performance
  const debouncedScan = debounce(scanContent, 400);

  // Send summary to background
  const sendSummary = async (reason = "navigation") => {
    const timeActive = state.activeTime.getActiveMinutes();
    if (timeActive <= 0 && state.productsViewed.size === 0 && state.productCardsLoaded.size === 0) {
      console.log("CurbYourCarbon: Amazon - no activity to report");
      return;
    }

    console.log("CurbYourCarbon: Sending Amazon summary -", {
      reason,
      timeActive: timeActive.toFixed(2),
      productsViewed: state.productsViewed.size,
      productCards: state.productCardsLoaded.size,
      images: state.imagesLoaded.size,
      highResImages: state.highResImages.size,
      videos: state.videosLoaded.size
    });

    const result = await sendEventToBackground({
      type: "shopping",
      platform: "amazon",
      timeActive: +timeActive.toFixed(2),
      productsViewed: state.productsViewed.size,
      productCardsLoaded: state.productCardsLoaded.size,
      imagesLoaded: state.imagesLoaded.size,
      highResImages: state.highResImages.size,
      videosLoaded: state.videosLoaded.size,
      searches: state.searchesPerformed,
      timestamp: Date.now()
    });

    if (result.ok) {
      console.log("CurbYourCarbon: Amazon event saved successfully, carbon:", result.carbonGrams, "g");
      // Reset state after successful send
      state.activeTime.reset();
      state.productsViewed.clear();
      state.productCardsLoaded.clear();
      state.imagesLoaded.clear();
      state.highResImages.clear();
      state.videosLoaded.clear();
      state.searchesPerformed = 0;
    } else if (!result.shouldRetry) {
      // Only log real errors, not service worker being inactive
      console.error("CurbYourCarbon: Failed to save Amazon event:", result.error);
    }
    // If shouldRetry is true, we keep accumulating data and will send on next navigation
  };

  // Handle URL changes (SPA navigation)
  const handleUrlChange = () => {
    const currentUrl = location.href;
    if (currentUrl !== state.lastUrl) {
      console.log("CurbYourCarbon: Amazon URL changed");
      state.lastUrl = currentUrl;
      // Scan for new content after navigation
      setTimeout(scanContent, 1000);
    }
  };

  // Periodic summary (every 30 seconds for testing/demo)
  const PERIODIC_INTERVAL = 30 * 1000; // 30 seconds
  const periodicSummary = setInterval(() => {
    const timeActive = state.activeTime.getActiveMinutes();
    if (timeActive >= 0.45) { // Only send if we have ~30 seconds of activity
      console.log("CurbYourCarbon: Sending periodic Amazon summary");
      sendSummary("periodic");
    }
  }, PERIODIC_INTERVAL);

  // Event listeners
  window.addEventListener("popstate", handleUrlChange);
  window.addEventListener("scroll", debouncedScan, { passive: true });
  window.addEventListener("click", debouncedScan);
  
  // Use MutationObserver for dynamic content (lazy loading)
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

  console.log("CurbYourCarbon: Amazon tracker ready with enhanced features");
})();
