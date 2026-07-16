const DEFAULT_MAT_SIZE = 512;
const FLOP_PER_ITERATION = 2 * Math.pow(DEFAULT_MAT_SIZE, 3);

let engModule = null;
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
    engModule = Module;
    engModule._init_memory(DEFAULT_MAT_SIZE);
    
    postMessage({type: 'READY'});
}).catch((error) => {
    console.error("FATAL ENGINE ERROR:", error);
});

function runBenchmarkLoop(iterations, precisionType = 0) {
    if (!isEngineRunning || !engModule) return;

    const startTime = performance.now();
    
    engModule._run_stress_test(iterations, precisionType);

    const endTime = performance.now();
    const timeTakenSeconds = (endTime-startTime) / 1000;
    const totalFlops = FLOP_PER_ITERATION*iterations;
    const gflops = (totalFlops / timeTakenSeconds) / 1e9;

    postMessage({
        type: 'UPDATE',
        gflops: gflops.toFixed(2)
    });

    if (isEngineRunning) {
        setTimeout(() => runBenchmarkLoop(iterations, precisionType), 0);
    }
}

self.onmessage = function(event) {
    if(event.data.type === 'START') {
        isEngineRunning = true;
        // Reset mem to default
        engModule._init_memory(DEFAULT_MAT_SIZE);

        let preciType = 0;
        if (event.data.precision === "f64-scalar"){
            preciType = 1;
        }
        else if (event.data.precision === 'f4-vec-f32') {
            preciType = 2;
        }
        else if (event.data.precision === "f2-vec-f64") {
            preciType = 3;
        }
        runBenchmarkLoop(event.data.iterations, preciType);
    }
    else if (event.data.type === "START_2") {
        if (!engModule) return;

        const matrixSize = event.data.matrix;
        const iterations = event.data.iterations;
        const precision = event.data.precision;
        let pType = 0;
        if (precision === "f64-scalar") pType = 1;
        else if (precision === 'f4-vec-f32'){
            pType = 2;
        }
        else if (precision === "f2-vec-f64") {
            pType = 3;
        }

        engModule._init_memory(matrixSize); // reallocate c++ mem

        const startTime = performance.now();
        engModule._run_stress_test(iterations, pType);
        const end_time = performance.now();

        const timeTakenSec = (end_time - startTime) /1000;
        const totalFlops = (2 * Math.pow(matrixSize, 3)) * iterations;
        const gflops = (totalFlops / timeTakenSec) / 1e9;
// j matrix
        this.postMessage({
            type: 'RUN2_COMPLETE',
            gflops: gflops.toFixed(2),
            timeTakenSec: timeTakenSec
        });
    }
    else if (event.data.type === 'STOP'){
        isEngineRunning = false;
    }

    if (event.data.type === 'Start_mem_band'){
        const arraySizeMB = parseFloat(event.data.sizeMB) || 128;
        const runType = event.data.runType || 0;
        const gbps = engModule._memBandTest(arraySizeMB, runType);

        self.postMessage({
            type: 'memResult', result: gbps, runType: runType
        });
    }
};