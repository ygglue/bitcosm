import { describe, it, expect } from 'vitest';
import { GlRenderer } from '../../src/render/glRenderer';
import { createCamera } from '../../src/engine/camera';

// Minimal WebGL stand-in that records the calls we assert on. Every GL enum is
// an arbitrary unique number; the renderer only compares enums by identity.
function makeFakeGl() {
  const calls: { fn: string; args: unknown[] }[] = [];
  let e = 1;
  const E = (): number => e++;
  const rec = (fn: string) => (...args: unknown[]) => { calls.push({ fn, args }); };
  const recRet = (fn: string, ret: unknown) => (...args: unknown[]) => { calls.push({ fn, args }); return ret; };
  const gl: any = {
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
    VERTEX_SHADER: E(), FRAGMENT_SHADER: E(), COMPILE_STATUS: E(), LINK_STATUS: E(),
    ARRAY_BUFFER: E(), STATIC_DRAW: E(), DYNAMIC_DRAW: E(), FLOAT: E(),
    TEXTURE_2D: E(), TEXTURE_MIN_FILTER: E(), TEXTURE_MAG_FILTER: E(),
    TEXTURE_WRAP_S: E(), TEXTURE_WRAP_T: E(), NEAREST: E(), CLAMP_TO_EDGE: E(),
    RGBA: E(), UNSIGNED_BYTE: E(), TEXTURE0: E(), COLOR_BUFFER_BIT: E(), TRIANGLE_STRIP: E(),
    createShader: recRet('createShader', {}),
    shaderSource: rec('shaderSource'),
    compileShader: rec('compileShader'),
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    createProgram: recRet('createProgram', {}),
    attachShader: rec('attachShader'),
    linkProgram: rec('linkProgram'),
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    useProgram: rec('useProgram'),
    createBuffer: recRet('createBuffer', {}),
    bindBuffer: rec('bindBuffer'),
    bufferData: rec('bufferData'),
    bufferSubData: rec('bufferSubData'),
    getAttribLocation: () => 0,
    enableVertexAttribArray: rec('enableVertexAttribArray'),
    vertexAttribPointer: rec('vertexAttribPointer'),
    createTexture: recRet('createTexture', {}),
    activeTexture: rec('activeTexture'),
    bindTexture: rec('bindTexture'),
    texParameteri: rec('texParameteri'),
    texImage2D: rec('texImage2D'),
    texSubImage2D: rec('texSubImage2D'),
    getUniformLocation: recRet('getUniformLocation', {}),
    uniform1i: rec('uniform1i'),
    viewport: rec('viewport'),
    clearColor: rec('clearColor'),
    clear: rec('clear'),
    drawArrays: rec('drawArrays'),
  };
  return { gl, calls };
}

describe('GlRenderer', () => {
  it('configures the world texture with NEAREST filtering for crisp cells', () => {
    const { gl, calls } = makeFakeGl();
    new GlRenderer(gl, 16, 16);
    const nearest = calls.filter(
      (c) => c.fn === 'texParameteri'
        && (c.args[1] === gl.TEXTURE_MIN_FILTER || c.args[1] === gl.TEXTURE_MAG_FILTER)
        && c.args[2] === gl.NEAREST,
    );
    expect(nearest.length).toBe(2); // both MIN and MAG set to NEAREST
  });

  it('uploads the color buffer and draws a 4-vertex strip on render', () => {
    const { gl, calls } = makeFakeGl();
    const r = new GlRenderer(gl, 16, 16);
    const buf = new Uint8Array(16 * 16 * 4);
    r.render(buf, createCamera(8, 8, 10));
    const upload = calls.find((c) => c.fn === 'texSubImage2D');
    expect(upload).toBeTruthy();
    expect(upload!.args[8]).toBe(buf); // pixels argument of texSubImage2D
    const draw = calls.find((c) => c.fn === 'drawArrays');
    expect(draw!.args).toEqual([gl.TRIANGLE_STRIP, 0, 4]);
  });
});
