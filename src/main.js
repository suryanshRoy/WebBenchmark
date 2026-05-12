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

// for UI pop
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const cores = navigator.hardwareConcurrency || 'Unknown';
        document.getElementById('core-count').innerText = `${cores} Threads Available`;
    }, 800);
});


// --WEBASSEMBLY ENGINE--

const gflopsDisplay = document.getElementById('gflops-current');
let wasmModule = null;
let isEngineRunning = false;

const MATRIX_SIZE = 512; // For Medium test
// (N^3) Operations per matrix multiplication
const FLOP_PER_ITERATION = 2* Math.pow(MATRIX_SIZE, 3); 

// Initialize WBSMBLY
// Initialize WBSMBLY
if (typeof createEngine !== 'undefined') {
    createEngine().then((Module) => {
        wasmModule = Module;
        wasmModule._init_memory(MATRIX_SIZE);
        console.log("WebAssembly Engine Loaded & Memory feeded");
        statusText.innerText = 'Ready';
    });
} else {
    console.error("engine.js not found. Make sure you ran the emcc compile command.");
}

// --BENCHMARK LOOP

function runBenchmarkLoop() {
    if (!isEngineRunning) return; // Stop the loop if user clicked Stop

    const iterations = 10;

    const startTime = performance.now();

    wasmModule._run_stress_test(iterations);

    const endTime = performance.now();
    const timeTakenSeconds = (endTime - startTime) / 1000;
    const totalFlops = FLOP_PER_ITERATION * iterations;
    const gflops = (totalFlops / timeTakenSeconds) /1e9;

    gflopsDisplay.innerText = `${gflops.toFixed(2)} GFLOPS`; 

    setTimeout(runBenchmarkLoop, 0);
}

// --Engine Controls--
startBtn.addEventListener('click', () => {
    if (!wasmModule) {
        warningMsg.innerText = "Error: Engine not compiled yet!";
        warningMsg.classList.add('show-warning');
        setTimeout(() => warningMsg.classList.remove('show-warning'), 3000);
        return;
    }

    statusText.innerText = "Running Stress Test...";
    statusText.classList.remove('idle');
    statusText.classList.add('running');

    stopBtn.classList.remove('is-disabled');
    warningMsg.classList.remove('show-warning');

    isEngineRunning = true; 
    runBenchmarkLoop();
});

stopBtn.addEventListener('click', () => {
    if (stopBtn.classList.contains('is-disabled')) {
        warningMsg.innerText = "Please start the stress test first!";
        
        stopBtn.classList.add('vibrate-active');
        // YOU MISSED THESE THREE LINES BELOW:
        setTimeout(() => stopBtn.classList.remove('vibrate-active'), 300);
        warningMsg.classList.add('show-warning');
        setTimeout(() => warningMsg.classList.remove('show-warning'), 2500);
    }
    else {
        isEngineRunning = false;

        stopBtn.classList.add('is-disabled');
        statusText.innerText = 'Ready';
        statusText.classList.remove('running');
        statusText.classList.add('idle');
    }
});