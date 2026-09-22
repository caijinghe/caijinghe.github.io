// password.js — client-side content encryption gate
//
// The protected markup is NOT present in the page. It is stored as an
// AES-256-GCM ciphertext (see the <script id="...-payload"> block). The
// correct password derives the decryption key via PBKDF2; only then is the
// real markup decrypted in the browser and injected into the DOM.
//
// Because the content never exists in the HTML until the password is
// entered, it cannot be revealed by deleting the overlay, reading the source,
// or forging a sessionStorage flag. A wrong password fails GCM authentication
// and decrypts to nothing.

(function () {
    "use strict";

    // Must match the parameters used by tools/lock.html when encrypting.
    var PBKDF2_ITERATIONS = 200000;

    function bytesToBase64(bytes) {
        var binary = "";
        var chunk = 0x8000;
        for (var i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    function base64ToBytes(base64) {
        var binary = atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    function deriveKey(password, saltBytes) {
        return crypto.subtle
            .importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"])
            .then(function (baseKey) {
                return crypto.subtle.deriveKey(
                    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
                    baseKey,
                    { name: "AES-GCM", length: 256 },
                    true,
                    ["decrypt"]
                );
            });
    }

    function decryptWithKey(key, payload) {
        var iv = base64ToBytes(payload.iv);
        var ct = base64ToBytes(payload.ct);
        return crypto.subtle
            .decrypt({ name: "AES-GCM", iv: iv }, key, ct)
            .then(function (plainBuf) {
                return new TextDecoder().decode(plainBuf);
            });
    }

    function prepareDocument(html) {
        // document.write can paint the restored body before its external CSS
        // arrives. Install this guard before any of the page's styles/scripts.
        function waitForStyles() {
            var guard = document.getElementById("unlock-style-guard");
            var settled = new WeakSet();
            var pending = new Set();
            var parsed = false;
            var revealed = false;
            var fallback;

            function reveal() {
                if (revealed) return;
                revealed = true;
                clearTimeout(fallback);
                document.removeEventListener("load", onSettled, true);
                document.removeEventListener("error", onSettled, true);
                document.removeEventListener("DOMContentLoaded", onParsed);
                if (guard) guard.remove();
            }

            function onSettled(event) {
                if (event.target.tagName !== "LINK") return;
                settled.add(event.target);
                pending.delete(event.target);
                if (parsed && pending.size === 0) reveal();
            }

            function onParsed() {
                document.querySelectorAll('link[rel~="stylesheet"]').forEach(function (link) {
                    if (!link.disabled && !link.sheet && !settled.has(link)) pending.add(link);
                });
                parsed = true;
                if (pending.size === 0) reveal();
            }

            document.addEventListener("load", onSettled, true);
            document.addEventListener("error", onSettled, true);
            document.addEventListener("DOMContentLoaded", onParsed, { once: true });
            // A failed third-party request must never leave the site hidden.
            // Do not wait for window.load: large images/videos are unrelated.
            fallback = setTimeout(reveal, 10000);
        }

        var guard = '<style id="unlock-style-guard">body{visibility:hidden!important}</style>' +
            '<script>(' + waitForStyles.toString() + ')();<\/script>';
        return html.replace(/<head\b[^>]*>/i, function (head) { return head + guard; });
    }

    function protectPage(options) {
        options = options || {};
        var storageKey = options.storageKey || "protected-page-unlocked";
        var mountSelector = options.mount || "#protected-content";
        var payloadSelector = options.payload || "#protected-payload";

        var mountEl = document.querySelector(mountSelector);
        var payloadEl = document.querySelector(payloadSelector);
        var payload = null;
        try {
            payload = JSON.parse(((payloadEl && payloadEl.textContent) || "").trim());
        } catch (error) {
            payload = null;
        }

        var cryptoReady = !!(window.crypto && window.crypto.subtle);

        var isDark = document.body.classList.contains("dark-theme") ||
                     document.documentElement.classList.contains("dark-theme") ||
                     (new URLSearchParams(location.search).get("theme") === "dark");
        var logoSrc = isDark ? "media/logo_withe.svg" : "media/logo.svg";

        // Overlay UI — identical markup/styles to the previous version with optional dark-theme.
        var overlayHTML =
            '<div id="password-overlay"' + (isDark ? ' class="dark-theme"' : '') + '>' +
            '    <div class="password-box">' +
            '        <img src="' + logoSrc + '" alt="Logo" class="logo" />' +
            '        <div class="input-container">' +
            '            <input type="password" id="password-input" placeholder="•••" />' +
            '            <button id="password-submit">' +
            '                <img src="media/go.svg" alt="Go" />' +
            '            </button>' +
            '        </div>' +
            '        <p id="password-error" class="error-message">Incorrect password. Please try again.</p>' +
            '    </div>' +
            '    <div id="custom-cursor"></div>' +
            "</div>";
        document.body.insertAdjacentHTML("afterbegin", overlayHTML);

        var passwordOverlay = document.getElementById("password-overlay");
        var passwordBox = passwordOverlay.querySelector(".password-box");
        var passwordInput = document.getElementById("password-input");
        var passwordSubmit = document.getElementById("password-submit");
        var errorMessage = document.getElementById("password-error");
        var inputContainer = passwordOverlay.querySelector(".input-container");

        function revealContent(html) {
            if (options.document) {
                // Restore the complete document so its scripts and load events
                // run normally, only after authenticated decryption succeeds.
                document.open();
                document.write(prepareDocument(html));
                document.close();
                return;
            }
            if (mountEl) {
                mountEl.innerHTML = html;
            }
            // Let page scripts (carousels, etc.) initialise now that the
            // real content exists in the DOM.
            document.dispatchEvent(new CustomEvent("protected:unlocked"));

            passwordOverlay.classList.add("hidden");
            document.body.style.overflow = "auto";
            errorMessage.style.visibility = "hidden";

            var cursor = document.getElementById("custom-cursor");
            if (cursor) {
                document.body.appendChild(cursor);
            }
        }

        function showError() {
            errorMessage.style.visibility = "visible";
            passwordInput.value = "";
            inputContainer.classList.add("shake-animation");
            inputContainer.addEventListener(
                "animationend",
                function () {
                    inputContainer.classList.remove("shake-animation");
                },
                { once: true }
            );
        }

        function storeKey(rawKeyBytes) {
            try {
                window.sessionStorage.setItem(storageKey, bytesToBase64(rawKeyBytes));
            } catch (error) {
                // Ignore storage errors and continue.
            }
        }

        function readStoredKey() {
            try {
                return window.sessionStorage.getItem(storageKey);
            } catch (error) {
                return null;
            }
        }

        function clearStoredKey() {
            try {
                window.sessionStorage.removeItem(storageKey);
            } catch (error) {
                // Ignore storage errors and continue.
            }
        }

        function attemptWithPassword(password) {
            var salt = base64ToBytes(payload.salt);
            return deriveKey(password, salt).then(function (key) {
                return decryptWithKey(key, payload).then(function (html) {
                    // Only reached when GCM authentication succeeds, i.e. the
                    // password was correct. Remember the derived key (not the
                    // password) so reloads within this session stay unlocked.
                    return crypto.subtle.exportKey("raw", key).then(function (raw) {
                        storeKey(new Uint8Array(raw));
                        revealContent(html);
                    });
                });
            });
        }

        function attemptWithStoredKey(base64Key) {
            var raw = base64ToBytes(base64Key);
            return crypto.subtle
                .importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, ["decrypt"])
                .then(function (key) {
                    return decryptWithKey(key, payload).then(revealContent);
                });
        }

        function checkPassword() {
            var entered = passwordInput.value;
            if (!entered) {
                showError();
                return;
            }
            if (!payload || !cryptoReady) {
                showError();
                return;
            }
            attemptWithPassword(entered).catch(function () {
                showError();
            });
        }

        passwordSubmit.addEventListener("click", function () {
            checkPassword();
        });

        passwordInput.addEventListener("keypress", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                checkPassword();
            }
        });

        var logoEl = passwordBox.querySelector(".logo");
        if (logoEl) {
            logoEl.style.cursor = "pointer";
            logoEl.addEventListener("click", function () {
                if (window.parent !== window) {
                    window.parent.postMessage({ type: "project-preview-close" }, location.origin);
                } else {
                    window.location.href = "index.html";
                }
            });
        }

        if (window.parent !== window) {
            window.addEventListener("keydown", function (e) {
                if (e.key === "Escape") {
                    window.parent.postMessage({ type: "project-preview-close" }, location.origin);
                }
            });
        }

        // Silent unlock if this session already holds a valid derived key.
        // Run it on/after DOMContentLoaded so deferred page modules (which
        // listen for "protected:unlocked" to init carousels) are guaranteed to
        // have registered their listeners before we dispatch the event.
        function startSilentUnlock() {
            var stored = readStoredKey();
            if (stored && payload && cryptoReady) {
                attemptWithStoredKey(stored).catch(function () {
                    clearStoredKey();
                });
            }
        }
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", startSilentUnlock, { once: true });
        } else {
            startSilentUnlock();
        }
    }

    window.protectPage = protectPage;

    // Backwards-compatible shim: the old signature was
    // protectPageWithPassword(hash, { storageKey }). The hash is ignored now.
    window.protectPageWithPassword = function (_legacyHashArg, options) {
        return protectPage(options || {});
    };
})();
