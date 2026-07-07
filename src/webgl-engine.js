export async function WebGL_ALU(isRunning, onUpdate) {
    const canvas = document.createElement('canvas');
    canvas.width = 2; 
    canvas.height = 2;
    
    let gl = canvas.getContext('webgl2');
    let isWebGL2 = true;

    if (!gl) {
        gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        isWebGL2 = false;
        console.warn("WebGL2 isn't supported on this device.")
    }

    if (!gl) {
        console.error("Neither WebGL2 nor WebGL is supported on this device");
        return 0; 
    }

    let vertexShaderSource, fragmentShaderSource;
    try {
        const shaderModule = isWebGL2 
            ? await import('./webgl2-shader.js') 
            : await import('./webgl-shader.js');
            
        vertexShaderSource = shaderModule.vertexShaderSource;
        fragmentShaderSource = shaderModule.fragmentShaderSource;
    } catch (error) {
        console.error("Failed to load shader modules:", error);
        return 0;
    }

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Error linking program:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
        -1, -1,
         1, -1,
        -1,  1,
         1,  1,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const durationMs = 10000; // 10 seconds
    const flopsPerIteration = 2;
    const flopsPerDraw = 50000 * flopsPerIteration; //chunked iters of 50k
    const calibrationTargetMs = 1200;
    const maxChunkDraws = 4096;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function drawBatch(drawCount) {
        gl.useProgram(program);
        for (let i = 0; i < drawCount; i++) {
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        const pixels = new Uint8Array(4);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    }

    return new Promise((resolve) => {
        let startTime = performance.now();
        let currentGflops = 0;
        let completedDraws = 0;
        let chunkDraws = 1;

        function calibrateChunkSize() {
            let probeDraws = 1;
            let probeMs = 0;

            while (probeDraws <= maxChunkDraws) {
                const probeStart = performance.now();
                drawBatch(probeDraws);
                probeMs = performance.now() - probeStart;

                if (probeMs >= calibrationTargetMs) {
                    break;
                }
                probeDraws *= 2;
            }
            const perDrawMs = Math.max(probeMs / probeDraws, 0.001);
            return clamp(Math.round(calibrationTargetMs / perDrawMs), 1, maxChunkDraws);
        }

        chunkDraws = calibrateChunkSize();
        startTime = performance.now();
    
        function render() {
            if ((isRunning && !isRunning()) || (performance.now() - startTime >= durationMs))  {
                gl.getExtension('WEBGL_lose_context')?.loseContext();
                resolve(currentGflops);
                return;
            }

            const frameStart = performance.now();
            drawBatch(chunkDraws);

            const frameEnd = performance.now();
            const timeTaken = (frameEnd - frameStart) / 1000; // in seconds
            completedDraws += chunkDraws;

            const timeSpentSec = (frameEnd - startTime) / 1000;
            if (timeSpentSec > 0) {
                const totalFlops = flopsPerDraw * completedDraws;
                currentGflops = (totalFlops / timeSpentSec) / 1e9; // Convert to GFLOPS

                if (onUpdate) {
                    onUpdate(currentGflops);
                }
            }

            if (timeTaken > (calibrationTargetMs / 1000)) {
                chunkDraws = Math.max(1, Math.floor(chunkDraws * 0.75));
            } else if (timeTaken < (calibrationTargetMs / 1000) * 0.5) {
                chunkDraws = Math.min(maxChunkDraws, Math.max(chunkDraws + 1, Math.round(chunkDraws * 1.25)));
            }

            requestAnimationFrame(render);
        }

        render();
    });
}