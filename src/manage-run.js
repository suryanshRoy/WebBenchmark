import {plotPerformanceCurve} from "./performanceCurve.js";
import {GPU_ALU, runWebGPU} from "./gpu-engine.js";
import {computeType, gflopsDisplay, iterInput, toggleUILock, warningMsg, statusText, AppState, stopBtn} from "./main";

export const benchmarkWorker = new Worker(new URL('./worker.js', import.meta.url));

benchmarkWorker.onmessage = function(event) {
    const data = event.data;

    if (data.type === 'READY') {
        console.log('WASM Worker Loaded & Ready');
        statusText.innerText = 'Ready';
        AppState.isEngineReady = true;
    }
    else if (data.type === 'UPDATE'){
        gflopsDisplay.innerText = `${data.gflops} GFLOPS`;
    }
};

benchmarkWorker.onerror = function(error) {
    console.error("Worker error: ", error);
};

// Memory based computation
export function cpuMatRun(size, iterations, precision) {
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

export async function runCPU() {

    const userIters = parseInt(iterInput.value) || 20;
    const userPrecision = computeType.value;

    AppState.isEngineRunning = true; 
    toggleUILock(true);

    try {
        const matrixSize = [256, 512, 1024, 2048, 4096];
        let performanceData = [];
        let FinalGFLOPS = 0;

        for(let size of matrixSize){
            if (!AppState.isEngineRunning) break;
            gflopsDisplay.innerText = `Testing ${size}x${size}...`;

            const result = await cpuMatRun(size, userIters, userPrecision);
            if (!AppState.isEngineRunning || result.gflops === 0) {
                break;
            }
            if (result.gflops > FinalGFLOPS){
                FinalGFLOPS =  result.gflops;
            }

            performanceData.push({matrix: size, gflops: result.gflops});
            AppState.currentGraphData = performanceData;
            plotPerformanceCurve(performanceData);

            // REVIEW: May require some changes
            const nextEstimatedTime = result.timeTakenSec * 8.0;
            if (nextEstimatedTime > 6.0) {
                console.warn(`Matrix ${size} took ${result.timeTakenSec.toFixed(2)}s. Next may take it's 8x time!`);
                break;
            }
        }
        onFinishManager(false, FinalGFLOPS, 0);
    }
    catch (error) {
        handleError("CPU", error);
    }
}

export async function runGPU() {
    AppState.isEngineRunning = true; 
    toggleUILock(true);

    const userIters = parseInt(iterInput.value) || 20;
    const userPrecision = computeType.value;

    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error("No adapter found");
        const requiredFeatures = [];
        if (adapter.features.has('shader-f16')){
            requiredFeatures.push('shader-f16');
        }
        const device = await adapter.requestDevice({requiredFeatures});
        AppState.activeGPUDevice = device;
        
        const matrixSizes = [256, 512, 1024, 2048, 4096];
        let performanceData = [];
        let FinalGFLOPS = 0;
        
        for (let size of matrixSizes) {
            if (!AppState.isEngineRunning) break;
            
            gflopsDisplay.innerText = `Testing ${size}x${size}...`;
            
            const resultGflops = await runWebGPU(device, size, userIters, userPrecision, () => AppState.isEngineRunning);
            
            if (!AppState.isEngineRunning || resultGflops.gflops === 0) break;
            
            const currentGflops = resultGflops.gflops;
            if (currentGflops > FinalGFLOPS) FinalGFLOPS = currentGflops;
            
            performanceData.push({matrix: size, gflops: currentGflops});
            AppState.currentGraphData = performanceData;
            plotPerformanceCurve(performanceData);

            if (resultGflops.timeTakenSec > 1.5){
                console.warn(`Matrix ${size} took ${resultGflops.timeTakenSec.toFixed(2)}s. Stopping to prevent crash.`);
                break;
            }
        }

        if (AppState.isEngineRunning) {
            let displaySpeed = "";
            displaySpeed = `${FinalGFLOPS.toFixed(2)} GFLOPS`;
            gflopsDisplay.innerText = displaySpeed;

            AppState.activeGPUDevice.destroy();
            AppState.activeGPUDevice = null;
        
            await new Promise(resolve => setTimeout(resolve, 3000));
            if (!AppState.isEngineRunning) return;

            statusText.innerText = 'Computing ALU Stress Test...'
            gflopsDisplay.innerText = 'Computing ALU Stress Test...';

            const aluAdapter = await navigator.gpu.requestAdapter();
            if (!aluAdapter || !AppState.isEngineRunning) {
                return onFinishManager(false, FinalGFLOPS, 0);
            }
            const aluDevice = await aluAdapter.requestDevice();
            AppState.activeGPUDevice = aluDevice;

            if (!AppState.isEngineRunning) {
                aluDevice.destroy();
                AppState.activeGPUDevice = null;
                return;
            }
            
            let aluResult = [];
            const ResultAluGflops = await GPU_ALU(aluDevice, () => AppState.isEngineRunning, (gflops) => {

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

            onFinishManager(true, FinalGFLOPS, ResultAluGflops);
        }
    }
    catch (error) {
        handleError("GPU", error);
    }
}

function onFinishManager(onALU, FinalGFLOPS, ResultAluGflops) {
    if (AppState.isEngineRunning) {
        let displaySpeed = "";
        if (onALU) {
            if (ResultAluGflops >= 1000) {
                displaySpeed = `${(ResultAluGflops / 1000).toFixed(2)} TFLOPS`;
            } else {
                displaySpeed = `${ResultAluGflops.toFixed(2)} GFLOPS`;
            }
        } 
        else {
            if (FinalGFLOPS >= 1000) {
                displaySpeed = `${(FinalGFLOPS / 1000).toFixed(2)} TFLOPS`;
            } else {
                displaySpeed = `${FinalGFLOPS.toFixed(2)} GFLOPS`;
            }
        }
        gflopsDisplay.innerText = displaySpeed;
        statusText.innerText = 'Completed';
        statusText.classList.remove("running");
        statusText.classList.add('idle');
        stopBtn.classList.add("is-disabled");
        AppState.isEngineRunning = false;
        toggleUILock(false);
    }
}

function handleError(type, error){
    console.error(`${AppState.currentProcessor} Test Failed! Error: `, error);
    if (AppState.isEngineRunning) {
        warningMsg.innerText = `${type} Execution Failed!`;
        warningMsg.classList.add('show-warning');
        stopBtn.click();
    }
}