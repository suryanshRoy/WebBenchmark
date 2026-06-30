import {plotPerformanceCurve} from "./performanceCurve.js";
import {GPU_ALU, runWebGPU} from "./gpu-engine.js";
import {gflopsDisplay, warningMsg, statusText, AppState, stopBtn} from "./main.js";
import {computeType, iterInput, toggleUILock, showGraphBtn, matTestCB, aluTestCB, matSize, stressTestCB} from "./UI-manager.js";

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
    AppState.graphType = [];
    AppState.currentGraphNum = 0;
    showGraphBtn(false);

    AppState.isEngineRunning = true; 
    toggleUILock(true);

    try {
        let matrixSize = [256, 512, 1024, 2048, 4096];
        if (matSize.value !== "default") {
            matrixSize = [parseInt(matSize.value)];
        }
        let performanceData = [];
        let FinalGFLOPS = 0;
        const isStressTest = stressTestCB.checked;
        const runMat = matTestCB.checked || isStressTest;

        if (runMat) {
        let maxMatSize = 256;
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
            maxMatSize = size; // since this is inside for loop, this will be the last successful size

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
        if (isStressTest && AppState.isEngineRunning) {
            const startTime = performance.now();

            while (AppState.isEngineRunning) {
                if (performance.now() - startTime > 180000) {// 3 minutes to burn the chip :)
                    console.warn("3 minute stress test completed! Stopping...");
                    break;
                }
                gflopsDisplay.innerText = `Stress Test: ${maxMatSize}x${maxMatSize}`;

                const result = await cpuMatRun(maxMatSize, userIters, userPrecision);
                if (!AppState.isEngineRunning || result.gflops === 0) {
                    break;
                }
                performanceData.push({matrix: maxMatSize, gflops: result.gflops});
                AppState.currentGraphData = performanceData;
                plotPerformanceCurve(performanceData);

                await new Promise(resolve => setTimeout(resolve, 500)); // REVIEW maybe 0.5 sec is good but still need to check if UI is responsive or not
            }
       }}

        if (performanceData.length > 0) {
            AppState.graphType.push({
                name: "Matrix",
                data: [...performanceData]
            });
            showGraphBtn(true);
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
    AppState.graphType = [];
    AppState.currentGraphNum = 0;
    showGraphBtn(false);

    const userIters = parseInt(iterInput.value) || 20;
    const userPrecision = computeType.value;

    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error("Sorry, this device does not support WebGPU, WebGL2 or WebGL. Please try a different device or browser.");
        const requiredFeatures = [];
        if (adapter.features.has('shader-f16')){
            requiredFeatures.push('shader-f16');
        }

        const bufferLimit = {
            maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
            maxBufferSize: adapter.limits.maxBufferSize,
        };

        const device = await adapter.requestDevice({requiredFeatures, requiredLimits: bufferLimit});
        AppState.activeGPUDevice = device;
        
        let matrixSizes = [256, 512, 1024, 2048, 4096];
        if (matSize.value !== "default") {
            matrixSizes = [parseInt(matSize.value)];
        }
        let performanceData = [];
        let FinalGFLOPS = 0;

        const isStressTest = stressTestCB.checked;
        const runMat = matTestCB.checked || isStressTest;
        
        if (runMat) {
            let maxMatSize = 256;
            for (let size of matrixSizes) {
                if (!AppState.isEngineRunning) break;
                
                gflopsDisplay.innerText = `Testing ${size}x${size}...`;
                
                const resultGflops = await runWebGPU(device, size, userIters, userPrecision, () => AppState.isEngineRunning);
                
                if (!AppState.isEngineRunning || resultGflops.gflops === 0) break;
                
                const currentGflops = resultGflops.gflops;
                if (currentGflops > FinalGFLOPS) FinalGFLOPS = currentGflops;
                maxMatSize = size; // since this is inside for loop, this will be the last successful size
                
                performanceData.push({matrix: size, gflops: currentGflops});
                AppState.currentGraphData = performanceData;
                plotPerformanceCurve(performanceData);

                if (resultGflops.timeTakenSec > 1.5){
                    console.warn(`Matrix ${size} took ${resultGflops.timeTakenSec.toFixed(2)}s. Stopping to prevent crash.`);
                    break;
                }
            }

            if (isStressTest && AppState.isEngineRunning) {
                gflopsDisplay.innerText = `Stress Test ${maxMatSize}x${maxMatSize}`;
                let GflopsStats = 0;
                let stressData = [];
                
                await runWebGPU(device, maxMatSize, userIters, userPrecision, () => AppState.isEngineRunning, (gflops) => {

                    if (GflopsStats === 0) GflopsStats = gflops;
                    let changePercent = GflopsStats > 0 ? ((gflops - GflopsStats)) / GflopsStats * 100 : 0; 

                    gflopsDisplay.innerText = `Stress Test ${maxMatSize}x${maxMatSize}: ${gflops.toFixed(2)} GFLOPS`;

                    let isGFLOPS = gflops >= 1000 ? `${(gflops/1000).toFixed(2)} TFLOPS` : `${gflops.toFixed(2)} GFLOPS`;

                    if (changePercent >= 1.0) {
                        gflopsDisplay.innerHTML = `${isGFLOPS} <span class ="inc-percentage">▲ ${changePercent.toFixed(1)}%</span>`;
                    }
                    else if (changePercent <= -1.0) {
                        gflopsDisplay.innerHTML = `${isGFLOPS} <span class ="drop-percentage">▼ ${Math.abs(changePercent).toFixed(1)}%</span>`;
                    }
                    else {
                        gflopsDisplay.innerHTML = isGFLOPS;
                    }
                    
                    stressData.push({matrix: null, gflops: gflops});
                    AppState.currentGraphData = stressData;
                    plotPerformanceCurve(stressData);
                });
            }
            
            if (performanceData.length > 0){
                AppState.graphType.push({
                name: "Matrix",
                data: [...performanceData]
                });
            }
        }

        if (AppState.isEngineRunning && aluTestCB.checked && !isStressTest) {
            let displaySpeed = "";
            displaySpeed = `${FinalGFLOPS.toFixed(2)} GFLOPS`;
            gflopsDisplay.innerText = displaySpeed;

            AppState.activeGPUDevice.destroy();
            AppState.activeGPUDevice = null;
        
            await new Promise(resolve => setTimeout(resolve, 3000));
            if (!AppState.isEngineRunning) return;

            statusText.innerText = 'Computing ALU Benchmark Test...'
            gflopsDisplay.innerText = 'Computing ALU Benchmark Test...';

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
            AppState.currentGraphData = aluResult;
            gflopsDisplay.innerText = displayText;
            plotPerformanceCurve(aluResult);
            });

            AppState.graphType.push({
                name: "ALU", 
                data: [...aluResult]
            });
            AppState.currentGraphNum = AppState.graphType.length - 1;
            AppState.currentGraphData = [...aluResult];
            onFinishManager(true, FinalGFLOPS, ResultAluGflops);
        }
        else if (AppState.isEngineRunning) {
            if (AppState.activeGPUDevice) {
                AppState.activeGPUDevice.destroy();
                AppState.activeGPUDevice = null;
            }
            onFinishManager(false, FinalGFLOPS, 0);
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
        showGraphBtn(true);
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