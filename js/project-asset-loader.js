(function () {
    "use strict";

    const overlaySelector = "#loading-overlay";
    const maximumWait = 120000;

    function waitForImage(image) {
        image.loading = "eager";

        const loaded = new Promise(resolve => {
            if (image.complete) {
                resolve();
                return;
            }
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
        });

        return loaded.then(() => {
            if (!image.decode || !image.naturalWidth) return;
            return image.decode().catch(() => {});
        });
    }

    function waitForVideo(video) {
        video.preload = "auto";

        const ready = new Promise(resolve => {
            const fallback = setTimeout(resolve, 10000);
            const finish = () => {
                clearTimeout(fallback);
                resolve();
            };
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                finish();
                return;
            }
            video.addEventListener("loadeddata", finish, { once: true });
            video.addEventListener("error", finish, { once: true });
            video.addEventListener("stalled", () => {
                if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) finish();
            }, { once: true });
        });

        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) video.load();
        return ready;
    }

    function collectAssets() {
        const overlay = document.querySelector(overlaySelector);
        // Below-the-fold case content opts out with [data-defer-assets] and loads lazily.
        const counted = element => !overlay?.contains(element) && !element.closest("[data-defer-assets]");
        const images = [...document.images].filter(counted);
        const videos = [...document.querySelectorAll("video")].filter(counted);
        return [...images.map(waitForImage), ...videos.map(waitForVideo)];
    }

    const assetsReady = Promise.allSettled(collectAssets());
    const timeout = new Promise(resolve => setTimeout(resolve, maximumWait));

    window.projectAssetsReady = Promise.race([assetsReady, timeout]);
})();
