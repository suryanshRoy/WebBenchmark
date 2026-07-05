import matrixMultiplyWGSL from './compute.wgsl?raw';
import aluWGSL from './ALU_compute.wgsl?raw';

export async function runWebGPU(device, matrixSize, iterations, precision, isRunning, onUpdate) {
    const totalElements = matrixSize * matrixSize;
    const isF16 = precision.includes('f16')
    const byteSize = totalElements * (isF16 ? 2 : 4); 

    const bufferA = device.createBuffer({size: byteSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
    const bufferB = device.createBuffer({size: byteSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
    const bufferC = device.createBuffer({size: byteSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC});
    
    const uniformBuffer = device.createBuffer({size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
    const readBuffer = device.createBuffer({size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST});

    let dataA, dataB;
    if (isF16){
        dataA = new Uint16Array(totalElements);
        dataB = new Uint16Array(totalElements);
        const f16Val = [0x3800, 0x3C00, 0x4000, 0x4200, 0x4400];
        for (let i = 0; i<totalElements; i++){
            dataA[i]= f16Val[Math.floor(Math.random() * f16Val.length)]; // randomize mat to ensure that gpu doesn't try to be oversmart
            dataB[i]= f16Val[Math.floor(Math.random() * f16Val.length)];
        }
    }
    else {
        dataA = new Float32Array(totalElements);
        dataB = new Float32Array(totalElements);
        for (let i=0; i<totalElements; i++){
            dataA[i] = Math.random() * 0.5 + 0.1;
            dataB[i] = Math.random() * 0.5 + 0.1;
        }
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

    commandEncoder.copyBufferToBuffer(bufferC, 0, readBuffer, 0, 4);
    device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    readBuffer.unmap();

    const calibTimeMs = performance.now() - startTime;

    if (isRunning && !isRunning()) {  // see decleration in the main js
        bufferA.destroy();
        bufferB.destroy();
        bufferC.destroy();
        uniformBuffer.destroy();
        return {gflops: 0, timeTakenSec: calibTimeMs / 1000};
    }

    let completedIters = 1;
    let remainingIters = iterations - 1;

    let ItersChunk = Math.max(1, Math.floor(1500 / calibTimeMs));
    const operationsPerIteration = 2 * Math.pow(matrixSize, 3);

    if (onUpdate) {
        return new Promise((resolve) => {
            const currentStartTime = performance.now();
            
            async function runFrame() {
                if (isRunning && !isRunning()){ // maybe the 5 min is fine for actual throttle
                    bufferA.destroy();
                    bufferB.destroy();
                    bufferC.destroy();
                    uniformBuffer.destroy();
                    readBuffer.destroy();
                    resolve({gflops: 0, timeTakenSec: 0});
                    return;
                }

                const startTime = performance.now();
                const mainEncoder = device.createCommandEncoder();
                for (let i = 0; i < ItersChunk; i++) {
                    const mainPass = mainEncoder.beginComputePass();
                    mainPass.setPipeline(computePipeline);
                    mainPass.setBindGroup(0, bindGroup); 
                    mainPass.dispatchWorkgroups(workgroupCount, workgroupCount);
                    mainPass.end();

                    mainEncoder.copyBufferToBuffer(bufferC, 0, bufferA, 0, byteSize);
                }
                mainEncoder.copyBufferToBuffer(bufferC, 0, readBuffer, 0, 4);
                device.queue.submit([mainEncoder.finish()]);

                try {
                    await readBuffer.mapAsync(GPUMapMode.READ);
                    readBuffer.unmap();
                    } catch (error) {
                        if (error.name === "AbortError") {
                            resolve({gflops: 0, timeTakenSec: 0});
                            return;
                        } else {
                            throw error;
                        }
                }

                const endTime = performance.now();
                const timeTakenSec = (endTime - startTime) / 1000;
                const totalFlops = operationsPerIteration * ItersChunk;
                const gflops = (totalFlops / timeTakenSec) / 1e9;

                onUpdate(gflops);
                
                setTimeout(runFrame, 10);
            }
            
            runFrame();
        });
    }

    if (remainingIters > 0) {
        let itersLeft= remainingIters;

        while (itersLeft > 0) {
            if (isRunning && !isRunning()) break;

            let chunk = Math.min(itersLeft, ItersChunk);
            const mainEncoder = device.createCommandEncoder();
        for (let i=0; i<chunk; i++){
            const mainPass = mainEncoder.beginComputePass();
            mainPass.setPipeline(computePipeline);
            mainPass.setBindGroup(0, bindGroup);
            mainPass.dispatchWorkgroups(workgroupCount, workgroupCount);
            mainPass.end();

            mainEncoder.copyBufferToBuffer(bufferC, 0, bufferA, 0, byteSize);
        }
        mainEncoder.copyBufferToBuffer(bufferC, 0, readBuffer, 0, 4);
        device.queue.submit([mainEncoder.finish()]);

        try {
            await readBuffer.mapAsync(GPUMapMode.READ);
            readBuffer.unmap();
        }
         catch (error) {
            if (error.name === "AbortError") {
                break;
            } else {
                throw error;
            }
        }

        itersLeft = itersLeft - chunk;
        completedIters += chunk;
    }
}

    const endTime = performance.now();

    // Clear VRAM
    bufferA.destroy();
    bufferB.destroy();
    bufferC.destroy();
    uniformBuffer.destroy();
    readBuffer.destroy();

    const timeTakenSec = (endTime - startTime) / 1000;
    if (completedIters === 0){
        return {gflops: 0, timeTakenSec: timeTakenSec}; 
    }
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

    const calibThreads = 65536;
    const calibBufSize = calibThreads * 4;
    const calibInput = device.createBuffer({size: calibBufSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
    const calibOutput = device.createBuffer({size: calibBufSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC});

    const calibData = new Float32Array(calibThreads);
    for (let i = 0; i < calibThreads; i++) {
        calibData[i] = Math.random() * 0.5 + 0.1;
    }
    device.queue.writeBuffer(calibInput, 0, calibData);

    const calibBindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0, resource: {buffer: calibInput}
            },
            {
                binding: 1, resource: {buffer: calibOutput}
            }
        ]
    });

    const calibStTime = performance.now();
    const calibEncoder = device.createCommandEncoder();
    const calibPass = calibEncoder.beginComputePass();
    calibPass.setPipeline(computePipeline);
    calibPass.setBindGroup(0, calibBindGroup);
    
    for (let i = 0; i < 5; i++) {
        calibPass.dispatchWorkgroups(Math.ceil(calibThreads / 256));
    }
    calibPass.end();
    device.queue.submit([calibEncoder.finish()]);
    
    await device.queue.onSubmittedWorkDone();
    const calibTime = performance.now() - calibStTime;

    calibInput.destroy();
    calibOutput.destroy();

    let threadsCount;
    // NOTE That the buf size is defined at line 284 maybe by line const bufferSize = threadsCount * 4; so better not to confuse
    if (calibTime <= 5){
        threadsCount = 65536 * 32; // 8mb buf
    }
    else if (calibTime <= 9){
        threadsCount = 65536 * 16; // 4mb buf
    }
    else if (calibTime <= 21){
        threadsCount = 65536 * 8; // 2mb buf
    }
    else if (calibTime <= 70){
        threadsCount = 65536 * 4; // 1mb buf
    }
    else if (calibTime <= 120){
        threadsCount = 65536 * 2; // 512kb buf
    }
    else {
        threadsCount = 65536; // 256kb buf
    }

    const bufferSize = threadsCount * 4;
    
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
    let dispatchPerRun = 5;

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
            const timeSpent = endFrame - startFrame;
            const timeTaken = timeSpent / 1000;
            const totalFlops = flopsPerDispatch * dispatchPerRun;
            const gflops = (totalFlops / timeTaken) / 1e9;
            currentGflops = gflops;

            if (onUpdate) {
                onUpdate(gflops);
            }
            if (timeSpent > 0){
                const ratio = 100 / timeSpent;
                let nextDispatch = Math.round(dispatchPerRun * ratio);
                dispatchPerRun = Math.max(1, Math.min(60, nextDispatch));
            }
            requestAnimationFrame(runFrame);
        }

        requestAnimationFrame(runFrame);
    });
}