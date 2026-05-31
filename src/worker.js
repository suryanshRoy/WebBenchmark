const DEFAULT_MAT_SIZE = 512;
const FLOP_PER_ITERATION = 2 * Math.pow(DEFAULT_MAT_SIZE, 3);

let engineInstance = null;
let isEngineRunning = false;

let basePath = '/';
if (self.location.pathname.includes('/WebBenchmark/')) {
    basePath = '/WebBenchmark/';
}

importScripts(basePath + 'engine.js');

createEngine({
    mainScriptUrlOrBlob: basePath + 'engine.js', 
    locateFile: function(path) {
        return basePath + path;
    }
}).then((Module) => {
    console.log("ENGINE LOADED!");
    engineInstance = Module;
    engineInstance._init_memory(DEFAULT_MAT_SIZE);
    
    postMessage({type: 'READY'});
}).catch((error) => {
    console.error("FATAL ENGINE ERROR:", error);
});

// Infinite loop for CPU thermal throttling 
function runBenchmarkLoop(iterations) {
    if (!isEngineRunning || !engineInstance) return;

    const startTime = performance.now();
    
    engineInstance._run_stress_test(iterations);

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
        // Reset mem to default
        engineInstance._init_memory(DEFAULT_MAT_SIZE);
        runBenchmarkLoop(event.data.iterations);
    }
    else if (event.data.type === "START_2") {
        if (!engineInstance) return;

        const matrixSize = event.data.matrix;
        const iterations = event.data.iterations;
        const precision = event.data.precision;

        engineInstance._init_memory(matrixSize); // reallocate c++ mem

        const startTime = performance.now();
        engineInstance._run_stress_test(iterations);
        const end_time = performance.now();

        const timeTakenSec = (end_time - startTime) /1000;
        const totalFlops = (2 * Math.pow(matrixSize, 3)) * iterations;
        const gflops = (totalFlops / timeTakenSec) / 1e9;

        this.postMessage({
            type: 'RUN2_COMPLETE',
            gflops: gflops.toFixed(2),
            timeTakenSec: timeTakenSec
        });
    }
    else if (event.data.type === 'STOP'){
        isEngineRunning = false;
    }
};