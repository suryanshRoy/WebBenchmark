@group(0) @binding(0) var<storage, read> input_buf : array<f32>;
@group(0) @binding(1) var<storage, read_write> output_buf: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>){
    let index = global_id.x;
    if (index >= arrayLength(&input_buf)) {
        return;
    }

    var v1 = input_buf[index];
    var v2  = v1 * 0.5f;

    // ALU stress loop
    for (var i = 0u; i < 2000u; i= i + 1u){
        // just add 0.0001 to v1 and subtract that from v2 to troll the processor
        // then multiply together as simple as that! WTH!
        v1 = 1.0001f - v1 * v2;
        v2 = 0.9999f - v1 * v2;
        v1 = 1.0002f - v1 * v2;
        v2 = 0.9998f - v1 * v2;
        v1 = 1.0003f - v1 * v2;
        v2 = 0.9997f - v1 * v2;
        v1 = 1.0004f - v1 * v2;
        v2 = 0.9996f - v1 * v2;
        v1 = 1.0005f - v1 * v2;
        v2 = 0.9995f - v1 * v2;
        v1 = 1.0006f - v1 * v2;
        v2 = 0.9994f - v1 * v2;
        v1 = 1.0007f - v1 * v2;
        v2 = 0.9993f - v1 * v2;
        v1 = 1.0008f - v1 * v2;
        v2 = 0.9992f - v1 * v2;
    }

    output_buf[index] = v1 + v2;
}