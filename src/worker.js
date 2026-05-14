const MATRIX_SIZE = 512;
const FLOP_PER_ITERATION = 2 * Math.pow(MATRIX_SIZE, 3);

let wasmModule = null;
let isEngineRunning = false;

importScripts('../engine.js');

createEngine({
    locateFile: function(path, prefix) {
        if (path.endsWith('.wasm')) {
            const workerPath = self.location.pathname;
            const assetsIndex = workerPath.lastIndexOf('assets/');
            
            if (assetsIndex !== -1) {
                const rootPath = workerPath.substring(0, assetsIndex);
                return self.location.origin + rootPath + path;
            } else {
                // Local Development fallback
                return '../' + path;
            }
        }
        return prefix + path; // Fallback for any other files
    }
}).then((Module) => {
    wasmModule = Module;
    wasmModule._init_memory(MATRIX_SIZE);
    
    postMessage({type: 'READY'});
});

function runBenchmarkLoop(iterations) {
    if (!isEngineRunning || !wasmModule) return;

    const startTime = performance.now();
    
    wasmModule._run_stress_test(iterations);

    const endTime = performance.now();
    const timeTakenSeconds = (endTime-startTime) / 1000;
    const totalFlops = FLOP_PER_ITERATION*iterations;
    const gflops = (totalFlops / timeTakenSeconds) / 1e9;

    postMessage({
        type: 'UPDATE',
        gflops: gflops.toFixed(2)
    });

    if (isEngineRunning) {
        setTimeout(() => runBenchmarkLoop(iterations), 0);
    }
}

self.onmessage = function(event) {
    if(event.data.type === 'START') {
        isEngineRunning = true;
        runBenchmarkLoop(event.data.iterations);
    }
    else if (event.data.type === 'STOP'){
        isEngineRunning = false;
    }
};