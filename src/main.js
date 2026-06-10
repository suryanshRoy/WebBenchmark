import {plotPerformanceCurve} from "./performanceCurve.js";
import {detectUserGPU, processorListner} from "./processorManager.js";
import {runCPU, runGPU, benchmarkWorker} from "./manage-run.js";

//  btn and warning elements
const startBtn = document.getElementById('start-btn');
export const stopBtn = document.getElementById('stop-btn');
export const statusText = document.getElementById('status-text');
export const warningMsg = document.getElementById('warning-msg');

// Sidebar Elements
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// UI elements to change appearance
const settingsOpenBtn = document.getElementById('settings-open-btn');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsModal = document.getElementById('settings-modal');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Processor & GPU variables
export const processorSelect = document.getElementById('processor-select');
const optGPU = document.getElementById('opt-GPU');
export const gpuWarnMsg = document.getElementById('gpu-warning-msg');
export const cpuWarnMsg = document.getElementById('cpu-warning-msg');

export const AppState = { // ai fixed issue 
    currentProcessor: 'GPU',
    showGpuFallbackMsg: true,
    activeGPUDevice: null,
    currentGraphData: [],
    isEngineRunning: false,
    isEngineReady: false
};

export function setCurrentProcessor(value) { // again ai fixed issue for ES6 or whatever it is
    AppState.currentProcessor = value;
}

function toggleSidebar() {
    sidebar.classList.toggle('closed');
    sidebarOverlay.classList.toggle('active');
}

export function updatePreciOption() { // NOTE precision options to be moved to UI-manager.js
    computeType.innerHTML = '';
    const isSIMD = simdCheckbox.checked;
    const isCPU = processorSelect.value === "CPU";

    if (isSIMD) {
        computeType.add(new Option('Float4 (32-bit)', 'f4-vec-f32'));

        if (isCPU) {
            computeType.add(new Option('Float2 (64-bit)', 'f2-vec-f64')); 
        } else {
            computeType.add(new Option('Float4 (16-bit)', 'f4-vec-f16')); 
        }
    }
    else {
        computeType.add(new Option('F32 Scalar', "f32-scalar"));

        if (isCPU) {
            computeType.add(new Option('F64 Scalar', 'f64-scalar')); 
        } else {
            computeType.add(new Option('F16 Scalar', 'f16-scalar')); 
        }
    }
    
    const savedPrecision = localStorage.getItem('benchmark_precision');
    let optionExists = Array.from(computeType.options).some(opt => opt.value === savedPrecision);
    
    if (optionExists) {
        computeType.value = savedPrecision;
    } else {
        computeType.selectedIndex = 0;
        localStorage.setItem('benchmark_precision', computeType.value);
    }
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
        localStorage.setItem('benchmark_appearance', 'light');
    } 
    else {
        themeToggleBtn.innerText = "Switch to Light Mode";
        localStorage.setItem("benchmark_appearance", "dark");
    }

    if (AppState.currentGraphData.length > 0) {
        plotPerformanceCurve(AppState.currentGraphData);
    }
});

// for UI settings pop
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem("benchmark_appearance");
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        themeToggleBtn.innerText = 'Switch to Dark Mode'
    }
    else {
        themeToggleBtn.innerText = "Switch to Light Mode"
    }

    const savedIters = localStorage.getItem("benchmark_iters");
    if (savedIters) {
        iterInput.value = savedIters;
    }
    // savedPrecision defined before cause it gets overwrite by simd
    const savedPrecision = localStorage.getItem("benchmark_precision");
    const savedSimd = localStorage.getItem("benchmark_simd") === "true";
    simdCheckbox.checked = savedSimd;
    updatePreciOption();

    if (savedPrecision) {
        computeType.value = savedPrecision;
        localStorage.setItem("benchmark_precision", savedPrecision);
    }

    setTimeout(() => {
        const cores = navigator.hardwareConcurrency || 'Unknown';
        document.getElementById('core-count').innerText = `${cores} Threads Available`;
    }, 800);
});

const simdCheckbox = document.getElementById('simd-checkbox');
export const computeType = document.getElementById('compute-type');
export const iterInput = document.getElementById("iter-input");

simdCheckbox.addEventListener('change', (e)=> {
    localStorage.setItem('benchmark_simd', e.target.checked);
    updatePreciOption();
});

computeType.addEventListener('change', (e) => {
    localStorage.setItem('benchmark_precision', e.target.value);
});

iterInput.addEventListener('change', (e) => {
    let val = parseInt(e.target.value);
    if (isNaN(val) || val <= 0){
        e.target.value = 1;
    }
    else if (val >= 100){
        e.target.value = 99;
    }
    localStorage.setItem('benchmark_iters', e.target.value);
});

const iterUp = document.getElementById("iter-up");
const iterDown = document.getElementById("iter-down");

iterUp.addEventListener("click", () =>{
    let val = parseInt(iterInput.value) || 1;
    if (val < 99) {
        iterInput.value = val + 1;
        iterInput.dispatchEvent(new Event('change'));
    }
});

iterDown.addEventListener('click', () => {
    let val = parseInt(iterInput.value) || 1;
    if (val > 1) {
        iterInput.value = val - 1;
        iterInput.dispatchEvent(new Event("change"));
    }
});

// REVIEW: Fixed for current, need to keep an eye if graph get distorted again
const graphContainer = document.querySelector('.canvas-container');
if(graphContainer) {
    new ResizeObserver(() => {
        if (AppState.currentGraphData.length > 0){
            plotPerformanceCurve(AppState.currentGraphData);
        }
    }).observe(graphContainer);
}

export const gflopsDisplay = document.getElementById('gflops-current');

export function toggleUILock(isLocked){
    iterInput.disabled = isLocked;
    computeType.disabled = isLocked;
    processorSelect.disabled = isLocked;
    simdCheckbox.disabled = isLocked;
    const iterArrows = document.querySelector('.iter-arrow');
    if (iterArrows) {
        iterArrows.style.pointerEvents = isLocked ? 'none' : 'auto';
        iterArrows.style.opacity = isLocked ? '0.5' : '1';
    }
}

// Start Button Control!!!
startBtn.addEventListener('click', () => {
    if (AppState.currentProcessor === 'CPU' && !AppState.isEngineReady) {
        warningMsg.innerText = "Error: CPU WASM not compiled yet!";
        warningMsg.classList.add('show-warning');
        setTimeout(() => warningMsg.classList.remove('show-warning'), 3000);
        return;
    }

    if (AppState.currentProcessor === 'GPU' && !navigator.gpu) {
        warningMsg.innerText = "Error: WebGPU not supported on this device falling back to use WebGL if possible!";
        warningMsg.classList.add('show-warning');
        setTimeout(() => warningMsg.classList.remove('show-warning'), 3000);
        return;
    }

    statusText.innerText = `Running ${AppState.currentProcessor} Stress Test...`;
    statusText.classList.remove('idle');
    statusText.classList.add('running');

    stopBtn.classList.remove('is-disabled');
    warningMsg.classList.remove('show-warning');

    AppState.isEngineRunning = true; 
    toggleUILock(true);
    if (AppState.currentProcessor === 'CPU') {
        console.log("WASM CPU starting up...");
        gflopsDisplay.innerText = "Waking up CPU...";
        runCPU()
    }
    else {
        
        console.log("WebGPU Pipeline starting...");
        gflopsDisplay.innerText = "Waking up GPU...";
        runGPU();
    }
});

stopBtn.addEventListener('click', () => {
    if (stopBtn.classList.contains('is-disabled')) {
        warningMsg.innerText = "Please start the stress test first!";
        
        stopBtn.classList.add('vibrate-active');
        setTimeout(() => stopBtn.classList.remove('vibrate-active'), 300);
        warningMsg.classList.add('show-warning');
        setTimeout(() => warningMsg.classList.remove('show-warning'), 2500);
        return;
    }
    AppState.isEngineRunning = false;
    toggleUILock(false);

    if (AppState.activeGPUDevice) {
        AppState.activeGPUDevice.destroy();
        AppState.activeGPUDevice = null;
        console.log('GPU forcefully terminated due to stop request.');
    }

    if (AppState.currentProcessor === 'CPU') {
        benchmarkWorker.postMessage({type: 'STOP'});
    }
    else {
        gflopsDisplay.innerText = "GPU Test Aborted";
    }

    stopBtn.classList.add('is-disabled');
    statusText.innerText = 'Ready';
    statusText.classList.remove('running');
    statusText.classList.add('idle');
});

// Processor & GPU detection
detectUserGPU(cpuWarnMsg, optGPU, gpuWarnMsg).then((fallbackMsg) => {
    AppState.showGpuFallbackMsg = fallbackMsg;
    processorListner();
});