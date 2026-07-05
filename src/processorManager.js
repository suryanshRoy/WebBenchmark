import * as mainData from './main.js';
import {updatePreciOption, aluTestCB, matTestCB, isMatTest} from './UI-manager.js';
import {setCurrentProcessor} from './main.js';

export async function detectUserGPU(cpuWarnMsg, optGPU, gpuWarnMsg) {

    cpuWarnMsg.classList.add('hidden');

    try {
        if (navigator.gpu) {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
                const info = adapter.info;
                const apiName = info.architecture || info.vendor || 'WebGPU';

                optGPU.innerText = `GPU (${apiName})`;
                gpuWarnMsg.classList.add('hidden');

                return false;
            }
        }
        
        const canvas = document.createElement('canvas');
        const glContext = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (glContext) {
            const debugInfo = glContext.getExtension('WEBGL_debug_renderer_info');
            const rendererName = debugInfo ? glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'WebGL';

            optGPU.innerText = `GPU (WebGL)`;
            gpuWarnMsg.innerText = `WebGL Active: ${rendererName}`;
            gpuWarnMsg.classList.remove('hidden');

            return true;
        }

        optGPU.innerText = "GPU";
        gpuWarnMsg.innerText = "Graphics hardware unsupported";
        gpuWarnMsg.classList.remove('hidden');

        return true;
    } catch (error) {
        console.error("GPU detection failed", error);
        optGPU.innerText = "GPU";
        gpuWarnMsg.innerText = "GPU detection failed.";
        gpuWarnMsg.classList.remove('hidden');

        return true;
    }
}

export function processorListner() {
    mainData.processorSelect.addEventListener('change', (event) => {
        if (mainData.AppState.isEngineRunning) {
            event.target.value = mainData.AppState.currentProcessor;
            return;
        }

        setCurrentProcessor(event.target.value);

        if (mainData.AppState.currentProcessor === "CPU") {
            mainData.cpuWarnMsg.classList.remove('hidden');
            mainData.gpuWarnMsg.classList.add('hidden');

            aluTestCB.parentElement.classList.add('hidden');
            aluTestCB.checked = false;
            matTestCB.checked = true;
            isMatTest(true);
        }
        else {
            mainData.cpuWarnMsg.classList.add('hidden');
            if (mainData.AppState.showGpuFallbackMsg) {
                mainData.gpuWarnMsg.classList.remove('hidden');
            }

            aluTestCB.parentElement.classList.remove('hidden');
            aluTestCB.checked = true;
            isMatTest(!mainData.AppState.showGpuFallbackMsg);
        }
        updatePreciOption();
    });

    const isCPU = mainData.AppState.currentProcessor === "CPU";
    if (isCPU) {
        aluTestCB.parentElement.classList.add('hidden');
        matTestCB.checked = true;
        isMatTest(true);
    }
    else {
        aluTestCB.parentElement.classList.remove('hidden');
        isMatTest(!mainData.AppState.showGpuFallbackMsg);
    }
}