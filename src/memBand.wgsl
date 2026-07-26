@group(0) @binding(0) var<storage, read> src_buf : array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> dst_buf : array<vec4<f32>>;
@compute @workgroup_size(256) // FIXME need to add this workgroup size in set so it is adjustable

fn read_main(@builtin(global_invocation_id) id : vec3<u32>){
    if (id.x >= arrayLength(&src_buf)) {
        return;
    }
    if (src_buf[id.x].x < -999999.0) {
        dst_buf[0] = src_buf[id.x];
    }
}

@compute @workgroup_size(256) // FIXME same workgrp size issue
fn write_main(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= arrayLength(&dst_buf)) {
        return;
    }
    dst_buf[id.x] = vec4<f32>(1.0, 2.0, 3.0, 4.0);
}