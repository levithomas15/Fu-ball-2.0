import * as THREE from 'three';

const MAX = 600;

/** Partikel (Funken beim Schuss, Grasfetzen, Ball-Schweif) + Schockwellen. */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.count = MAX;
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: window.innerHeight * 0.5 } },
      vertexShader: /* glsl */`
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uScale;
        void main() {
          vColor = aColor; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = dot(d, d);
          if (r > 0.25) discard;
          float a = smoothstep(0.25, 0.0, r);
          gl_FragColor = vec4(vColor, a * vAlpha);
        }`,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
    this.mat = mat;

    // Schockwellen-Ringe
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.42, 0.5, 48);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffe6a0, transparent: true, opacity: 0, side: THREE.DoubleSide,
          depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, life: 0, maxLife: 0.5 });
    }
    this.ringCursor = 0;
    this._c = new THREE.Color();
  }

  _spawn(x, y, z, vx, vy, vz, color, size, life, gravity = 9) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this._c.set(color);
    this.col[i3] = this._c.r; this.col[i3 + 1] = this._c.g; this.col[i3 + 2] = this._c.b;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = gravity;
    this.alpha[i] = 1;
  }

  /** Trefferfunken am Fuß. */
  burst(p, n, strength = 1) {
    const num = Math.round(14 + 16 * strength);
    for (let i = 0; i < num; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI;
      const sp = (1.6 + Math.random() * 4.5) * strength;
      this._spawn(
        p.x, p.y, p.z,
        n.x * sp * 0.7 + Math.sin(b) * Math.cos(a) * sp * 0.8,
        n.y * sp * 0.7 + Math.cos(b) * sp * 0.8 + 1.2,
        n.z * sp * 0.7 + Math.sin(b) * Math.sin(a) * sp * 0.5,
        Math.random() < 0.65 ? 0xffd451 : 0xfff4d0,
        0.012 + Math.random() * 0.02,
        0.28 + Math.random() * 0.35,
        7
      );
    }
    // ein paar Grashalme, wenn nah am Boden
    if (p.y < 0.6) {
      for (let i = 0; i < 8; i++) {
        this._spawn(
          p.x, 0.03, p.z,
          (Math.random() - 0.5) * 2.4, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 2,
          0x64c04a, 0.01 + Math.random() * 0.012, 0.5 + Math.random() * 0.4, 11
        );
      }
    }
  }

  /** Kurzer Schweif hinter dem schnellen Ball. */
  trail(p, speed) {
    this._spawn(
      p.x + (Math.random() - 0.5) * 0.04,
      p.y + (Math.random() - 0.5) * 0.04,
      p.z + (Math.random() - 0.5) * 0.04,
      0, 0, 0,
      0xbfe4ff, 0.02 + speed * 0.001, 0.22, 0
    );
  }

  /** Staubwolke beim Aufprall auf den Rasen. */
  ground(p) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      this._spawn(
        p.x, 0.04, p.z,
        Math.cos(a) * sp, Math.random() * 2.2, Math.sin(a) * sp,
        Math.random() < 0.5 ? 0x6ab04c : 0xa08b6a,
        0.014 + Math.random() * 0.02, 0.5 + Math.random() * 0.5, 8
      );
    }
  }

  ring(p, normal, color = 0xffe6a0) {
    const r = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % this.rings.length;
    r.mesh.position.copy(p);
    r.mesh.lookAt(p.clone().add(normal));
    r.mesh.scale.setScalar(0.35);
    r.mesh.material.color.set(color);
    r.mesh.visible = true;
    r.life = r.maxLife;
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const i3 = i * 3;
      this.vel[i3 + 1] -= this.grav[i] * dt;
      this.vel[i3] *= 1 - 1.6 * dt;
      this.vel[i3 + 2] *= 1 - 1.6 * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.01) { this.pos[i3 + 1] = 0.01; this.vel[i3 + 1] *= -0.25; }
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = t * t;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;

    for (const r of this.rings) {
      if (r.life <= 0) { if (r.mesh.visible) r.mesh.visible = false; continue; }
      r.life -= dt;
      const t = 1 - r.life / r.maxLife;
      r.mesh.scale.setScalar(0.35 + t * 2.6);
      r.mesh.material.opacity = Math.max(0, (1 - t) * 0.75);
      if (r.life <= 0) r.mesh.visible = false;
    }
  }

  resize() { this.mat.uniforms.uScale.value = window.innerHeight * 0.5; }
}
