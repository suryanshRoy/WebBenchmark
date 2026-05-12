#include <cstdlib>

extern "C" {
    // Pointers for arrays
    float* A = nullptr;
    float* B = nullptr;
    float* C =nullptr;

    // Store the curent size
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
        for (int iter = 0; iter <iterations; iter++){
            for (int i = 0; i < CURRENT_SIZE; i++) {
                for (int j = 0; j < CURRENT_SIZE; j++) {
                    float sum = 0.0f;
                    for (int k = 0; k<CURRENT_SIZE; k++){
                        sum += A[i*CURRENT_SIZE + k] * B[k*CURRENT_SIZE + j];
                    }
                    C[i * CURRENT_SIZE + j] = sum;
                }
            }
        }
        
        return C[0];
    }
}