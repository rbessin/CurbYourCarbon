import { sendEventToBackground } from "./tracker-base.js";

if (!location.hostname.includes("youtube.com")) {
  // Not a YouTube page.
}

const state = {
  playStart: null,
  resolution: "1080p"
};

const getResolutionLabel = (height) => {
  if (height >= 2160) return "2160p";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  return "360p";
};

const attachToVideo = (video) => {
  if (!video) return;

  const updateResolution = () => {
    const nextResolution = getResolutionLabel(video.videoHeight || 1080);
    if (state.resolution !== nextResolution) {
      state.resolution = nextResolution;
    }
  };

  const handlePlay = () => {
    updateResolution();
    state.playStart = Date.now();
  };

  const handlePause = async () => {
    if (!state.playStart) return;
    const durationMinutes = (Date.now() - state.playStart) / 60000;
    state.playStart = null;

    if (durationMinutes > 0.05) {
      await sendEventToBackground({
        type: "video",
        platform: "youtube",
        duration: +durationMinutes.toFixed(2),
        resolution: state.resolution,
        timestamp: Date.now()
      });
    }
  };

  video.addEventListener("play", handlePlay);
  video.addEventListener("pause", handlePause);
  video.addEventListener("ended", handlePause);
  video.addEventListener("loadedmetadata", updateResolution);

  // TODO: Handle YouTube player swaps in SPA navigation.
  // TODO: Track ad playback separately if desired.
};

const init = () => {
  const video = document.querySelector("video");
  if (video) {
    attachToVideo(video);
    return;
  }

  // TODO: Observe DOM changes to find video element on navigation.
  const observer = new MutationObserver(() => {
    const player = document.querySelector("video");
    if (player) {
      observer.disconnect();
      attachToVideo(player);
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
};

init();
