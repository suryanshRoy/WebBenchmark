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