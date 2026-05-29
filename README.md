# WebBenchmark 🚀

- **It's just a Benchmark that runs on Webpage to give detailed output of access provided by your device to Websites and browsers.**

## Features 
1.  Currently it has the **FLOPS test that is measured twice!** 
    <br>
    *First test may hang the device a little bit due to computation of Matrix multiplication.*
    <br>
    *Second test measures up the synthetic GFLOPS that may be much closer value to the one advertised by companies who make your device!*

## Hardware support
- A CPU test is supported so that everyone can run the Benchmark
- GPU test is supported using WebGPU for modern device. WebGL is also supported for older device. If a device doesn't support any of these they will get a GPU aborted message, cause the device is highly unstable for any run to happen!

> [!NOTE]
> If a device is failing to run the Benchmark test or getting very bad output, then it points either two of the issue. 
> 1. The browser or device may have very high security that is interfering with the run. 
   > Fix: try running it on Chrome browser or may try to enable the WebGPU extension if WebGPU is failing.
> 2. The device is already running some high computational background task, that may be taking some of the resources that is required by the WebBenchmark to run correctly.  