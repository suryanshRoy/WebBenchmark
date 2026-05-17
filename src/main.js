// Grab elements from DOM
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusText = document.getElementById('status-text');
const warningMsg = document.getElementById('warning-msg');

// Sidebar Elements
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// UI elements
const settingsOpenBtn = document.getElementById('settings-open-btn');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsModal = document.getElementById('settings-modal');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Processor & GPU variables
const processorSelect = document.getElementById('processor-select');
const optGPU = document.getElementById('opt-GPU');
const gpuWarnMsg = document.getElementById('gpu-warning-msg');
const cpuWarnMsg = document.getElementById('cpu-warning-msg');

let currentProcessor = 'GPU';
let showGpuFallbackMsg = true;


function toggleSidebar() {
    sidebar.classList.toggle('closed');
    sidebarOverlay.classList.toggle('active');
}

menuBtn.addEventListener('click', toggleSidebar);

sidebarOverlay.addEventListener('click', () => {
    if(!sidebar.classList.contains('closed')) {
        toggleSidebar();
    }
});

settingsOpenBtn.addEventListener('click', () => {
    // close sidebar when opening settings on mobile
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

const MATRIX_SIZE = 512; // For Medium test
const FLOP_PER_ITERATION = 2* Math.pow(MATRIX_SIZE, 3); 

// --WASM Worker Setup--

const gflopsDisplay = document.getElementById('gflops-current');
let isEngineRunning = false;
let isEngineReady = false;

const benchmarkWorker = new Worker(new URL('./worker.js', import.meta.url));

benchmarkWorker.onmessage = function(event) {
    const data = event.data;

    if (data.type === 'READY') {
        console.log('WASM Worker Loaded & Ready');
        statusText.innerText = 'Ready';
        isEngineReady = true;
    }
    else if (data.type === 'UPDATE'){
        gflopsDisplay.innerText = `${data.gflops} GFLOPS`;
    }
};

benchmarkWorker.onerror = function(error) {
    console.error("Worker error: ", error);
}

// --Engine Controls--
startBtn.addEventListener('click', () => {
    if (!isEngineReady) {
        warningMsg.innerText = "Error: Engine not compiled yet!";
        warningMsg.classList.add('show-warning');
        setTimeout(() => warningMsg.classList.remove('show-warning'), 3000);
        return;
    }

    statusText.innerText = `Running ${currentProcessor} Stress Test...`;
    statusText.classList.remove('idle');
    statusText.classList.add('running');

    stopBtn.classList.remove('is-disabled');
    warningMsg.classList.remove('show-warning');

    isEngineRunning = true; 
    if (currentProcessor === 'CPU') {
        benchmarkWorker.postMessage({type: 'START', iterations: 20});
    }
    else {
        console.log("WebGPU Pipeline starting...");
        setTimeout(() => {
            if (isEngineRunning) {
                gflopsDisplay.innerText = "GPU INCOMING...";
            }
        }, 500);
    }
});

stopBtn.addEventListener('click', () => {
    if (stopBtn.classList.contains('is-disabled')) {
        warningMsg.innerText = "Please start the stress test first!";
        
        stopBtn.classList.add('vibrate-active');
        setTimeout(() => stopBtn.classList.remove('vibrate-active'), 300);
        warningMsg.classList.add('show-warning');
        setTimeout(() => warningMsg.classList.remove('show-warning'), 2500);
    }
    else {
        isEngineRunning = false;

        benchmarkWorker.postMessage({type: 'STOP'});

        stopBtn.classList.add('is-disabled');
        statusText.innerText = 'Ready';
        statusText.classList.remove('running');
        statusText.classList.add('idle');
    }
});

// Processor & GPU detection
async function detectUserGPU() {

    cpuWarnMsg.classList.add('hidden');

    try {
        if (navigator.gpu) {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
                const info = adapter.info;
                const apiName = info.architecture || info.vendor || 'WebGPU';

                optGPU.innerText = `GPU (${apiName})`;
                showGpuFallbackMsg = false;
                gpuWarnMsg.classList.add('hidden');
                return;
            }
        }
        
        
        const canvas = document.createElement('canvas');
        const glContext = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (glContext) {
            const debugInfo = glContext.getExtension('WEBGL_debug_renderer_info');
            const rendererName = debugInfo ? glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'WebGL';

            optGPU.innerText = `GPU (WebGL)`;
            gpuWarnMsg.innerText = `WebGL Active: ${rendererName}`;
            showGpuFallbackMsg = true;
            gpuWarnMsg.classList.remove('hidden');
            return;
        }

        optGPU.innerText = "GPU";
        gpuWarnMsg.innerText = "Graphics hardware unsupported";
        showGpuFallbackMsg = true;
        gpuWarnMsg.classList.remove('hidden');
    } catch (error) {
        console.error("GPU detection failed", error);
        optGPU.innerText = "GPU";
        gpuWarnMsg.innerText = "GPU detection failed.";
        showGpuFallbackMsg = true;
        gpuWarnMsg.classList.remove('hidden');
    }
}

detectUserGPU();

processorSelect.addEventListener('change', (event) => {
    if (isEngineRunning) {
        event.target.value = currentProcessor;
        return;
    }

    currentProcessor = event.target.value;
    
    if (currentProcessor === "CPU") {
        cpuWarnMsg.classList.remove('hidden');
        gpuWarnMsg.classList.add('hidden');
    }
    else {
        cpuWarnMsg.classList.add('hidden');
        if (showGpuFallbackMsg) {
            gpuWarnMsg.classList.remove('hidden');
        }
    }
});