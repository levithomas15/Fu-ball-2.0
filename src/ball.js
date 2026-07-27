import * as THREE from 'three';

export const BALL_R = 0.112; // echter Fußball: 22 cm Durchmesser

/**
 * Erzeugt Farb-, Bump- und Rauheitskarte eines klassischen Fußballs.
 * Trick: Das Wabenmuster (Ikosaederstumpf) ist exakt das Voronoi-Diagramm
 * der 12 Ikosaeder-Ecken (Fünfecke) + 20 Flächenmitten (Sechsecke) auf der Kugel.
 */
function makeBallTextures() {
  const W = 1024, H = 512;

  // 12 Ecken + 20 Flächenmitten des Ikosaeders
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [];
  for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
    V.push([0, s1 * 1, s2 * t], [s1 * 1, s2 * t, 0], [s2 * t, 0, s1 * 1]);
  }
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const pent = V.map(norm);

  // Flächenmitten: je 3 Ecken, deren paarweiser Abstand minimal ist
  const hex = [];
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  let minD = Infinity;
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) minD = Math.min(minD, d2(pent[i], pent[j]));
  const eps = minD * 1.15;
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++)
        if (d2(pent[i], pent[j]) < eps && d2(pent[j], pent[k]) < eps && d2(pent[i], pent[k]) < eps)
          hex.push(norm([
            pent[i][0] + pent[j][0] + pent[k][0],
            pent[i][1] + pent[j][1] + pent[k][1],
            pent[i][2] + pent[j][2] + pent[k][2],
          ]));

  const centers = [...pent.map((p) => ({ p, pentagon: true })), ...hex.map((p) => ({ p, pentagon: false }))];

  const colorCv = document.createElement('canvas'); colorCv.width = W; colorCv.height = H;
  const bumpCv = document.createElement('canvas'); bumpCv.width = W; bumpCv.height = H;
  const roughCv = document.createElement('canvas'); roughCv.width = W; roughCv.height = H;
  const cImg = colorCv.getContext('2d').createImageData(W, H);
  const bImg = bumpCv.getContext('2d').createImageData(W, H);
  const rImg = roughCv.getContext('2d').createImageData(W, H);

  // Pseudo-Rauschen für Lederstruktur
  const noise = (x, y, z) => {
    const s = Math.sin(x * 91.7 + y * 47.3 + z * 73.1) * 43758.5453;
    return s - Math.floor(s);
  };

  for (let y = 0; y < H; y++) {
    const phi = (y + 0.5) / H * Math.PI;          // 0..PI
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let x = 0; x < W; x++) {
      const theta = (x + 0.5) / W * Math.PI * 2;   // 0..2PI
      const dx = sp * Math.cos(theta), dy = cp, dz = sp * Math.sin(theta);

      let best = -2, second = -2, isPent = false;
      for (let i = 0; i < centers.length; i++) {
        const c = centers[i].p;
        const d = dx * c[0] + dy * c[1] + dz * c[2];
        if (d > best) { second = best; best = d; isPent = centers[i].pentagon; }
        else if (d > second) second = d;
      }

      // Nähe zur Zellgrenze -> Naht
      const edge = best - second;                       // 0 an der Kante
      const seam = 1 - Math.min(1, edge / 0.055);        // 1 = Naht
      const stitch = Math.max(0, 1 - Math.abs(edge - 0.075) / 0.022); // Ziernaht

      const grain = noise(Math.floor(dx * 260), Math.floor(dy * 260), Math.floor(dz * 260));
      const dirt = 0.94 + noise(Math.floor(dx * 22), Math.floor(dy * 22), Math.floor(dz * 22)) * 0.09;

      // Grundfarbe der Zelle
      let r, g, b;
      if (isPent) { r = 26; g = 27; b = 32; }          // fast schwarze Fünfecke
      else { r = 244; g = 245; b = 242; }              // weiße Sechsecke

      // Naht dunkel eingeprägt
      const s = Math.pow(seam, 1.6);
      r = r * (1 - s) + 12 * s;
      g = g * (1 - s) + 12 * s;
      b = b * (1 - s) + 14 * s;

      // Ziernähte etwas heller als die Naht selbst
      r += stitch * (isPent ? 55 : -22);
      g += stitch * (isPent ? 55 : -22);
      b += stitch * (isPent ? 52 : -22);

      // Lederkorn + leichte Gebrauchsspuren
      const gn = (grain - 0.5) * 16;
      r = Math.max(0, Math.min(255, (r + gn) * dirt));
      g = Math.max(0, Math.min(255, (g + gn) * dirt));
      b = Math.max(0, Math.min(255, (b + gn) * dirt));

      const i4 = (y * W + x) * 4;
      cImg.data[i4] = r; cImg.data[i4 + 1] = g; cImg.data[i4 + 2] = b; cImg.data[i4 + 3] = 255;

      // Bump: Nähte tief, Panele leicht gewölbt, Korn fein
      const bump = 255 * (1 - s * 0.95) * (0.9 + grain * 0.1) - stitch * 30;
      bImg.data[i4] = bImg.data[i4 + 1] = bImg.data[i4 + 2] = Math.max(0, Math.min(255, bump));
      bImg.data[i4 + 3] = 255;

      // Rauheit: Nähte matt, Panele glatter
      const rough = 60 + s * 150 + grain * 30;
      rImg.data[i4] = rImg.data[i4 + 1] = rImg.data[i4 + 2] = Math.min(255, rough);
      rImg.data[i4 + 3] = 255;
    }
  }
  colorCv.getContext('2d').putImageData(cImg, 0, 0);
  bumpCv.getContext('2d').putImageData(bImg, 0, 0);
  roughCv.getContext('2d').putImageData(rImg, 0, 0);

  const mk = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  };
  return { map: mk(colorCv, true), bumpMap: mk(bumpCv), roughnessMap: mk(roughCv) };
}

export class Ball {
  constructor(scene) {
    const tex = makeBallTextures();
    const geo = new THREE.SphereGeometry(BALL_R, 96, 64);
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex.map,
      bumpMap: tex.bumpMap,
      bumpScale: 4,
      roughnessMap: tex.roughnessMap,
      roughness: 1,
      metalness: 0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.7,
      sheen: 0.25,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(0xffffff),
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    // Weicher Kontaktschatten – macht die Ballhöhe lesbar
    const shTex = (() => {
      const S = 128, c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.85)');
      gr.addColorStop(0.45, 'rgba(0,0,0,0.35)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      return new THREE.CanvasTexture(c);
    })();
    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.7 })
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.012;
    this.blob.renderOrder = 1;
    scene.add(this.blob);

    this.pos = new THREE.Vector3(0, 2.2, 0);
    this.vel = new THREE.Vector3();
    this.angVel = new THREE.Vector3();
    this.radius = BALL_R;
    this.cooldown = 0;
    this.apex = 0;
    this._q = new THREE.Quaternion();
    this._axis = new THREE.Vector3();
  }

  reset(x = 0.35, y = 2.6) {
    this.pos.set(x, y, 0);
    this.vel.set((Math.random() - 0.5) * 0.5, 0, 0);
    this.angVel.set(0, 0, (Math.random() - 0.5) * 3);
    this.cooldown = 0;
    this.apex = y;
    this.mesh.quaternion.identity();
  }

  /** Physik-Schritt mit fester Zeitscheibe. */
  step(dt, gravity) {
    this.vel.y -= gravity * dt;

    // Magnus-Effekt (Spin lenkt den Ball) + Luftwiderstand
    const magnus = 0.011;
    this.vel.x += (this.angVel.z * this.vel.y - this.angVel.y * this.vel.z) * magnus * dt;
    this.vel.y -= (this.angVel.z * this.vel.x - this.angVel.x * this.vel.z) * magnus * dt;
    this.vel.multiplyScalar(1 - 0.16 * dt);
    this.angVel.multiplyScalar(1 - 0.35 * dt);

    // Ball bleibt in der Spielebene: kräftige Rückstellung plus harte Grenze,
    // damit er nie aus der Reichweite des Fußes wandert.
    this.vel.z += (0 - this.pos.z) * 26 * dt;
    this.vel.z *= 1 - Math.min(1, 7 * dt);
    if (this.pos.z > 0.22) { this.pos.z = 0.22; this.vel.z = Math.min(this.vel.z, 0); }
    else if (this.pos.z < -0.22) { this.pos.z = -0.22; this.vel.z = Math.max(this.vel.z, 0); }

    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y > this.apex) this.apex = this.pos.y;
    if (this.cooldown > 0) this.cooldown -= dt;

    // Rotation aus der Winkelgeschwindigkeit
    const w = this.angVel.length();
    if (w > 1e-4) {
      this._axis.copy(this.angVel).multiplyScalar(1 / w);
      this._q.setFromAxisAngle(this._axis, w * dt);
      this.mesh.quaternion.premultiply(this._q);
    }
  }

  /** Sichtbare Objekte an den Physikzustand angleichen. */
  sync() {
    this.mesh.position.copy(this.pos);
    const h = Math.max(0, this.pos.y - this.radius);
    const sc = THREE.MathUtils.clamp(0.55 + h * 0.34, 0.5, 2.4);
    this.blob.position.set(this.pos.x, 0.012, this.pos.z);
    this.blob.scale.setScalar(sc);
    this.blob.material.opacity = THREE.MathUtils.clamp(0.62 - h * 0.09, 0.08, 0.62);
  }

  get speed() { return this.vel.length(); }
}
