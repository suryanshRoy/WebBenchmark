const TILE_SIZE: u32 = 16u;

@group(0) @binding(0) var<storage, read> matrixA : array<f32>;
@group(0) @binding(1) var<storage, read> matrixB : array<f32>;
@group(0) @binding(2) var<storage, read_write> matrixC : array<f32>;

struct Uniforms {
    size : u32,
};
@group(0) @binding(3) var<uniform> uniforms : Uniforms;

var<workgroup> tileA : array<f32, 256>;
var<workgroup> tileB : array<f32, 256>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>,
        @builtin(local_invocation_id) local_id : vec3<u32>) 
{
    let row = global_id.y;
    let col = global_id.x;
    let local_row = local_id.y;
    let local_col = local_id.x;
    let size = uniforms.size;

    var sum: f32 = 0.0;
    let numTiles = size / TILE_SIZE;

    for (var t =0u; t < numTiles; t = t + 1u) {
        let tileIndex = local_row * TILE_SIZE + local_col;
        tileA[tileIndex] = matrixA[row * size + (t * TILE_SIZE + local_col)];
        tileB[tileIndex] = matrixB[(t * TILE_SIZE + local_row) * size + col];

        workgroupBarrier();

        for (var k = 0u; k < TILE_SIZE; k = k + 1u) {
            sum = sum + tileA[local_row * TILE_SIZE + k] * tileB[k * TILE_SIZE + local_col];
        }

        workgroupBarrier();
    }

    if (row < size && col < size) {
        matrixC[row * size + col] = matrixC[row * size + col] + sum;
    }
}