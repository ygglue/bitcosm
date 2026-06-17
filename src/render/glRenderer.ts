import type { Camera } from '../engine/camera';
import { worldQuadClip } from './quad';

const VERT_SRC = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision mediump float;
uniform sampler2D u_tex;
varying vec2 v_uv;
void main() {
  gl_FragColor = texture2D(u_tex, v_uv);
}
`;

// UVs matching worldQuadClip's strip order TL,TR,BL,BR. The color buffer's row 0
// (cell y=0) is uploaded first, sampled at v=0, which we place at the top (TL),
// so the world draws top-down like the M0 Canvas2D viewer.
const UVS = new Float32Array([
  0, 0, // TL
  1, 0, // TR
  0, 1, // BL
  1, 1, // BR
]);

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('createShader returned null');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader compile failed: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

export class GlRenderer {
  private gl: WebGLRenderingContext;
  private worldW: number;
  private worldH: number;
  private posBuf: WebGLBuffer;
  private posLoc: number;

  constructor(gl: WebGLRenderingContext, worldW: number, worldH: number) {
    this.gl = gl;
    this.worldW = worldW;
    this.worldH = worldH;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    const prog = gl.createProgram();
    if (!prog) throw new Error('createProgram returned null');
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('program link failed: ' + gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    // Static UV attribute.
    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, UVS, gl.STATIC_DRAW);
    const uvLoc = gl.getAttribLocation(prog, 'a_uv');
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

    // Dynamic position attribute, refilled from the camera every frame.
    const posBuf = gl.createBuffer();
    if (!posBuf) throw new Error('createBuffer returned null');
    this.posBuf = posBuf;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(8), gl.DYNAMIC_DRAW);
    this.posLoc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(this.posLoc);
    gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, 0, 0);

    // One texel per cell. NEAREST + CLAMP_TO_EDGE keeps cells crisp and is
    // NPOT-safe for arbitrary world sizes.
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, worldW, worldH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
  }

  render(colorBuf: Uint8Array, cam: Camera): void {
    const gl = this.gl;
    const vw = gl.drawingBufferWidth;
    const vh = gl.drawingBufferHeight;

    // Upload the freshly filled color buffer into the world texture.
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.worldW, this.worldH, gl.RGBA, gl.UNSIGNED_BYTE, colorBuf);

    // Move the quad to follow the current camera.
    const quad = worldQuadClip(cam, this.worldW, this.worldH, vw, vh);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, quad);
    gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, vw, vh);
    gl.clearColor(0.04, 0.06, 0.05, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
