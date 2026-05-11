// Grab elements from DOM
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusText = document.getElementById('status-text');
const warningMsg = document.getElementById('warning-msg');

// Sidebar Elements
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// Modal elements
const settingsOpenBtn = document.getElementById('settings-open-btn');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsModal = document.getElementById('settings-modal');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// --- SIDEBAR LOGIC (Mobile slide overlay) --- //
function toggleSidebar() {
    sidebar.classList.toggle('closed');
    sidebarOverlay.classList.toggle('active');
}

menuBtn.addEventListener('click', toggleSidebar);

// Clicking overlay on mobile closes sidebar
sidebarOverlay.addEventListener('click', () => {
    if(!sidebar.classList.contains('closed')) {
        toggleSidebar();
    }
});

// --- MODAL & SETTINGS LOGIC --- //
settingsOpenBtn.addEventListener('click', () => {
    // Close sidebar when opening settings on mobile
    if(window.innerWidth <= 850 && !sidebar.classList.contains('closed')) {
        toggleSidebar();
    }
    settingsModal.classList.remove('hidden');
});

settingsCloseBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.add('hidden');
    }
});

themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');

    if (document.body.classList.contains('light-mode')) {
        themeToggleBtn.innerText = "Switch to Dark Mode";
    } 
    else {
        themeToggleBtn.innerText = "Switch to Light Mode";
    }
});

startBtn.addEventListener('click', () => {
    statusText.innerText = "Initializing Engine...";
    statusText.classList.remove('idle');
    statusText.classList.add('running');
    
    stopBtn.classList.remove('is-disabled');
    warningMsg.classList.remove('show-warning'); 
    
    console.log("Start button clicked!");
});

stopBtn.addEventListener('click', () => {
    if (stopBtn.classList.contains('is-disabled')) {
        // Visual vibration and warning message
        stopBtn.classList.add('shake-active'); 
        setTimeout(() => stopBtn.classList.remove('shake-active'), 300);

        warningMsg.classList.add('show-warning');
        setTimeout (() => warningMsg.classList.remove('show-warning'), 2500);
    } 
    else {
        console.log("Benchmark execution stopped!");
        stopBtn.classList.add('is-disabled');
        
        statusText.innerText = 'Ready';
        statusText.classList.remove('running');
        statusText.classList.add('idle');
    }
});

// for UI pop
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const cores = navigator.hardwareConcurrency || 'Unknown';
        document.getElementById('core-count').innerText = `${cores} Threads Available`;
    }, 800);
});
