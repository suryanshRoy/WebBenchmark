@group(0) @binding(0) var<storage, read> src_buf : array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> dst_buf : array<vec4<f32>>;
@compute @workgroup_size(256) // FIXME need to add this workgroup size in set so it is adjustable

fn read_main(@builtin(global_invocation_id) id : vec3<u32>){
    let base_idx = id.x * 4u;
    if (base_idx + 3u >= arrayLength(&src_buf)) {
        return;
    }
    
    // 4x read
    let v0 = src_buf[base_idx];
    let v1 = src_buf[base_idx + 1u];
    let v2 = src_buf[base_idx + 2u];
    let v3 = src_buf[base_idx + 3u];
    
    let dep = dst_buf[0].x * 0.0;
    let magic = v0.x + v1.x + v2.x + v3.x + dep;
    if (magic == -999999.0) {
        dst_buf[0] = v0;
    }
}

@compute @workgroup_size(256) // FIXME same workgrp size issue
fn write_main(@builtin(global_invocation_id) id: vec3<u32>) {
    let base_idx = id.x * 4u;
    if (base_idx + 3u >= arrayLength(&dst_buf)) {
        return;
    }
    let dep = src_buf[0].x * 0.0;
    let f_val = vec4<f32>(f32(id.x) + dep, 1.0, 2.0, 3.0);
    
    // 4x write
    dst_buf[base_idx] = f_val;
    dst_buf[base_idx + 1u] = f_val;
    dst_buf[base_idx + 2u] = f_val;
    dst_buf[base_idx + 3u] = f_val;
}