import {plotPerformanceCurve} from "./performanceCurve.js";
import {detectUserGPU, processorListner} from "./processorManager.js";
import {runCPU, runGPU, benchmarkWorker} from "./manage-run.js";
import {toggleUILock, matTestCB, aluTestCB, stressTestCB} from "./UI-manager.js";

//  btn and warning elements
export const startBtn = document.getElementById('start-btn');
export const stopBtn = document.getElementById('stop-btn');
export const statusText = document.getElementById('status-text');
export const warningMsg = document.getElementById('warning-msg');

// Processor & GPU variables
export const processorSelect = document.getElementById('select-processor');
const optGPU = document.getElementById('opt-GPU');
export const gpuWarnMsg = document.getElementById('gpu-warning-msg');
export const cpuWarnMsg = document.getElementById('cpu-warning-msg');

export const AppState = { // ai fixed issue 
    currentProcessor: 'GPU',
    showGpuFallbackMsg: true,
    activeGPUDevice: null,
    currentGraphData: [],
    graphType: [],
    currentGraphNum: 0,
    isEngineRunning: false,
    isEngineReady: false
};

export function setCurrentProcessor(value) { // again ai fixed issue for ES6 or whatever it is
    AppState.currentProcessor = value;
}

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

// Start Button Control!!!
startBtn.addEventListener('click', () => {
    if (!matTestCB.checked && !aluTestCB.checked && !stressTestCB.checked) {
        warningMsg.innerText = "Please select at least one test to run!";
        warningMsg.classList.add('show-warning');
        setTimeout(() => warningMsg.classList.remove('show-warning'), 3000);
        return;
    }

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
        console.log("WebGPU initializing...");
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