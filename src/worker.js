const MATRIX_SIZE = 512;
const FLOP_PER_ITERATION = 2 * Math.pow(MATRIX_SIZE, 3);

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
    engineInstance._init_memory(MATRIX_SIZE);
    
    postMessage({type: 'READY'});
}).catch((error) => {
    console.error("FATAL ENGINE ERROR:", error);
});

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
        runBenchmarkLoop(event.data.iterations);
    }
    else if (event.data.type === 'STOP'){
        isEngineRunning = false;
    }
};