import { runWebGPUStage } from "./gpu-engine";

// Get btn and warning elements
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

function updatePreciOption() {
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

// for UI pop
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

// FLOP Graph
function plotPerformanceCurve(performanceData) {
    const canvas = document.getElementById('gflops-canvas'); 
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight || 250;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const placeholder = canvas.parentElement.querySelector('.placeholder-text');
    if (placeholder) placeholder.style.display = 'none';
    if (performanceData.length < 2) return;

    const maxGflops = Math.max(...performanceData.map(d => d.gflops), 1);

    const padding = {top: 35, right: 20, bottom: 30, left: 50};
    const graphWidth = canvas.width - padding.left - padding.right;
    const graphHeight = canvas.height - padding.top - padding.bottom;
    const bottomY = canvas.height - padding.bottom;

    const isLightMode = document.body.classList.contains('light-mode');
    const axisColor = isLightMode ? 'rgb(0, 25, 12)' : 'rgba(255, 255, 255, 0.2)';
    const gridTextColor = isLightMode ? 'rgba(30, 35, 40, 0.8)' : 'rgba(200, 200, 200, 0.8)';
    const scaleTextColor = isLightMode ? 'rgb(0, 25, 12)' : 'rgba(150, 150, 150, 0.6)';
    const peakTextColor = isLightMode ? 'rgba(0, 140, 110, 0.8)' : 'rgba(98, 242, 108, 0.87)';
    const nodeTextColor = isLightMode ? 'rgba(0, 140, 114, 0.85)' : 'rgb(0, 201, 205)';
    const lineColor = isLightMode ? 'rgba(18, 210, 175, 0.84)' : 'rgba(0, 255, 204, 0.86)';
    const gradientStart = isLightMode ? 'rgba(37, 207, 165, 0.66)' : 'rgba(0, 255, 204, 0.29)';
    const gradientEnd = isLightMode ? 'rgba(142, 182, 223, 0.68)' : 'rgba(0, 72, 92, 0.09)';

    ctx.beginPath();
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, bottomY);
    ctx.lineTo(canvas.width - padding.right, bottomY);
    ctx.stroke();
    
    let coords = [];
    performanceData.forEach((point, index) => {
        const x = padding.left + (index / (performanceData.length - 1)) * graphWidth;
        const heightRatio = point.gflops / maxGflops;
        const y = bottomY - (heightRatio * graphHeight);
        coords.push({x, y});
    });

    // Draw line of GFLOPS
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
        ctx.lineTo(coords[i].x, coords[i].y);
    }
    ctx.stroke();

    ctx.lineTo(coords[coords.length - 1].x, bottomY);
    ctx.lineTo(coords[0].x, bottomY);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, bottomY);
    gradient.addColorStop(0, gradientStart);
    gradient.addColorStop(1, gradientEnd);
    ctx.fillStyle = gradient;
    ctx.fill();

    coords.forEach((coord, index) => {
        // Display points on Graph
        const point = performanceData[index];

        ctx.fillStyle = 'rgba(255, 49, 49, 0.82)';
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // label grids on graph
        ctx.fillStyle = gridTextColor;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`M:${point.matrix}`, coord.x, bottomY + 15);
        
        ctx.fillStyle = nodeTextColor;
        ctx.fillText(`${point.gflops.toFixed(0)} GF`, coord.x, coord.y - 10);
    });

    // Y-axis limits
    ctx.fillStyle = scaleTextColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${maxGflops.toFixed(0)}`, padding.left - 8, padding.top);
    ctx.fillText(`${(maxGflops / 2).toFixed(0)}`, padding.left - 8, padding.top + (graphHeight / 2));
    ctx.fillText(`0`, padding.left - 8, bottomY);

    ctx.fillStyle = peakTextColor;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const peakText = maxGflops >= 1000 
        ? `Peak: ${(maxGflops/1000).toFixed(2)} TFLOPS` 
        : `Peak: ${maxGflops.toFixed(1)} GFLOPS`;
    ctx.fillText(peakText, padding.left, 5);
}

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

function runCPUMatrix(size, iterations, precision) {
    return new Promise((resolve) => {
        const tempListener = (e) => {
            if (e.data.type === 'RUN2_COMPLETE') {
                benchmarkWorker.removeEventListener('message', tempListener);
                resolve({gflops: parseFloat(e.data.gflops), timeTakenSec: e.data.timeTakenSec});
            }
        };
        benchmarkWorker.addEventListener('message', tempListener);
        benchmarkWorker.postMessage({
            type: 'START_2',
            matrix: size,
            iterations: iterations,
            precision: precision 
        });
    });
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

                    const result = await runCPUMatrix(size, userIters, userPrecision);
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
                    
                    const resultGflops = await runWebGPUStage(device, size, userIters, userPrecision, () => isEngineRunning);
                    
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
                    if (FinalGFLOPS >= 1000) {
                        displaySpeed = `${(FinalGFLOPS / 1000).toFixed(2)} TFLOPS`;
                    } else {
                        displaySpeed = `${FinalGFLOPS.toFixed(2)} GFLOPS`;
                    }
                    gflopsDisplay.innerText = displaySpeed;

                    statusText.innerText = 'Completed';
                    statusText.classList.remove('running');
                    statusText.classList.add('idle');
                    stopBtn.classList.add('is-disabled');
                    isEngineRunning = false;
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
    updatePreciOption();
});