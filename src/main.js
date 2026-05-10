// Grab elements from DOM
const themeToggle = document.getElementById('theme-toggle');
const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status-text');

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');

    if (document.body.classList.contains('light-mode')) {
        themeToggle.innerText = "☀️";
    }
    else {
        themeToggle.innerText = "🌙";
    }
});

startBtn.addEventListener('click', () => {
    statusText.innerText = "Initializing Engine...";
    statusText.style.color = "var(--accent)";
    console.log("Start button clicked!");
});