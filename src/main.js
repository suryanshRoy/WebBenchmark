import {plotPerformanceCurve} from "./performanceCurve.js";
import {detectUserGPU, processorListner} from "./processorManager.js";
import {runCPU, runGPU, benchmarkWorker} from "./manage-run.js";
import {toggleUILock, matTestCB, aluTestCB, stressTestCB, updateTimerDisplay, memTestCB, flopsFormat, stressChangeM} from "./UI-manager.js";

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

export const AppState = {
    currentProcessor: 'GPU',
    showGpuFallbackMsg: true,
    activeGPUDevice: null,
    currentGraphData: [],
    graphType: [],
    currentGraphNum: 0,
    isEngineRunning: false,
    isEngineReady: false,
    stressRunTime: 0,
    RunTimeState: null
};

export function setCurrentProcessor(value) {
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
    if (startBtn.classList.contains('is-disabled')) {
        warningMsg.innerText = "Benchmark is already running please stop the stress test first!";
        
        startBtn.classList.add('vibrate-active');
        setTimeout(() => startBtn.classList.remove('vibrate-active'), 300);
        warningMsg.classList.add('show-warning');
        setTimeout(() => warningMsg.classList.remove('show-warning'), 3500);
        return;
    }

    if (!matTestCB.checked && !aluTestCB.checked && !stressTestCB.checked && !memTestCB.checked) {
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
    }

    statusText.innerText = `Running ${AppState.currentProcessor} Stress Test...`;
    statusText.classList.remove('idle');
    statusText.classList.add('running');

    stopBtn.classList.remove('is-disabled');
    warningMsg.classList.remove('show-warning');

    AppState.isEngineRunning = true; 
    toggleUILock(true);

    if (stressTestCB.checked) {
        AppState.stressRunTime = Date.now() + 5 * 60 * 1000; 
        document.getElementById('stress-time-box').style.display = 'block';
        updateTimerDisplay();
        if (AppState.RunTimeState) {
            clearInterval(AppState.RunTimeState);
        }
        AppState.RunTimeState = setInterval(updateTimerDisplay, 1000);
    }
    else {
        document.getElementById('stress-time-box').style.display = 'none';
    }

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
        setTimeout(() => warningMsg.classList.remove('show-warning'), 3500);
        return;
    }
    const hasUserEndTest = stressTestCB.checked && (AppState.stressRunTime - Date.now() <= 100);
    AppState.isEngineRunning = false;
    toggleUILock(false);
    clearInterval(AppState.RunTimeState);
    document.getElementById('stress-time-box').style.display = 'none';

    if (AppState.activeGPUDevice) {
        AppState.activeGPUDevice.destroy();
        AppState.activeGPUDevice = null;
        console.log('GPU forcefully terminated due to stop request.');
    }

    if (AppState.currentProcessor === 'CPU') {
        benchmarkWorker.postMessage({type: 'STOP'});
    }
    if (hasUserEndTest) {
        const fstVal = AppState.currentGraphData[0];
        const lastVal = AppState.currentGraphData[AppState.currentGraphData.length - 1];
        const baseVal = fstVal ? fstVal.gflops : 0;
        const finalGflops = lastVal ? lastVal.gflops : 0;
        
        flopsFormat(finalGflops);
        statusText.innerText = 'Completed';
        gflopsDisplay.innerHTML = stressChangeM(finalGflops, baseVal);
    } else {
        gflopsDisplay.innerText = `${AppState.currentProcessor} Test Aborted`;
        statusText.innerText = 'Ready';
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