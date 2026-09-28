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
        const images = [...document.images].filter(image => !overlay?.contains(image));
        const videos = [...document.querySelectorAll("video")].filter(video => !overlay?.contains(video));
        return [...images.map(waitForImage), ...videos.map(waitForVideo)];
    }

    const assetsReady = Promise.allSettled(collectAssets());
    const timeout = new Promise(resolve => setTimeout(resolve, maximumWait));

    window.projectAssetsReady = Promise.race([assetsReady, timeout]);
})();
