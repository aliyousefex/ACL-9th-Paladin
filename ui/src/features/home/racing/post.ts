/**
 * The last pass over the picture, the things a camera does that a renderer does not: streaking towards the edges at speed (the centre
 * and the cockpit stay sharp), a faint colour fringe at the edges of the lens, a gentle vignette and a little film grain. Every
 * effect is small; the point is a photographic picture, not an effect.
 */
export const speedFx = {
  name: "SpeedFx",
  uniforms: {
    tDiffuse: { value: null as unknown },
    uSpeed: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSpeed;
    uniform float uTime;
    uniform float uAspect;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 d = vUv - 0.5;
      float r = length(vec2(d.x * uAspect, d.y));
      // streaks towards the edge, lighter low in the frame where the cockpit is
      float keep = smoothstep(0.1, 0.42, vUv.y);
      float k = uSpeed * 0.028 * smoothstep(0.3, 0.9, r) * mix(0.3, 1.0, keep);
      vec3 col = vec3(0.0);
      for (int i = 0; i < 6; i++) {
        float t = float(i) / 5.0;
        col += texture2D(tDiffuse, vUv - d * k * t).rgb;
      }
      col /= 6.0;
      // a colour fringe that only shows at the very edge of the lens
      float ca = 0.0085 * smoothstep(0.4, 1.05, r);
      col.r = mix(col.r, texture2D(tDiffuse, vUv - d * ca).r, 0.65);
      col.b = mix(col.b, texture2D(tDiffuse, vUv + d * ca).b, 0.65);
      // vignette and grain
      col *= 1.0 - 0.2 * smoothstep(0.5, 1.1, r * 1.08);
      col *= 1.0 + (hash(vUv * 1013.0 + fract(uTime) * 61.0) - 0.5) * 0.045;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
