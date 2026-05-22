import matrixMultiplyWGSL from './compute.wgsl?raw'

export async function runWebGPUStage(device, matrixSize, iterations, isRunningFn) {
    const totalElements = matrixSize * matrixSize;
    const byteSize = totalElements * 4; // 4 bytes for f32

    const bufferA = device.createBuffer({size: byteSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
    const bufferB = device.createBuffer({size: byteSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
    const bufferC = device.createBuffer({size: byteSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC});
    
    const uniformBuffer = device.createBuffer({size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});

    const dataA = new Float32Array(totalElements).fill(1.0);
    const dataB = new Float32Array(totalElements).fill(2.0);
    const uniformData = new Uint32Array([matrixSize]);

    device.queue.writeBuffer(bufferA, 0, dataA);
    device.queue.writeBuffer(bufferB, 0, dataB);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const shaderMode = device.createShaderModule({code: matrixMultiplyWGSL});

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

    if (isRunningFn && !isRunningFn()) {
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
        
        // OPEN PASS ONCE
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