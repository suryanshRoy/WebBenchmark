// just change the file from .js to .glsl to get glsl syntax highlighting but NOTE that it uses export!

export const vertexShaderSource = `
precision highp float;
attribute vec4 a_position;

void main() {
  gl_Position = a_position;
}`;

export const fragmentShaderSource = `
precision highp float;

void main() {
  float result = 0.5;
  for (int i = 0; i < 50000; i++) {
    result += sin(result) * cos(result) + tan(result);
  }
  gl_FragColor = vec4(result, result, result, 1.0);
}`;