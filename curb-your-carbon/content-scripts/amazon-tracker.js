import { debounce, getActiveTime, sendEventToBackground } from "./tracker-base.js";

if (!location.hostname.includes("amazon.com")) {
  // Not an Amazon page.
}

const activeTime = getActiveTime();
const productsViewed = new Set();
let searchesPerformed = 0;
let lastSearchTerm = "";

const getProductIdFromUrl = (url) => {
  const match = url.match(/\/dp\/([A-Z0-9]{6,})/i) || url.match(/\/gp\/product\/([A-Z0-9]{6,})/i);
  return match ? match[1] : null;
};

const checkProductPage = () => {
  const productId = getProductIdFromUrl(location.pathname);
  if (productId) {
    productsViewed.add(productId);
  }
};

const checkSearch = () => {
  const params = new URLSearchParams(location.search);
  const term = params.get("k") || "";
  if (term && term !== lastSearchTerm) {
    lastSearchTerm = term;
    searchesPerformed += 1;
  }
};

const debouncedCheck = debounce(() => {
  checkProductPage();
  checkSearch();
}, 300);

window.addEventListener("popstate", debouncedCheck);
window.addEventListener("click", debouncedCheck);
window.addEventListener("scroll", debouncedCheck, { passive: true });

const sendSummary = async () => {
  const timeActive = activeTime.getActiveMinutes();
  if (timeActive <= 0) return;

  await sendEventToBackground({
    type: "shopping",
    platform: "amazon",
    timeActive: +timeActive.toFixed(2),
    productsViewed: productsViewed.size,
    searches: searchesPerformed,
    timestamp: Date.now()
  });

  activeTime.reset();
  // TODO: Persist product views across SPA navigation.
};

window.addEventListener("pagehide", sendSummary);
window.addEventListener("beforeunload", sendSummary);

checkProductPage();
checkSearch();

// TODO: Watch for dynamic product grid updates for richer metrics.
