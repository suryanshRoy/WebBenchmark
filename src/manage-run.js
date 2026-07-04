import {plotPerformanceCurve} from "./performanceCurve.js";
import {GPU_ALU, runWebGPU} from "./gpu-engine.js";
import {gflopsDisplay, warningMsg, statusText, AppState, stopBtn} from "./main.js";
import {computeType, iterInput, toggleUILock, showGraphBtn, matTestCB, aluTestCB, matSize, stressTestCB} from "./UI-manager.js";
import { WebGL_ALU } from "./webgl-engine.js";

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
            let stressData = [];
            let GflopsStats = 0;
            gflopsDisplay.innerText = `Stress Test ${maxMatSize}x${maxMatSize}`;

            while (AppState.isEngineRunning) {
                const result = await cpuMatRun(maxMatSize, userIters, userPrecision);
                if (!AppState.isEngineRunning || result.gflops === 0) {
                    break;
                }
                if (GflopsStats === 0) GflopsStats = result.gflops;
                let changePercent = GflopsStats > 0 ? ((result.gflops - GflopsStats)) / GflopsStats * 100 : 0;
                let isGFLOPS = result.gflops >= 1000 ? `${(result.gflops/1000).toFixed(2)} TFLOPS` : `${result.gflops.toFixed(2)} GFLOPS`;

                if (changePercent >= 1.0) {
                    gflopsDisplay.innerHTML = `${isGFLOPS} <span class ="inc-percentage">▲ ${changePercent.toFixed(1)}%</span>`;
                }
                else if (changePercent <= -1.0) {
                    gflopsDisplay.innerHTML = `${isGFLOPS} <span class ="drop-percentage">▼ ${Math.abs(changePercent).toFixed(1)}%</span>`;
                }
                else {
                    gflopsDisplay.innerHTML = isGFLOPS;
                }

                stressData.push({matrix: 'throttleTest', gflops: result.gflops});
                AppState.currentGraphData = stressData;
                plotPerformanceCurve(stressData);

                await new Promise(resolve => setTimeout(resolve, 500)); // REVIEW maybe 0.5 sec is good but still need to check if UI is responsive or not
                }
            }    
        }

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

        let isWebGL = false;
        let device = null;

        const adapter = navigator.gpu ? await navigator.gpu.requestAdapter() : null;

        if (!adapter) {
            console.warn("WebGPU is not supported. Falling back to WebGL2");
            isWebGL = true;
        }
        else {
            const requiredFeatures = [];
            if (adapter.features.has('shader-f16')){
                requiredFeatures.push('shader-f16');
            }

            const bufferLimit = {
                maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
                maxBufferSize: adapter.limits.maxBufferSize,
            };

            device = await adapter.requestDevice({requiredFeatures, requiredLimits: bufferLimit});
            AppState.activeGPUDevice = device;
        }
        
        let matrixSizes = [256, 512, 1024, 2048, 4096];
        if (matSize.value !== "default") {
            matrixSizes = [parseInt(matSize.value)];
        }
        let performanceData = [];
        let FinalGFLOPS = 0;

        const isStressTest = stressTestCB.checked;
        const runMat = matTestCB.checked || isStressTest;
        
        if (runMat) {
            if (isWebGL) {
                gflopsDisplay.innerText = "Running ALU test..."
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            else {
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
                        
                        stressData.push({matrix: 'throttleTest', gflops: gflops});
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
        }

        if (AppState.isEngineRunning && aluTestCB.checked && !isStressTest) {
            let displaySpeed = `${FinalGFLOPS.toFixed(2)} GFLOPS`;
            if (FinalGFLOPS > 0) {
                gflopsDisplay.innerText = displaySpeed
            }

            if (AppState.activeGPUDevice){
                AppState.activeGPUDevice.destroy();
                AppState.activeGPUDevice = null;
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
            if (!AppState.isEngineRunning) return;

            statusText.innerText = 'Computing ALU Benchmark Test...'
            gflopsDisplay.innerText = 'Computing ALU Benchmark Test...';

            let aluResult = [];
            let ResultAluGflops = 0;

            if (isWebGL) { 
                ResultAluGflops = await WebGL_ALU(() => AppState.isEngineRunning, (gflops) => {
                    let displayText = gflops >= 1000 ? `${(gflops/1000).toFixed(2)} TFLOPS` : `${gflops.toFixed(2)} GFLOPS`;
                    aluResult.push({matrix: null, gflops: gflops});
                    AppState.currentGraphData = aluResult
                    gflopsDisplay.innerText = displayText;
                    plotPerformanceCurve(aluResult);
                });
            }
            else {
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
                
                ResultAluGflops = await GPU_ALU(aluDevice, () => AppState.isEngineRunning, (gflops) => {

                    let displayText = gflops >= 1000 ? `${(gflops / 1000).toFixed(2)} TFLOPS` : `${gflops.toFixed(2)} GFLOPS`;
                    aluResult.push({matrix: null, gflops: gflops});
                    AppState.currentGraphData = aluResult;
                    gflopsDisplay.innerText = displayText;
                    plotPerformanceCurve(aluResult);
                });
            }

        if (aluResult.length > 0) {
            AppState.graphType.push({
                name: "ALU", 
                data: [...aluResult]
            });
            AppState.currentGraphNum = AppState.graphType.length - 1;
            AppState.currentGraphData = [...aluResult];
        }
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