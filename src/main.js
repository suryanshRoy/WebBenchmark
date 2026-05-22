import { runWebGPUStage } from "./gpu-engine";

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
let activeGPUDevice = null; // os oom killswitch

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

function plotPerformanceCurve(dataPoints) {
    const canvas = document.getElementById('heatmap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight || 250;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const placeholder = canvas.parentElement.querySelector('.placeholder-text');
    if (placeholder) placeholder.style.display = 'none';
    if (dataPoints.length < 2) return;

    const maxGflops = Math.max(...dataPoints.map(d => d.gflops));

    const padding = {top: 35, right: 20, bottom: 30, left: 50};
    const graphWidth = canvas.width - padding.left - padding.right;
    const graphHeight = canvas.height - padding.top - padding.bottom;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvas.height - padding.bottom);
    ctx.lineTo(canvas.width - padding.right, canvas.height -padding.bottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(95, 255, 105, 0.7)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    dataPoints.forEach((point, index) => {
        const x = padding.left + (index / (dataPoints.length - 1)) * graphWidth;
        const heightRatio = point.gflops / (maxGflops || 1);
        const y = padding.top + graphHeight - (heightRatio * graphHeight);

        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x,y);
    });
    ctx.stroke();

    dataPoints.forEach((point, index) => {
        const x = padding.left + (index / (dataPoints.length - 1)) * graphWidth;
        const heightRatio = point.gflops / (maxGflops || 1);
        const y = padding.top + graphHeight - (heightRatio * graphHeight);

        ctx.fillStyle = 'rgba(255, 49, 49, 0.82)';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(150, 150, 150, 0.9)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`M:${point.matrix}`, x, canvas.height - padding.bottom + 15);
        ctx.fillStyle = 'rgba(62, 50, 146, 0.9)';
        ctx.fillText(`${point.gflops.toFixed(0)} GF`, x, y - 10);
    });

    ctx.fillStyle = 'rgba(150, 150, 150, 0.6)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${maxGflops.toFixed(0)}`, padding.left - 8, padding.top);
    ctx.fillText(`${(maxGflops / 2).toFixed(0)}`, padding.left - 8, padding.top + (graphHeight / 2));
    ctx.fillText(`0`, padding.left - 8, padding.top + graphHeight);

    ctx.fillStyle = 'rgba(95, 255, 105, 0.9)';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const peakText = maxGflops >= 1000 
        ? `Peak: ${(maxGflops/1000).toFixed(2)} TFLOPS` 
        : `Peak: ${maxGflops.toFixed(1)} GFLOPS`;
    ctx.fillText(peakText, padding.left, 5);
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

// --Engine Controls--
startBtn.addEventListener('click', () => {
    if (currentProcessor === 'CPU' && !isEngineReady) {
        warningMsg.innerText = "Error: CPU Engine not compiled yet!";
        warningMsg.classList.add('show-warning');
        setTimeout(() => warningMsg.classList.remove('show-warning'), 3000);
        return;
    }

    if (currentProcessor === 'GPU' && !navigator.gpu) {
        warningMsg.innerText = "Error: WebGPU not supported on this device falling back to WebGL!";
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
        gflopsDisplay.innerText = "Warming up GPU...";

        (async () => {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) throw new Error("No adapter found");
                const device = await adapter.requestDevice();
                activeGPUDevice = device;
                
                const matrixSizes = [256, 512, 1024, 2048, 4096];
                let performanceData = [];
                let bestGflops = 0;
                
                for (let size of matrixSizes) {
                    if (!isEngineRunning) break;
                    
                    gflopsDisplay.innerText = `Testing ${size}x${size}...`;
                    
                    const resultGflops = await runWebGPUStage(device, size, 50, () => isEngineRunning);
                    
                    if (!isEngineRunning || resultGflops.gflops === 0) break;
                    
                    const currentGflops = resultGflops.gflops;
                    if (currentGflops > bestGflops) bestGflops = currentGflops;
                    
                    performanceData.push({matrix: size, gflops: currentGflops});
                    plotPerformanceCurve(performanceData);

                    if (resultGflops.timeTakenSec > 1.5){
                        console.warn(`Matrix ${size} took ${resultGflops.timeTakenSec.toFixed(2)}s. Stopping to prevent crash.`);
                        break;
                    }
                }

                if (isEngineRunning) {
                    let displaySpeed = "";
                    if (bestGflops >= 1000) {
                        displaySpeed = `${(bestGflops / 1000).toFixed(2)} TFLOPS`;
                    } else {
                        displaySpeed = `${bestGflops.toFixed(2)} GFLOPS`;
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
});