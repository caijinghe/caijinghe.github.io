// password.js

/**
 * Adds a password protection overlay to the page.
 * @param {string} password - The correct password to unlock the page.
 */
function protectPageWithPassword(password) {
    const overlayHTML = `
        <div id="password-overlay">
            <div class="password-box">
                <img src="media/logo.svg" alt="Logo" class="logo" />
                <div class="input-container">
                    <input type="password" id="password-input" placeholder="•••" />
                    <button id="password-submit">
                        <img src="media/go.svg" alt="Go" />
                    </button>
                </div>
                <p id="password-error" class="error-message">Incorrect password. Please try again.</p>
            </div>
            <div id="custom-cursor"></div>
        </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', overlayHTML);

    const passwordOverlay = document.getElementById("password-overlay");
    const passwordBox = passwordOverlay.querySelector('.password-box');
    const passwordInput = document.getElementById("password-input");
    const passwordSubmit = document.getElementById("password-submit");
    const errorMessage = document.getElementById("password-error");
    const inputContainer = passwordOverlay.querySelector('.input-container');

    passwordSubmit.addEventListener("click", checkPassword);
    passwordInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            checkPassword();
        }
    });

    function checkPassword() {
        if (passwordInput.value === password) {
            passwordOverlay.classList.add("hidden");
            document.body.style.overflow = "auto";
            errorMessage.style.visibility = "hidden";
            
            const cursor = document.getElementById('custom-cursor');
            if (cursor) {
                document.body.appendChild(cursor);
            }
        } else {
            errorMessage.style.visibility = "visible";
            passwordInput.value = "";
            
            // 触发抖动动画
            inputContainer.classList.add('shake-animation');
            
            // 动画结束后移除类，以便下次可以再次触发
            inputContainer.addEventListener('animationend', () => {
                inputContainer.classList.remove('shake-animation');
            }, { once: true });
        }
    }

    const logoEl = passwordBox.querySelector('.logo');
    if (logoEl) {
        logoEl.style.cursor = 'none';
        logoEl.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
}