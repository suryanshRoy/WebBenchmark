export const vertexShaderSource = `
precision highp float;
attribute vec4 a_position;

void main() {
  gl_Position = a_position;
}`;

export const fragmentShaderSource = `
precision highp float;

uniform float num;

const int iter = 50000;

void main() {
  float result = num + (gl_FragCoord.x * 0.00001);
  float mul = 1.000001 + (gl_FragCoord.y * 0.0000001);
  float add = 0.000001;

  for (int i = 0; i < iter; i++) {
    result = result * mul + add;
  }

  result = fract(result);
  gl_FragColor = vec4(result, 1.0 - result, result * 0.5, 1.0);
}`;
