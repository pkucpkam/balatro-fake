import { useEffect, useRef } from "react";

/**
 * Full-screen WebGL "spilled paint" swirl: domain-warped noise, posterised
 * and pixelated. `intensity` speeds it up during scoring; `hue` tints it
 * (boss blinds shift the palette).
 */
const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uIntensity;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
void main(){
  float px = 3.0;
  vec2 frag = floor(gl_FragCoord.xy / px) * px;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;
  float t = uTime * (0.04 + 0.12 * uIntensity);
  float r = length(uv);
  float ang = atan(uv.y, uv.x) + 1.6 * r - t * 2.0;
  vec2 p = vec2(cos(ang), sin(ang)) * r * 2.2;
  vec2 q = vec2(fbm(p + t), fbm(p - t + 4.0));
  float f = fbm(p + 2.5 * q + vec2(t * 0.7, -t * 0.4));
  float bands = floor(f * 6.0) / 6.0;
  vec3 col = mix(uA, uB, smoothstep(0.25, 0.7, bands));
  col = mix(col, uC, smoothstep(0.62, 0.9, f) * 0.55);
  col *= 1.0 - 0.55 * r * r;
  gl_FragColor = vec4(col, 1.0);
}`;

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export interface ShaderPalette {
  a: string;
  b: string;
  c: string;
}

export function ShaderBackground({ palette, intensity }: { palette: ShaderPalette; intensity: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ palette, intensity, current: { a: hexToRgb(palette.a), b: hexToRgb(palette.b), c: hexToRgb(palette.c) }, i: 0 });
  live.current.palette = palette;
  live.current.intensity = intensity;

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl", { antialias: false, alpha: false });
    if (!canvas || !gl) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u("uRes"), uTime = u("uTime"), uI = u("uIntensity"), uA = u("uA"), uB = u("uB"), uC = u("uC");

    const resize = () => {
      const scale = 0.5; // render at half res; it is pixelated anyway
      canvas.width = Math.floor(window.innerWidth * scale);
      canvas.height = Math.floor(window.innerHeight * scale);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let time = 37;
    let last = performance.now();
    const lerp3 = (from: number[], to: number[], k: number) => from.map((v, i) => v + ((to[i] ?? v) - v) * k) as [number, number, number];
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const L = live.current;
      L.i += (L.intensity - L.i) * Math.min(1, dt * 3);
      time += reduced ? 0 : dt * (1 + L.i * 3);
      const k = Math.min(1, dt * 2);
      L.current = {
        a: lerp3(L.current.a, hexToRgb(L.palette.a), k),
        b: lerp3(L.current.b, hexToRgb(L.palette.b), k),
        c: lerp3(L.current.c, hexToRgb(L.palette.c), k),
      };
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uI, L.i);
      gl.uniform3fv(uA, L.current.a);
      gl.uniform3fv(uB, L.current.b);
      gl.uniform3fv(uC, L.current.c);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="shader-bg" aria-hidden />;
}
