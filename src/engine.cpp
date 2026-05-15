#include <cstdlib>
#include <thread>
#include <vector>
#include <algorithm>

extern "C" {
    // Pointers for arrays
    float* A = nullptr;
    float* B = nullptr;
    float* C =nullptr;

    // Store the initial curent size
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

        // feed matrices with dummy data
        for (int i=0; i<total_elements; i++) {
            A[i] = 1.0f;
            B[i] = 2.0f;
            C[i] = 0.0f;
        }
    }

    float run_stress_test(int iterations) {
        // Available CPU cores detection:
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

                for (int i = start_row; i < end_row; i++) {
                    for (int k = 0; k<CURRENT_SIZE; k++){
                        float a_ik = A[i * CURRENT_SIZE + k];
                        for (int j = 0; j < CURRENT_SIZE; j++) {
                            C[i * CURRENT_SIZE + j] += a_ik * B[k * CURRENT_SIZE + j];
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
}