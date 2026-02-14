import {
  debounce,
  getActiveTime,
  sendEventToBackground,
} from "./tracker-base.js";

if (!location.hostname.includes("reddit.com")) {
  // Not a Reddit page.
}

const activeTime = getActiveTime();
let postsLoaded = 0;
let mediaCount = 0;

const scanContent = () => {
  const posts = document.querySelectorAll("div[data-testid='post-container']");
  const media = document.querySelectorAll("img, video");

  postsLoaded = Math.max(postsLoaded, posts.length);
  mediaCount = Math.max(mediaCount, media.length);
};

const debouncedScan = debounce(scanContent, 400);

window.addEventListener("scroll", debouncedScan, { passive: true });
window.addEventListener("resize", debouncedScan);

const sendSummary = async () => {
  const timeActive = activeTime.getActiveMinutes();
  if (timeActive <= 0) return;

  await sendEventToBackground({
    type: "social",
    platform: "reddit",
    timeActive: +timeActive.toFixed(2),
    postsLoaded,
    mediaCount,
    timestamp: Date.now(),
  });

  activeTime.reset();
  // TODO: Reset counters on navigation within Reddit SPA.
};

window.addEventListener("pagehide", sendSummary);
window.addEventListener("beforeunload", sendSummary);

scanContent();

// TODO: Hook into Reddit SPA navigation to send periodic summaries.
