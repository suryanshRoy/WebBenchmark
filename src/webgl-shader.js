export const vertexShaderSource = `
precision highp float;
attribute vec4 a_position;

void main() {
  gl_Position = a_position;
}`;

export const fragmentShaderSource = `
precision highp float;

const float mul = 1.000001;
const float add = 0.000001;
const int iter = 50000;

void main() {
  float result = 0.5;
  for (int i = 0; i < iter; i++) {
    result = result * mul + add;
  }
  gl_FragColor = vec4(result, result, result, 1.0);
}`;