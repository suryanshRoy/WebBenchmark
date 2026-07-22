import {plotPerformanceCurve, addMemLog, resetMemVis, showMemVis, updateMemVis} from "./performanceCurve.js";
import {GPU_ALU, runWebGPU} from "./gpu-engine.js";
import {gflopsDisplay, warningMsg, statusText, AppState, stopBtn} from "./main.js";
import {computeType, iterInput, toggleUILock, showGraphBtn, matTestCB, aluTestCB, matSize, stressTestCB, flopsFormat, graphSync, stressChangeM} from "./UI-manager.js";
import { WebGL_ALU } from "./webgl-engine.js";
import { memTestCB } from "./UI-manager.js";

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

    if (data.type === 'memResult') {
        const gflops = data.result;
        console.log(`CPU Memory Bandwidth: ${gflops.toFixed(2)} GB/s`);
    }
};

benchmarkWorker.onerror = function(error) {
    console.error("Worker error: ", error);
};

// Memory based matr computation
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

export function runMemCPU(sizeMB, runType){
    return new Promise((resolve) => {
        const listner = (e) =>{
            if (e.data.type === 'memResult'){
                benchmarkWorker.removeEventListener('message', listner);
                resolve(parseFloat(e.data.result));
            }
        };
        benchmarkWorker.addEventListener('message', listner);
        benchmarkWorker.postMessage({
            type: 'Start_mem_band',
            sizeMB: sizeMB,
            runType : runType
        });
        console.log(`Current size: ${sizeMB}MB, runType: ${runType}`);
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
    resetMemVis();

    try {
        let matrixSize = [256, 512, 1024, 2048, 4096];
        if (matSize.value !== "default") {
            matrixSize = [parseInt(matSize.value)];
        }
        let performanceData = [];
        let FinalGFLOPS = 0;
        let isMemRun = false;
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
                const timeSpentSec = (performance.now() - startTime) / 1000;

                if (GflopsStats === 0) {
                    GflopsStats = result.gflops;
                }
                gflopsDisplay.innerHTML = stressChangeM(result.gflops, GflopsStats);

                stressData.push({matrix: 'throttleTest', gflops: result.gflops, timeSpentSec});
                AppState.currentGraphData = stressData;
                plotPerformanceCurve(stressData);

                await new Promise(resolve => setTimeout(resolve, 500)); // REVIEW maybe 0.5 sec is good but still need to check if UI is responsive or not
                }
            }    
        }

        if (memTestCB.checked && AppState.isEngineRunning && !isStressTest) {
            isMemRun = true;
            showMemVis(true);

            const memorySizes = [0.25, 0.5, 1, 2 ,4 ,8 ,16 , 32, 64, 128, 256]; // NOTE you can add any value that u want to so test run on that size
            const testTypes = [
                {id: 1, name: 'Read', domId: 'read'},
                {id: 2, name: 'Write', domId: 'write'},
                {id: 0, name: 'Copy', domId: 'copy'}
            ];

            let finalBanVal = {read: 0, write: 0, copy: 0};
            const maxDisplaySpeed = 700;

            for (let type of testTypes) {

                addMemLog(`------ ${type.name} ------`, true);
                let currentMem = [];
                for (let size of memorySizes){

                    if (!AppState.isEngineRunning){
                        break;
                    }

                    let convSize = size < 1 ? `${Math.round(size * 1024)}KB` : `${size}MB`;
                    statusText.innerText = `Testing Bandwidth ${type.name} ${convSize}...`;

                    const gbps = await runMemCPU(size, type.id);

                    finalBanVal[type.domId] = gbps;
                    updateMemVis(type.domId, gbps, maxDisplaySpeed);
                    addMemLog(`Size: ${convSize}, Bandwidth: ${gbps.toFixed(2)} GB/s`);
                }

                if (currentMem.length > 0){

                    AppState.graphType.push({
                        name: `Memory ${type.name}`,
                        data: [...currentMem]
                    });
                }
            }

            AppState.graphType.push({
                name: "Memory Visualizer",
                isVisualizer: true,
                finalBanVal: {...finalBanVal }
            });
        }

        if (performanceData.length > 0) {
            AppState.graphType.push({
                name: "Matrix",
                data: [...performanceData]
            });
        }
        if (AppState.graphType.length > 0 && AppState.isEngineRunning) {
            AppState.currentGraphNum = AppState.graphType.length - 1;
            showGraphBtn(true);
            graphSync();
        }
        if (AppState.isEngineRunning) {
            if (isMemRun && FinalGFLOPS === 0){
                statusText.innerText = `Completed`;
                statusText.classList.remove("running");
                statusText.classList.add('idle');
                stopBtn.classList.add("is-disabled");
                AppState.isEngineRunning = false;
                toggleUILock(false);
            }
            else{
                onFinishManager(false, FinalGFLOPS, 0);
            }
        }
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
            console.warn("WebGPU is not supported. Falling back to WebGL or WebGL2 whatever possible!");
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
            if (isWebGL) {  // NOTE the stress test in the webgl will use the alu cause matrix is impossible in the webgl mode
                if (isStressTest) {
                    gflopsDisplay.innerText = "Running ALU stress test...";
                    const stressData = [];
                    const stressStart = performance.now();
                    let GflopsStats = 0;
                    let lastUpdate = 0;

                    while (AppState.isEngineRunning) {
                        const resultGflops = await WebGL_ALU(() => AppState.isEngineRunning, (gflops) => {
                            if (!AppState.isEngineRunning) return;

                                const curTime = performance.now();

                                if (curTime - lastUpdate >= 1000) {
                                    lastUpdate = curTime;
                                    const timeSpentSec = (curTime - stressStart) / 1000;
                                
                                if (GflopsStats === 0) {
                                    GflopsStats = gflops;
                                }
                                gflopsDisplay.innerHTML = stressChangeM(gflops, GflopsStats);
                                stressData.push({matrix: 'throttleTest', gflops, timeSpentSec});
                                AppState.currentGraphData = stressData;
                                plotPerformanceCurve(stressData);
                            }
                        });

                        if (!AppState.isEngineRunning || resultGflops === 0) {
                            break;
                        }
                    }
                }
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
                    const stressStart = performance.now();
                    let lastUpdate = 0;
                    
                    await runWebGPU(device, maxMatSize, userIters, userPrecision, () => AppState.isEngineRunning, (gflops) => {
                        const curTime = performance.now();
                        if (curTime - lastUpdate >= 1000) {

                        if (GflopsStats === 0) GflopsStats = gflops;
                            const timeSpentSec = (performance.now() - stressStart) / 1000;
                            gflopsDisplay.innerHTML = stressChangeM(gflops, GflopsStats);
                            stressData.push({matrix: 'throttleTest', gflops: gflops, timeSpentSec});
                            AppState.currentGraphData = stressData;
                            plotPerformanceCurve(stressData);
                        }
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
            let lastUpdate = 0;

            if (isWebGL) { 
                ResultAluGflops = await WebGL_ALU(() => AppState.isEngineRunning, (gflops) => {
                    const curTime = performance.now();

                    if (curTime - lastUpdate >= 1000) {
                        let displayText = gflops >= 1000 ? `${(gflops/1000).toFixed(2)} TFLOPS` : `${gflops.toFixed(2)} GFLOPS`;
                        aluResult.push({matrix: null, gflops: gflops});
                        AppState.currentGraphData = aluResult
                        gflopsDisplay.innerText = displayText;
                        plotPerformanceCurve(aluResult);
                    }
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