# [WebBenchmark](https://suryanshRoy.github.io/WebBenchmark) 🔥

- ***WebBenchmark** is a opensource project that allows you to find out the access provided by your device to it's browser and shows how modern device handles the websites*.


> [!NOTE]
> This project is under early stage developement!

<img width="1470" height="956" alt="Screenshot 2026-08-31 at 10 04 36 PM" src="https://github.com/user-attachments/assets/cf767f17-fab4-400a-8ca6-ba6c92f682c6" />

## Hardware support
- Currently GPU features are available using ```webgpu```. For older device it also supports ```webgl2``` and ```webgl```.

- CPU features are available using ```wasm```.
    
> [!TIP]
> - For best performance try using ```chrome```, ```safari``` or ```microsoft edge```

## Current features
- *Currently these options are available in benchmark settings that you can test to benchmark your device performance*
  
> [!Note]
> CPU and GPU have different options and some of the  options may be available on one device that is not available in other due to stability purposes.

1. **Matrix FLOPS Test**: Runs up a series of matrix operations to stress the device performance and provides result in GFLOPS.

2. **ALU Compute Test**: Arithmetic logic unit runs up mathematical operations and provides the result in GFLOPS.

3. **Thermal Throttling Test**: Runs complex matrix operations at its peak for a longer time to show up decrease in device performance due to thermal throttling.

5. **Memory Bandwidth**: Measure memory bandwidth of device like **read**, **write** and **copy** speed.

> [!Tip]
> **For developers Advance settings option is provided so they can experiment with benchmark performance and even crash their device if wanted 😎**


## Usage

- Currently to build and use WebBenchmark **locally** you must have [```emsdk```](https://emscripten.org/docs/getting_started/downloads.html) and [```nodejs```](https://nodejs.org/en/download). Then follow these steps to use it locally!

1. *Clone the repo*:
    ```bash
    git clone https://github.com/suryanshRoy/WebBenchmark.git
    ```
2. *Get in the WebBenchmark directory*:
    ```bash
    cd WebBenchmark
    ```
3. Install npm modules:
    ```bash
    npm install
    ```
4. Build the c++ files to wasm:
    ```bash
    npm run build:wasm
    ```
5. Run the main build:
    ```bash
    npm run build
    ```
6. Start the WebBenchmark!
    ```bash
    npm run dev
    ```

## AI Usage
> I used AI in this project as helping tool! AI helped in initial setup of emsdk and very starting UI/UX but main purpose of AI was to help me fixing up the magic words issues, WASM build errors, WebGL and WebGPU optimisation across different devices!

## License
> [!Warning]
> This project is under [MIT LICENSE](https://github.com/suryanshRoy/WebBenchmark/blob/main/LICENSE) so the developer is not responsible for any kind of damage recieved to your device.
