import matrixMultiplyWGSL from './compute.wgsl?raw';
import aluWGSL from './ALU_compute.wgsl?raw';

export async function runWebGPU(device, matrixSize, iterations, precision, isRunning) {
    const totalElements = matrixSize * matrixSize;
    const isF16 = precision.includes('f16')
    const byteSize = totalElements * (isF16?  2:4); 

    const bufferA = device.createBuffer({size: byteSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
    const bufferB = device.createBuffer({size: byteSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
    const bufferC = device.createBuffer({size: byteSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC});
    
    const uniformBuffer = device.createBuffer({size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});

    let dataA, dataB;
    if (isF16){
        dataA = new Uint16Array(totalElements).fill(0x3C00);
        dataB = new Uint16Array(totalElements).fill(0x4000);
    }
    else {
        dataA = new Float32Array(totalElements).fill(1.0);
        dataB = new Float32Array(totalElements).fill(2.0);
    }

    const uniformData = new Uint32Array([matrixSize]);

    device.queue.writeBuffer(bufferA, 0, dataA);
    device.queue.writeBuffer(bufferB, 0, dataB);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    let shaderCode = matrixMultiplyWGSL;
    if (isF16) {
        shaderCode = 'enable f16;\n' + shaderCode.replaceAll("f32", "f16");
    }

    const shaderMode = device.createShaderModule({code: shaderCode});

    const computePipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: shaderMode,
            entryPoint: 'main',
        },
    });

    const bindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            {binding: 0, resource: {buffer: bufferA}},
            {binding: 1, resource: {buffer: bufferB}},
            {binding: 2, resource: {buffer: bufferC}},
            {binding: 3, resource: {buffer: uniformBuffer}},
        ],
    });

    const workgroupCount = Math.ceil(matrixSize / 16);
    const startTime = performance.now();
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);

    passEncoder.dispatchWorkgroups(workgroupCount, workgroupCount);
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
    await device.queue.onSubmittedWorkDone(); 
    const calibTimeMs = performance.now() - startTime;

    if (isRunning && !isRunning()) {  // see decleration in the main js
        bufferA.destroy();
        bufferB.destroy();
        bufferC.destroy();
        uniformBuffer.destroy();
        return {gflops: 0, timeTakenSec: calibTimeMs / 1000};
    }

    const userAgent = navigator.userAgent.toLowerCase();
    const isWindows = userAgent.includes("windows");
    const hasWatchdog = isWindows;

    let completedIters = 1;
    let remainingIters = iterations - 1;

    // scaling based on the calibration pass
    if (calibTimeMs < 400) remainingIters = iterations - 1;
    else if (calibTimeMs < 500) remainingIters = Math.min(iterations - 1, 39);
    else if (calibTimeMs < 700) remainingIters = Math.min(iterations - 1, 19);
    else remainingIters = Math.min(iterations - 1, 9);

    if (hasWatchdog) {
        const projectTotalTime = calibTimeMs * iterations;
        if (projectTotalTime > 1500) {
            const maxsafeIters = Math.floor(1500 / calibTimeMs);
            remainingIters = Math.max(0, maxsafeIters - 1);
        }
    }

    if (remainingIters > 0) {
        const mainEncoder = device.createCommandEncoder();
        
        // open the pass once only
        const mainPass = mainEncoder.beginComputePass();
        mainPass.setPipeline(computePipeline);
        mainPass.setBindGroup(0, bindGroup);

        // DISPATCH ALL ITERATIONS
        for (let i = 0; i < remainingIters; i++) {
            mainPass.dispatchWorkgroups(workgroupCount, workgroupCount);
        }

        // CLOSE PASS ONCE
        mainPass.end(); 
        device.queue.submit([mainEncoder.finish()]); 

        await device.queue.onSubmittedWorkDone();
        completedIters += remainingIters;
    }

    const endTime = performance.now();

    // Clear VRAM
    bufferA.destroy();
    bufferB.destroy();
    bufferC.destroy();
    uniformBuffer.destroy();

    const timeTakenSec = (endTime - startTime) / 1000;
    if (completedIters === 0){
        return {gflops: 0, timeTakenSec: timeTakenSec}; 
    }
    const operationsPerIteration = 2 * Math.pow(matrixSize, 3);
    const totalFlops = operationsPerIteration * completedIters;
    const gflops = (totalFlops / timeTakenSec) / 1e9;

    return {gflops: gflops, timeTakenSec: timeTakenSec};
}

export async function GPU_ALU(device, isRunning, onUpdate){
    const shaderModule = device.createShaderModule({code: aluWGSL});

    const computePipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute:{
            module:shaderModule,
            entryPoint: 'main',
        },
    });

    // FIXME: Currently static only for normal system! Need to be dynamically adjust itself!
    const threadsCount = 262144; //std thread
    const bufferSize= threadsCount*4;
    
    const inputBuf = device.createBuffer({size: bufferSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST}); // simultaneously
    const outputBuf = device.createBuffer({size: bufferSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC});

    const inputData = new Float32Array(threadsCount);
    for (let i = 0; i < threadsCount; i++) {
        // Random values to ensure the GPU doesn't skip calculations
        inputData[i] = Math.random() * 0.5 + 0.1;
    }
    device.queue.writeBuffer(inputBuf, 0, inputData);

    const bindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0, resource: {buffer:inputBuf}
            },
            {
                binding: 1, resource: {buffer: outputBuf}
            }
        ],
    });
    
    const countWorkGroup = Math.ceil(threadsCount / 256);
    const durationMs = 10000; 
    const flopsPerDispatch = 32 * 2000 * threadsCount;
    // Start with 5 dispatches, auto-calibrate
    let dispatchPerRun = 5; // ai helped calibration fix

    return new Promise((resolve) => {
        const startTime = performance.now();
        let currentGflops = 0;

        async function runFrame() {
            if ((isRunning && !isRunning()) || (performance.now() - startTime >= durationMs)){
                inputBuf.destroy();
                outputBuf.destroy();
                resolve(currentGflops);
                return;
            }
            
            const startFrame = performance.now();
            const encoder = device.createCommandEncoder();
            const pass = encoder.beginComputePass();
            pass.setPipeline(computePipeline);
            pass.setBindGroup(0, bindGroup);

            for (let i = 0; i< dispatchPerRun; i++){
                pass.dispatchWorkgroups(countWorkGroup);
            }
            pass.end();

            device.queue.submit([encoder.finish()]);
            await device.queue.onSubmittedWorkDone();

            const endFrame = performance.now();
            const timeTaken = (endFrame - startFrame) / 1000;
            const totalFlops = flopsPerDispatch * dispatchPerRun;
            const gflops = (totalFlops / timeTaken) / 1e9;
            const timeSpent = endFrame - startFrame;
            currentGflops = gflops;

            if (onUpdate) {
                onUpdate(gflops);
            }
            if (timeSpent > 0){
                const ratio = 100 / timeTaken;
                let nextDispatch = Math.round(dispatchPerRun * ratio);
                dispatchPerRun = Math.max(1, Math.min(60, nextDispatch));
            }
            requestAnimationFrame(runFrame);
        }

        requestAnimationFrame(runFrame);
    });
}