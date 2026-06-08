import {GPU_ALU, runWebGPU} from "./gpu-engine";
import {plotPerformanceCurve} from "./performanceCurve.js";
import {detectUserGPU} from "./detectProcessor.js";

//  btn and warning elements
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusText = document.getElementById('status-text');
const warningMsg = document.getElementById('warning-msg');

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
const processorSelect = document.getElementById('processor-select');
const optGPU = document.getElementById('opt-GPU');
const gpuWarnMsg = document.getElementById('gpu-warning-msg');
const cpuWarnMsg = document.getElementById('cpu-warning-msg');

let currentProcessor = 'GPU';
let showGpuFallbackMsg = true;
let activeGPUDevice = null; // os oom killswitch
let currentGraphData = [];

function toggleSidebar() {
    sidebar.classList.toggle('closed');
    sidebarOverlay.classList.toggle('active');
}

function updatePreciOption() { // precision options
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

    if (currentGraphData.length > 0) {
        plotPerformanceCurve(currentGraphData);
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
const computeType = document.getElementById('compute-type');
const iterInput = document.getElementById("iter-input");

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
        if (currentGraphData.length > 0){
            plotPerformanceCurve(currentGraphData);
        }
    }).observe(graphContainer);
}

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

// Memory based computation
function cpuMatRun(size, iterations, precision) {
    return new Promise((resolve) => {
        const listner = (e) => {
            if (e.data.type === 'RUN2_COMPLETE') {
                benchmarkWorker.removeEventListener('message', listner);
                resolve({gflops: parseFloat(e.data.gflops), timeTakenSec: e.data.timeTakenSec});
            }
        };
        benchmarkWorker.addEventListener('message', listner);
        benchmarkWorker.postMessage({
            type: 'START_2',
            matrix: size,
            iterations: iterations,
            precision: precision 
        });
    });
}

function toggleUILock(isLocked){
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
    if (currentProcessor === 'CPU' && !isEngineReady) {
        warningMsg.innerText = "Error: CPU WASM not compiled yet!";
        warningMsg.classList.add('show-warning');
        setTimeout(() => warningMsg.classList.remove('show-warning'), 3000);
        return;
    }

    if (currentProcessor === 'GPU' && !navigator.gpu) {
        warningMsg.innerText = "Error: WebGPU not supported on this device falling back to use WebGL if possible!";
        warningMsg.classList.add('show-warning');
        setTimeout(() => warningMsg.classList.remove('show-warning'), 3000);
        return;
    }

    statusText.innerText = `Running ${currentProcessor} Stress Test...`;
    statusText.classList.remove('idle');
    statusText.classList.add('running');

    stopBtn.classList.remove('is-disabled');
    warningMsg.classList.remove('show-warning');

    const userIters = parseInt(iterInput.value) || 20;
    const userPrecision = computeType.value;

    isEngineRunning = true; 
    toggleUILock(true);
    if (currentProcessor === 'CPU') {
        console.log("WASM CPU starting up...");
        gflopsDisplay.innerText = "Waking up CPU...";

        (async() => {
            try {
                const matrixSize = [256, 512, 1024, 2048, 4096];
                let performanceData = [];
                let FinalGFLOPS = 0;

                for(let size of matrixSize){
                    if (!isEngineRunning) break;
                    gflopsDisplay.innerText = `Testing ${size}x${size}...`;

                    const result = await cpuMatRun(size, userIters, userPrecision);
                    if (!isEngineRunning || result.gflops === 0) {
                        break;
                    }
                    if (result.gflops > FinalGFLOPS){
                        FinalGFLOPS =  result.gflops;
                    }

                    performanceData.push({matrix: size, gflops: result.gflops});
                    currentGraphData = performanceData;
                    plotPerformanceCurve(performanceData);

                    // REVIEW: May require some changes
                    const nextEstimatedTime = result.timeTakenSec * 8.0;
                    if (nextEstimatedTime > 6.0) {
                        console.warn(`Matrix ${size} took ${result.timeTakenSec.toFixed(2)}s. Next may take it's 8x time!`);
                        break;
                    }
                }

                if (isEngineRunning) {
                    let displaySpeed = "";
                    if (FinalGFLOPS >= 1000) {
                        displaySpeed = `${(FinalGFLOPS / 1000).toFixed(2)} TFLOPS`;
                    } else {
                        displaySpeed = `${FinalGFLOPS.toFixed(2)} GFLOPS`;
                    }                    
                    gflopsDisplay.innerText = displaySpeed;
                    statusText.innerText = 'Completed';
                    statusText.classList.remove("running");
                    statusText.classList.add('idle');
                    stopBtn.classList.add("is-disabled");
                    isEngineRunning = false;
                    toggleUILock(false);
                }
            }
            catch (error) {
                console.error("CPU Test Failed! Error: ", error);
                if (isEngineRunning) {
                    warningMsg.innerText = "CPU Execution Failed!";
                    warningMsg.classList.add('show-warning');
                    stopBtn.click();
                }
            }
        })();
    }

    else {
        
        console.log("WebGPU Pipeline starting...");
        gflopsDisplay.innerText = "Waking up GPU...";

        (async () => {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) throw new Error("No adapter found");
                // if the f16 adapter exist or not?
                const requiredFeatures = [];
                if (adapter.features.has('shader-f16')){
                    requiredFeatures.push('shader-f16');
                }
                const device = await adapter.requestDevice({requiredFeatures});
                activeGPUDevice = device;
                
                const matrixSizes = [256, 512, 1024, 2048, 4096];
                let performanceData = [];
                let FinalGFLOPS = 0;
                
                for (let size of matrixSizes) {
                    if (!isEngineRunning) break;
                    
                    gflopsDisplay.innerText = `Testing ${size}x${size}...`;
                    
                    const resultGflops = await runWebGPU(device, size, userIters, userPrecision, () => isEngineRunning);
                    
                    if (!isEngineRunning || resultGflops.gflops === 0) break;
                    
                    const currentGflops = resultGflops.gflops;
                    if (currentGflops > FinalGFLOPS) FinalGFLOPS = currentGflops;
                    
                    performanceData.push({matrix: size, gflops: currentGflops});
                    currentGraphData = performanceData;
                    plotPerformanceCurve(performanceData);

                    if (resultGflops.timeTakenSec > 1.5){
                        console.warn(`Matrix ${size} took ${resultGflops.timeTakenSec.toFixed(2)}s. Stopping to prevent crash.`);
                        break;
                    }
                }

                if (isEngineRunning) {
                    let displaySpeed = "";
                    displaySpeed = `${FinalGFLOPS.toFixed(2)} GFLOPS`;
                    gflopsDisplay.innerText = displaySpeed;

                    device.destroy();
                    activeGPUDevice = null;
                

                    await new Promise(resolve => setTimeout(resolve, 3000));
                    if (!isEngineRunning) return;

                    statusText.innerText = 'Computing ALU Stress Test...'
                    gflopsDisplay.innerText = 'Computing ALU Stress Test...';

                    const aluAdapter = await navigator.gpu.requestAdapter();
                    if (!aluAdapter || !isEngineRunning) {
                        statusText.innerText = 'Completed';
                        statusText.classList.remove("running");
                        statusText.classList.add('idle');
                        stopBtn.classList.add("is-disabled");
                        isEngineRunning = false;
                        toggleUILock(false);
                        return;
                    }
                    const aluDevice = await aluAdapter.requestDevice();
                    activeGPUDevice = aluDevice;

                    if (!isEngineRunning) {
                        aluDevice.destroy();
                        activeGPUDevice = null;
                        return;
                    }
                    
                    let aluResult = [];
                    const ResultAluGflops = await GPU_ALU(aluDevice, () => isEngineRunning, (gflops) => {

                    let displayText = "";
                    if (gflops >=1000){
                        displayText = `${(gflops / 1000).toFixed(2)} TFLOPS`;
                    }
                    else {
                        displayText = `${gflops.toFixed(2)} GFLOPS`;
                    }
                    aluResult.push({matrix: null, gflops: gflops});
                    gflopsDisplay.innerText = displayText;
                    plotPerformanceCurve(aluResult);
                    });

                    if (isEngineRunning){
                        let finalDisplay = "";
                        if (ResultAluGflops >= 1000){
                            finalDisplay = `${(ResultAluGflops / 1000).toFixed(2)} TFLOPS`;
                        }
                        else{
                            finalDisplay = `${ResultAluGflops.toFixed(2)} GFLOPS`;
                        }
                        gflopsDisplay.innerText = finalDisplay;
                        statusText.innerText = `Completed`;
                        statusText.classList.remove("running");
                        statusText.classList.add('idle');
                        stopBtn.classList.add("is-disabled");
                        isEngineRunning = false;
                        toggleUILock(false);
                    }
                }
            }
            catch (error) {
                console.error("GPU Test Failed! Error: ", error);
                if (isEngineRunning) {
                    warningMsg.innerText = "GPU Execution Failed!";
                    warningMsg.classList.add('show-warning');
                    stopBtn.click();
                }
            }
        })();
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
    isEngineRunning = false;
    toggleUILock(false);

    if (activeGPUDevice) {
        activeGPUDevice.destroy();
        activeGPUDevice = null;
        console.log('GPU forcefully terminated due to stop request.');
    }

    if (currentProcessor === 'CPU') {
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
    showGpuFallbackMsg = fallbackMsg;
});

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
    updatePreciOption();
});