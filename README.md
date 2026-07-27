# [WebBenchmark](https://suryanshRoy.github.io/WebBenchmark) 🔥

- **A Benchmarking tool that can provide you detailed result about access and performance of your device across Websites and browsers.**


>[!NOTE]
>This WebBenchmark is for experimental purpose and results and UI/UX can differ depending on the browser and device! Results are not 100% accurate but WebBenchmark tries the best to give real world performance! And it is in early development process!


## Current Benchmarking overview
- Currently WebBenchmark contains these performance tests that you can try on your device across different processors!
1. **Matrix Multiplication benchmarking**: *This test may hang the device a little bit due to computation of Matrix multiplication that is memory and computation bounded test.*
2. **ALU benchmarking:** *Measures up results(in FLOPS) close to advertised results of device by computing ALU(Arithmetic Logic Unit) operations!* 
3. **Thermal throttling test:** *Calculates the real time performance drop of the device by running a heavy load on the device for 5 minutes(adjustable)*
4. **Memory bandwidth test:** *Measures memory bandwidth of the device and calculates READ, WRITE and COPY speed. It measures these speed for ```L1, L2, L3 caches, DRAM and RAM```.*

## Hardware support
- A CPU test is supported so benchmarking could be done on every kind of devices! For high accuracy it uses ```WASM```
- GPU test is supported using ```WebGPU``` for modern device. ```WebGL``` & ```WebGL2``` is also supported for older device. If a device doesn't support any of these they will get a GPU aborted message, cause the device is highly unstable for any run to happen!

## Local setup
- In order to run this WebBenchmark locally you can go through these steps!

1. Clone the repo
    ```bash
    git clone https://github.com/suryanshRoy/WebBenchmark.git
    ```
2. Compile the c++ to wasm (Make sure you have proper compiler like [emsdk](https://github.com/emscripten-core/emsdk))
    ```bash
    npm run build:wasm
    ```
3. Run the build
   ```bash
   npm run build
   ```
4. Start local running
    ```bash
    npm run dev
    ```

## Benchmark settings 
- You can fully customise the run using the Benchmark settings! 

> [!NOTE]
> If a device is failing to run the Benchmark test or getting very bad results, then it points either two of the issues. 
> 1. The browser or device may have very high security that is interfering with the run.
>   - Fix: try running it on Chrome browser or may try to enable the WebGPU extension if WebGPU is failing.
> 2. The device is already running some high computational background task, that may be taking some of the resources that is required by the WebBenchmark to run correctly. 
>   - Fix: Please stop the high computational background tasks that maybe interferring with the required resources for this benchmarking and use recommended browsers like chrome, microsoft edge, or safari.
---


# MIT LICENSE
> [!WARNING]
> This project is under MIT license so we are not responsible for any damage or issues caused to your device! **Please use it at your own risk!**
