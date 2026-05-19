import matrixMultiplyWGSL from './compute.wgsl?raw'

export async function runWebGPUStage(device, matrixSize, iterations) {
    const totalElements = matrixSize * matrixSize;
    const byteSize = totalElements * 4;

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

    for (let i = 0; i<iterations; i++){
        passEncoder.dispatchWorkgroups(workgroupCount, workgroupCount);
    }

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    await device.queue.onSubmittedWorkDone();

    const endTime = performance.now();

    // Clear VRAM
    bufferA.destroy();
    bufferB.destroy();
    bufferC.destroy();
    uniformBuffer.destroy();

    const timeTakenSec = (endTime - startTime) / 1000;
    const operationsPerIteration = 2 * Math.pow(matrixSize, 3);
    const totalFlops = operationsPerIteration * iterations;
    const gflops = (totalFlops / timeTakenSec) / 1e9;

    return gflops;
}