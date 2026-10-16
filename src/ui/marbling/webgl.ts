import { coverView, type Operation } from "./operations";
import { FEATHER_CSS_PX, type Renderer } from "./renderer";

// Two RGBA texels per operation, one row each: (kind, x, y, tone) and
// (radius or shift, ux, uy, falloff). Kind 0 is a drop, 1 a tine.
export const pack = (ops: ReadonlyArray<Operation>): Float32Array => {
  const data = new Float32Array(Math.max(ops.length, 1) * 8);
  ops.forEach((op, k) => {
    data.set(
      op.kind === "drop"
        ? [0, op.x, op.y, op.tone, op.radius, 0, 0, 0]
        : [1, op.x, op.y, 0, op.shift, op.ux, op.uy, op.falloff],
      k * 8,
    );
  });
  return data;
};

const VERTEX = `#version 300 es
in vec2 corner;
void main() {
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

// `shadeAt` in renderer.ts, per sample, step for step: the walk `toneAt` in
// operations.ts takes, carrying its Jacobian J = dq/dp (a column-major mat2,
// so each operation's derivative D updates it as D * J), with each drop's
// edge faded over `feather` canvas pixels into what lay just outside it.
// Change all three together.
// A still frame (`fine` 1) averages sixteen samples on a 4 × 4 grid over a
// square 1.5 pixels across, as renderer.ts's `paint` does with four, so an
// edge is smooth. A frame of a settle (`fine` 0) takes four on a rotated
// grid inside the pixel, cheap enough to draw every frame.
const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D ops;
uniform int count;
uniform int fine;
uniform float feather;
uniform vec2 size;
uniform vec3 view;
uniform vec3 tones[6];
out vec4 colour;

vec3 shadeAt(vec2 q) {
  mat2 J = mat2(view.z);
  vec3 shade = vec3(0.0);
  float through = 1.0;
  for (int k = count - 1; k >= 0; k--) {
    if (through <= 1.0 / 512.0) break;
    vec4 a = texelFetch(ops, ivec2(0, k), 0);
    vec4 b = texelFetch(ops, ivec2(1, k), 0);
    vec2 c = a.yz;
    if (a.x < 0.5) {
      float r2 = b.x * b.x;
      if (r2 == 0.0) continue;
      vec2 d = q - c;
      float m2 = dot(d, d);
      if (m2 <= r2) {
        float m = sqrt(m2);
        float rate = m > 0.0 ? length(transpose(J) * d) / m : 0.0;
        float depth = rate > 0.0 ? (b.x - m) / (rate * feather) : 1.0;
        float cover = depth < 1.0 ? depth * depth * (3.0 - 2.0 * depth) : 1.0;
        shade += through * cover * tones[int(a.w + 0.5)];
        through *= 1.0 - cover;
        q = c;
        J = mat2(0.0);
        continue;
      }
      float back = sqrt(1.0 - r2 / m2);
      J = (mat2(back) + r2 / (back * m2 * m2) * outerProduct(d, d)) * J;
      q = c + d * back;
    } else {
      vec2 u = b.yz;
      vec2 n = vec2(-u.y, u.x);
      float t = dot(q - c, n);
      float reach = abs(t) + b.w;
      J = (mat2(1.0) + b.x * b.w / (reach * reach) * sign(t) * outerProduct(u, n)) * J;
      q -= u * (b.x * b.w / reach);
    }
  }
  return shade + through * tones[0];
}

vec3 sampleAt(vec2 pixel) {
  return shadeAt(view.xy + pixel * view.z);
}

void main() {
  vec2 pixel = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  if (fine == 1) {
    vec3 grid = vec3(0.0);
    for (int j = 0; j < 4; j++) {
      for (int i = 0; i < 4; i++) {
        grid += sampleAt(pixel + ((vec2(i, j) + 0.5) / 4.0 - 0.5) * 1.5);
      }
    }
    colour = vec4(grid / 16.0, 1.0);
    return;
  }
  vec3 sum = sampleAt(pixel + vec2(-0.125, -0.375))
    + sampleAt(pixel + vec2(0.375, -0.125))
    + sampleAt(pixel + vec2(0.125, 0.375))
    + sampleAt(pixel + vec2(-0.375, 0.125));
  colour = vec4(sum * 0.25, 1.0);
}`;

const compile = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (shader === null) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn(
    "The basin's shader did not compile",
    gl.getShaderInfoLog(shader),
  );
  gl.deleteShader(shader);
  return null;
};

const link = (gl: WebGL2RenderingContext): WebGLProgram | null => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (vertex === null || fragment === null || program === null) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  console.warn(
    "The basin's program did not link",
    gl.getProgramInfoLog(program),
  );
  gl.deleteProgram(program);
  return null;
};

// The GPU path: one full-canvas quad, and a fragment shader that walks every
// sample back through the operations, read from a float texture.
export const webglRenderer = (canvas: HTMLCanvasElement): Renderer | null => {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (gl === null) return null;
  const program = link(gl);
  if (program === null) return null;

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const corner = gl.getAttribLocation(program, "corner");
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const at = {
    ops: uniform("ops"),
    count: uniform("count"),
    fine: uniform("fine"),
    feather: uniform("feather"),
    size: uniform("size"),
    view: uniform("view"),
    tones: uniform("tones"),
  };

  return {
    lost: () => gl.isContextLost(),
    draw: (ops, tones, frame = {}) => {
      gl.useProgram(program);
      const { width, height } = canvas;
      if (width === 0 || height === 0) return;
      gl.viewport(0, 0, width, height);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        2,
        Math.max(ops.length, 1),
        0,
        gl.RGBA,
        gl.FLOAT,
        pack(ops),
      );
      const view = coverView(width, height);
      gl.uniform1i(at.ops, 0);
      gl.uniform1i(at.count, ops.length);
      gl.uniform1i(at.fine, frame.fine === true ? 1 : 0);
      gl.uniform1f(at.feather, frame.feather ?? FEATHER_CSS_PX);
      gl.uniform2f(at.size, width, height);
      gl.uniform3f(at.view, view.originX, view.originY, view.scale);
      gl.uniform3fv(
        at.tones,
        tones.flatMap(([r, g, b]) => [r / 255, g / 255, b / 255]),
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose: () => {
      gl.deleteTexture(texture);
      gl.deleteBuffer(corners);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
};
