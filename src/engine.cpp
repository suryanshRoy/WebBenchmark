#include <cstdlib>
#include <thread>
#include <vector>
#include <algorithm>
#include <wasm_simd128.h>
#include <chrono>
#include <cstring>

extern "C" {
    // Pointers for arrays
    float* A = nullptr;
    float* B = nullptr;
    float* C =nullptr;

    // store the initial curent size
    int CURRENT_SIZE = 0;

    void init_memory(int matrix_size) {
        if (A != nullptr) {
            free(A);
            free(B);
            free(C);
        }

        CURRENT_SIZE = matrix_size;
        int total_elements = CURRENT_SIZE * CURRENT_SIZE;

        A = (float*)malloc(total_elements * sizeof(float));
        B = (float*)malloc(total_elements * sizeof(float));
        C = (float*)malloc(total_elements * sizeof(float));

        // fill matrices with dummy data to make it calculate up the mat mul
        for (int i=0; i<total_elements; i++) {
            A[i] = 1.0f;
            B[i] = 2.0f;
            C[i] = 0.0f;
        }
    }

    float run_stress_test(int iterations, int precision_type) {
        // find no. of cpu cores
        unsigned int num_threads = std::thread::hardware_concurrency();
        if (num_threads == 0) num_threads = 4; 

        // No. of matrix rows each thread gets
        int rows_per_thread = CURRENT_SIZE / num_threads;
        std::vector<std::thread> workers;

        auto worker_task = [&](int start_row, int end_row) {
            for (int iter = 0; iter <iterations; iter++){
                for (int i = start_row; i < end_row; i++) {
                    for (int j = 0; j < CURRENT_SIZE; j++) {
                        C[i * CURRENT_SIZE + j] = 0.0f;
                    }
                }
                // Float4 32bit (simd 128-bit)
                if (precision_type == 2) {
                    
                    for (int i = start_row; i < end_row; i++){
                        for (int k = 0; k < CURRENT_SIZE; k++) {
                            v128_t a_ik = wasm_f32x4_splat(A[i * CURRENT_SIZE + k]);
                            for (int j = 0; j < CURRENT_SIZE; j +=4) {
                                v128_t b_vec = wasm_v128_load(&B[k * CURRENT_SIZE + j]);
                                v128_t c_vec = wasm_v128_load(&C[i * CURRENT_SIZE + j]);

                                v128_t prod = wasm_f32x4_mul(a_ik, b_vec);
                                c_vec = wasm_f32x4_add(c_vec, prod);

                                wasm_v128_store(&C[i * CURRENT_SIZE + j], c_vec);
                            }
                        }
                    }
                }
                // f64 scalar
                else if (precision_type == 1) {
                    for (int i = start_row; i < end_row; i++){
                        for (int k = 0; k < CURRENT_SIZE; k++){
                            double a_ik = (double)A[i * CURRENT_SIZE + k];
                            for (int j = 0; j< CURRENT_SIZE; j++){
                                double b_kj = (double)B[k*CURRENT_SIZE+ j];
                                C[i * CURRENT_SIZE + j] += (float)(a_ik * b_kj);
                            }
                        }
                    }
                }

                // F64*2 SIMD
                else if(precision_type == 3) {
                    for (int i = start_row; i < end_row; i++) {
                        for (int k = 0; k < CURRENT_SIZE; k++){
                            v128_t a_ik = wasm_f64x2_splat((double)A[i * CURRENT_SIZE + k]);

                            for (int j= 0; j< CURRENT_SIZE; j += 2) {
                                double b0 = (double)B[k * CURRENT_SIZE+ j];
                                double b1 = (double)B[k * CURRENT_SIZE + j + 1];
                                v128_t b_vec = wasm_f64x2_make(b0, b1);

                                double c0 = (double)C[i * CURRENT_SIZE + j];
                                double c1 = (double)C[i * CURRENT_SIZE + j + 1];
                                v128_t c_vec = wasm_f64x2_make(c0, c1);
                                v128_t prod = wasm_f64x2_mul(a_ik, b_vec);
                                c_vec = wasm_f64x2_add(c_vec, prod);

                                C[i * CURRENT_SIZE + j] = (float)wasm_f64x2_extract_lane(c_vec, 0);
                                C[i * CURRENT_SIZE + j + 1] = (float)wasm_f64x2_extract_lane(c_vec, 1);
                                
                            }
                        }
                    }
                }
                else { // f32-scalar

                    for (int i = start_row; i < end_row; i++) {
                        for (int k = 0; k<CURRENT_SIZE; k++){
                            float a_ik = A[i * CURRENT_SIZE + k];
                            for (int j = 0; j < CURRENT_SIZE; j++) {
                                C[i * CURRENT_SIZE + j] += a_ik * B[k * CURRENT_SIZE + j];
                            }
                        }
                    }
                }
            }
        };        

        // Spawn threads for each chunk of mat
        for (unsigned int t=0; t<num_threads; t++) {
            int start_row = t* rows_per_thread;
            int end_row = (t == num_threads - 1) ? CURRENT_SIZE: start_row+rows_per_thread;

            workers.push_back(std::thread(worker_task, start_row, end_row));
        }

        // wait for all cores to finish math
        for (auto& t: workers) {
            t.join();
        }

        return C[0];
    }

    float memBandTest(int array_SizeMB){

        size_t totalByte = array_SizeMB * 1024 * 1024;
        size_t numElem = totalByte / sizeof(float);

        float* srcMem = (float*)malloc(numElem*sizeof(float));
        float* dstMem = (float*)malloc(numElem * sizeof(float));

        memset(srcMem, 1, totalByte);
        memset(dstMem, 0, totalByte);

        volatile float rand_val = 0.0f;
        auto start = std::chrono::high_resolution_clock::now();

        for (int i=0; i<100; i++){ // REVIEW may need to change looop more or less depends on dev!!!
            memcpy(dstMem, srcMem, totalByte); // copy source mem to destination mem

            rand_val += dstMem[i % numElem];
        }

        auto end = std::chrono::high_resolution_clock::now();

        std::chrono::duration<float> duration = end - start;
        float sec = duration.count();

        free(srcMem);
        free(dstMem);

        size_t byteMoved = totalByte * 100 * 2;

        float GB_s = (float)byteMoved / sec / 1e9f;

        return GB_s;
    }
}