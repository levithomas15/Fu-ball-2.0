import * as THREE from 'three';

/* ---------------------------------------------------------------- *
 *  Materialien / Trikot-Textur
 * ---------------------------------------------------------------- */

const SKIN = 0xc98a5e;
const HAIR = 0x241a12;

/** Stoff des Trikots (Streifen, Kragen, Bund). */
function jerseyTexture() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const X = (u) => u * W;
  const Y = (v) => (1 - v) * H;   // v = 0 unten

  g.fillStyle = '#d02436';
  g.fillRect(0, 0, W, H);

  // Vertikale Streifen
  g.fillStyle = 'rgba(255,255,255,0.10)';
  for (let i = 0; i < 12; i++) g.fillRect(i * (W / 12), 0, W / 26, H);

  // Kragen und Schulterband
  g.fillStyle = '#14162c';
  g.fillRect(0, Y(0.99), W, H * 0.06);
  g.fillStyle = '#ffd451';
  g.fillRect(0, Y(0.93), W, H * 0.018);

  // Bund
  g.fillStyle = '#14162c';
  g.fillRect(0, Y(0.06), W, H * 0.06);

  // Feines Gewebe-Rauschen
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 11;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Aufnäher (Rückennummer bzw. Wappen) als transparente Textur.
 * Wird auf ein Zylinderstück gelegt, das sich an den Oberkörper schmiegt –
 * so sitzt die Nummer garantiert auf dem Rücken, unabhängig von Lathe-UVs.
 */
function patchTexture(draw, w = 512, h = 512) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function numberTexture(number, name) {
  return patchTexture((g, w, h) => {
    g.font = 'bold 250px "Segoe UI", Impact, sans-serif';
    g.lineWidth = 16;
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.fillStyle = '#ffffff';
    g.strokeText(number, w / 2, h * 0.56);
    g.fillText(number, w / 2, h * 0.56);
    g.font = 'bold 62px "Segoe UI", sans-serif';
    g.strokeText(name, w / 2, h * 0.20);
    g.fillText(name, w / 2, h * 0.20);
  });
}

function crestTexture() {
  return patchTexture((g, w, h) => {
    const cx = w / 2, cy = h / 2, r = w * 0.28;
    g.fillStyle = '#ffd451';
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.82, cy - r * 0.42);
    g.lineTo(cx + r * 0.82, cy + r * 0.42);
    g.lineTo(cx, cy + r * 1.05);
    g.lineTo(cx - r * 0.82, cy + r * 0.42);
    g.lineTo(cx - r * 0.82, cy - r * 0.42);
    g.closePath();
    g.fill();
    g.fillStyle = '#8c1220';
    g.font = 'bold ' + Math.round(r * 0.9) + 'px "Segoe UI", sans-serif';
    g.fillText('★', cx, cy + r * 0.08);
  }, 256, 256);
}

/** Zylinderstück, das sich an den Oberkörper schmiegt (für Aufnäher). */
function patchGeo(radius, height, thetaCenter, thetaSpan, zScale) {
  const g = new THREE.CylinderGeometry(radius, radius, height, 20, 1, true,
    thetaCenter - thetaSpan / 2, thetaSpan);
  g.scale(1, 1, zScale);
  return g;
}

/** Rotationskörper aus einem Profil [ [radius, höhe], ... ]. */
function latheGeo(profile, segments = 32, zScale = 1) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  const g = new THREE.LatheGeometry(pts, segments);
  if (zScale !== 1) g.scale(1, 1, zScale);
  g.computeVertexNormals();
  return g;
}

const mat = {
  skin: new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.72, metalness: 0, envMapIntensity: 0.5 }),
  hair: new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.88, metalness: 0 }),
  shorts: new THREE.MeshStandardMaterial({ color: 0x14162c, roughness: 0.82 }),
  sock: new THREE.MeshStandardMaterial({ color: 0xd92b3c, roughness: 0.85 }),
  sockTop: new THREE.MeshStandardMaterial({ color: 0x14162c, roughness: 0.85 }),
  boot: new THREE.MeshPhysicalMaterial({
    color: 0x101018, roughness: 0.25, metalness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.15,
  }),
  bootAccent: new THREE.MeshStandardMaterial({
    color: 0x6ff2c8, roughness: 0.35, emissive: 0x1d6a55, emissiveIntensity: 0.6,
  }),
  sole: new THREE.MeshStandardMaterial({ color: 0xe8ecf5, roughness: 0.55 }),
  eye: new THREE.MeshStandardMaterial({ color: 0xf4f6ff, roughness: 0.25 }),
  pupil: new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 0.2 }),
  mouth: new THREE.MeshStandardMaterial({ color: 0x6b2b2b, roughness: 0.6 }),
};

const _v = new THREE.Vector3();

/** Hilfsfunktion: Mesh an ein Gelenk hängen, mit Versatz/Drehung/Skalierung. */
function part(parent, geo, material, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* ---------------------------------------------------------------- *
 *  Spielerfigur mit prozeduraler Animation und Bein-IK
 * ---------------------------------------------------------------- */

export class Player {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    // Proportionen (Meter)
    this.thighLen = 0.44;
    this.shinLen = 0.42;
    this.hipY = 0.92;
    this.hipWidth = 0.115;

    this._build();
    this._contactShadow(scene);

    this.footTarget = new THREE.Vector3(0.35, 0.55, 0);
    this.footPos = new THREE.Vector3();
    this.footPrev = new THREE.Vector3(0.35, 0.55, 0);
    this.footVel = new THREE.Vector3();
    this.kickTimer = 0;
    this.kickDir = new THREE.Vector3(0, 1, 0);
    this.t = 0;
    this.rootX = 0;
    this.lean = 0;
    this.headLook = new THREE.Vector3(0, 1.6, 1);

    // Kollisionskugeln (Weltkoordinaten werden pro Frame aktualisiert)
    this.colliders = {
      foot:  { r: 0.165, center: new THREE.Vector3() },
      shin:  { r: 0.105, center: new THREE.Vector3() },
      knee:  { r: 0.115, center: new THREE.Vector3() },
      head:  { r: 0.145, center: new THREE.Vector3() },
      chest: { r: 0.21,  center: new THREE.Vector3() },
    };
  }

  _build() {
    const G = {
      sphere: new THREE.SphereGeometry(1, 24, 18),
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 20, 1, false),
      hand: new THREE.SphereGeometry(1, 16, 12),

      // Gliedmaßen als leicht konische Rotationskörper mit runden Enden
      thigh: latheGeo([
        [0.000, 0.00], [0.062, 0.005], [0.086, 0.05], [0.090, 0.14],
        [0.082, 0.26], [0.072, 0.36], [0.062, 0.42], [0.000, 0.44],
      ], 24),
      shin: latheGeo([
        [0.000, 0.00], [0.050, 0.006], [0.065, 0.05], [0.068, 0.12],
        [0.058, 0.26], [0.046, 0.36], [0.040, 0.41], [0.000, 0.42],
      ], 24),
      upperArm: latheGeo([
        [0.000, 0.00], [0.040, 0.005], [0.052, 0.04], [0.050, 0.14],
        [0.044, 0.24], [0.040, 0.27], [0.000, 0.28],
      ], 18),
      foreArm: latheGeo([
        [0.000, 0.00], [0.036, 0.005], [0.046, 0.04], [0.042, 0.14],
        [0.034, 0.22], [0.030, 0.25], [0.000, 0.26],
      ], 18),
    };
    // Gliedmaßen zeigen nach -Y (Gelenk sitzt im Ursprung)
    for (const k of ['thigh', 'shin', 'upperArm', 'foreArm']) G[k].rotateX(Math.PI);
    this.G = G;

    const jTex = jerseyTexture();
    const jerseyMat = new THREE.MeshStandardMaterial({
      map: jTex, roughness: 0.8, metalness: 0.0, envMapIntensity: 0.4,
    });
    this.jerseyMat = jerseyMat;

    /* ---- Becken / Hüfte ---- */
    const hips = new THREE.Group();
    hips.position.y = this.hipY;
    this.root.add(hips);
    this.hips = hips;

    // Shorts als Rotationskörper: schmal an der Taille, weit am Saum
    const shortsGeo = latheGeo([
      [0.000, -0.21], [0.150, -0.205], [0.198, -0.20], [0.196, -0.17],
      [0.180, -0.08], [0.170, 0.00], [0.163, 0.05], [0.150, 0.10],
    ], 28, 0.78);
    part(hips, shortsGeo, mat.shorts);

    /* ---- Oberkörper ---- */
    const torso = new THREE.Group();
    torso.position.y = 0.06;
    hips.add(torso);
    this.torso = torso;

    // Silhouette: schmale Taille, breite Brust, weiche Schultern
    const torsoGeo = latheGeo([
      [0.000, 0.00], [0.150, 0.005], [0.158, 0.04], [0.150, 0.13],
      [0.156, 0.22], [0.172, 0.31], [0.180, 0.38], [0.176, 0.44],
      [0.158, 0.49], [0.120, 0.525], [0.070, 0.545], [0.000, 0.55],
    ], 36, 0.74);
    part(torso, torsoGeo, jerseyMat);

    // Rückennummer (-Z) und Brustwappen (+Z) als aufgelegte Zylinderstücke
    const decalMat = (tex) => new THREE.MeshStandardMaterial({
      map: tex, transparent: true, roughness: 0.8, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const numberMesh = new THREE.Mesh(
      patchGeo(0.171, 0.30, Math.PI, 1.35, 0.755),
      decalMat(numberTexture('10', 'FU-BALL'))
    );
    numberMesh.position.y = 0.28;
    numberMesh.castShadow = false;
    torso.add(numberMesh);

    // Wappen auf der linken Brust, kleine Nummer auf der rechten
    const crestMesh = new THREE.Mesh(
      patchGeo(0.171, 0.085, -0.34, 0.42, 0.755),
      decalMat(crestTexture())
    );
    crestMesh.position.set(0, 0.355, 0);
    crestMesh.castShadow = false;
    torso.add(crestMesh);

    const chestNum = new THREE.Mesh(
      patchGeo(0.171, 0.085, 0.34, 0.42, 0.755),
      decalMat(patchTexture((g, w, h) => {
        g.font = 'bold 200px "Segoe UI", sans-serif';
        g.fillStyle = '#ffffff';
        g.lineWidth = 12;
        g.strokeStyle = 'rgba(0,0,0,0.45)';
        g.strokeText('10', w / 2, h / 2);
        g.fillText('10', w / 2, h / 2);
      }, 256, 256))
    );
    chestNum.position.set(0, 0.355, 0);
    chestNum.castShadow = false;
    torso.add(chestNum);

    /* ---- Kopf ---- */
    const neck = new THREE.Group();
    neck.position.y = 0.52;
    torso.add(neck);
    part(neck, G.cyl, mat.skin, { pos: [0, 0.025, -0.004], scale: [0.048, 0.09, 0.046] });

    const head = new THREE.Group();
    head.position.y = 0.075;
    neck.add(head);
    this.head = head;

    // Schädel: leicht eiförmig
    part(head, G.sphere, mat.skin, { pos: [0, 0.058, 0], scale: [0.115, 0.130, 0.119] });
    // Kiefer/Kinn
    part(head, G.sphere, mat.skin, { pos: [0, -0.026, 0.013], scale: [0.094, 0.077, 0.101] });
    // Ohren
    for (const s of [-1, 1]) {
      part(head, G.sphere, mat.skin, { pos: [s * 0.112, 0.043, -0.004], scale: [0.022, 0.035, 0.028] });
    }
    // Nase
    part(head, G.sphere, mat.skin, { pos: [0, 0.026, 0.106], scale: [0.022, 0.028, 0.032] });

    // Haare: Kappe über Oberkopf und Hinterkopf, plus Ponyfransen
    const hairCap = latheGeo([
      [0.115, 0.043], [0.118, 0.065], [0.114, 0.090],
      [0.104, 0.112], [0.084, 0.132], [0.048, 0.145], [0.000, 0.150],
    ], 28, 1.02);
    const hair = part(head, hairCap, mat.hair, { pos: [0, 0.052, -0.004] });
    hair.scale.set(1.0, 1.0, 1.04);
    // Hinterkopf: Haar reicht bis in den Nacken, vorne bleibt das Gesicht frei
    const nape = latheGeo([
      [0.086, -0.055], [0.104, -0.030], [0.115, 0.000], [0.120, 0.030], [0.000, 0.045],
    ], 24, 1.0);
    const napeMesh = part(head, nape, mat.hair, { pos: [0, 0.050, -0.030] });
    napeMesh.scale.set(0.92, 1.0, 0.72);
    // Fransen vorne
    for (let i = -2; i <= 2; i++) {
      part(head, G.sphere, mat.hair, {
        pos: [i * 0.037, 0.122 - Math.abs(i) * 0.008, 0.070 - Math.abs(i) * 0.012],
        scale: [0.027, 0.026, 0.036],
        rot: [0.35, 0, i * 0.12],
      });
    }

    // Augen
    for (const s of [-1, 1]) {
      const e = part(head, G.sphere, mat.eye, { pos: [s * 0.046, 0.048, 0.093], scale: [0.024, 0.028, 0.017] });
      part(e, G.sphere, mat.pupil, { pos: [0, -0.04, 0.6], scale: [0.5, 0.46, 0.6] });
      part(head, G.box, mat.hair, {
        pos: [s * 0.048, 0.085, 0.099], scale: [0.044, 0.011, 0.011], rot: [0, 0, s * -0.2],
      });
    }
    // Mund
    part(head, G.sphere, mat.mouth, { pos: [0, -0.024, 0.092], scale: [0.030, 0.011, 0.013] });

    /* ---- Arme ---- */
    this.arms = [];
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.152, 0.455, 0);
      torso.add(shoulder);
      // Schulterkugel + Ärmel im Trikotstoff
      part(shoulder, G.sphere, jerseyMat, { pos: [0, 0.01, 0], scale: [0.062, 0.062, 0.058] });
      const sleeve = latheGeo([
        [0.000, -0.135], [0.056, -0.13], [0.060, -0.08], [0.064, -0.02], [0.062, 0.02],
      ], 20, 0.95);
      part(shoulder, sleeve, jerseyMat);

      const upper = new THREE.Group();
      shoulder.add(upper);
      part(upper, G.upperArm, mat.skin);

      const elbow = new THREE.Group();
      elbow.position.y = -0.28;
      upper.add(elbow);
      part(elbow, G.sphere, mat.skin, { scale: [0.043, 0.043, 0.043] });

      const lower = new THREE.Group();
      elbow.add(lower);
      part(lower, G.foreArm, mat.skin);
      part(lower, G.hand, mat.skin, { pos: [0, -0.285, 0], scale: [0.042, 0.055, 0.032] });

      this.arms.push({ shoulder, upper, elbow, side: s });
    }

    /* ---- Beine ---- */
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * this.hipWidth, -0.055, 0);
      hips.add(hip);

      const thigh = new THREE.Group();
      hip.add(thigh);
      part(thigh, G.thigh, mat.skin);
      // Hosenbein folgt dem Oberschenkel
      const legHem = latheGeo([
        [0.000, -0.16], [0.104, -0.155], [0.108, -0.12], [0.104, -0.06], [0.098, 0.0],
      ], 22, 0.92);
      part(thigh, legHem, mat.shorts, { pos: [0, 0.02, 0] });

      const knee = new THREE.Group();
      knee.position.y = -this.thighLen;
      thigh.add(knee);
      part(knee, G.sphere, mat.skin, { pos: [0, 0.005, 0.004], scale: [0.063, 0.058, 0.062] });

      const shin = new THREE.Group();
      knee.add(shin);
      part(shin, G.shin, mat.skin);

      // Stutzen über den Unterschenkel
      const sockGeo = latheGeo([
        [0.000, -0.415], [0.050, -0.40], [0.056, -0.34], [0.064, -0.24],
        [0.070, -0.14], [0.068, -0.10],
      ], 22);
      part(shin, sockGeo, mat.sock);
      part(shin, G.cyl, mat.sockTop, { pos: [0, -0.115, 0], scale: [0.0715, 0.05, 0.0715] });

      const ankle = new THREE.Group();
      ankle.position.y = -this.shinLen;
      shin.add(ankle);

      /* ---- Fußballschuh ---- */
      const foot = new THREE.Group();
      ankle.add(foot);
      // Spann (zeigt nach vorne, +Z)
      const shoe = part(foot, G.sphere, mat.boot, { pos: [0, -0.026, 0.052], scale: [0.048, 0.040, 0.115] });
      // Ferse
      part(foot, G.sphere, mat.boot, { pos: [0, -0.014, -0.030], scale: [0.046, 0.048, 0.050] });
      // Sohle
      const sole = part(foot, G.sphere, mat.boot, { pos: [0, -0.052, 0.035], scale: [0.050, 0.014, 0.130] });
      sole.material = mat.sole;
      // Farbakzent auf dem Spann + Streifen
      part(foot, G.sphere, mat.bootAccent, { pos: [0.0, -0.014, 0.068], scale: [0.040, 0.014, 0.070] });
      for (const t of [-1, 1]) {
        part(foot, G.box, mat.bootAccent, {
          pos: [t * 0.040, -0.030, 0.035], scale: [0.006, 0.020, 0.100], rot: [0.08, 0, 0],
        });
      }
      // Stollen
      for (const zz of [-0.02, 0.06, 0.11]) {
        for (const xx of [-0.026, 0.026]) {
          part(foot, G.cyl, mat.sole, { pos: [xx, -0.062, zz], scale: [0.008, 0.012, 0.008] });
        }
      }

      this.legs.push({ hip, thigh, knee, shin, ankle, foot, shoe, side: s });
    }

    this.kickLeg = this.legs[1];   // rechtes Bein (s = +1) jongliert
    this.standLeg = this.legs[0];
    this.colliders = this.colliders || {};

    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  /** Weicher Kontaktschatten unter dem Spieler – verankert ihn im Rasen. */
  _contactShadow(scene) {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.62)');
    gr.addColorStop(0.5, 'rgba(0,0,0,0.26)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.7),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.85,
      })
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.02;
    this.blob.renderOrder = 1;
    scene.add(this.blob);
  }

  /* -------------------------------------------------------------- *
   *  Zwei-Knochen-IK in der Sagittalebene
   * -------------------------------------------------------------- */
  _solveLegIK(leg, targetWorld) {
    const hipWorld = new THREE.Vector3();
    leg.hip.getWorldPosition(hipWorld);

    const toTarget = new THREE.Vector3().subVectors(targetWorld, hipWorld);
    const l1 = this.thighLen, l2 = this.shinLen;
    const maxLen = (l1 + l2) * 0.995, minLen = Math.abs(l1 - l2) + 0.08;
    let dist = THREE.MathUtils.clamp(toTarget.length(), minLen, maxLen);
    if (toTarget.lengthSq() < 1e-6) toTarget.set(0, -1, 0);
    toTarget.normalize();

    // Richtung im lokalen Raum der Hüfte
    const localDir = leg.hip.worldToLocal(hipWorld.clone().addScaledVector(toTarget, 1)).normalize();

    // Ausrichtung der Kette (-Y zeigt zum Ziel)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), localDir);

    // Kniebeugung über den Kosinussatz
    const cosHip = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
    const cosKnee = (l1 * l1 + l2 * l2 - dist * dist) / (2 * l1 * l2);
    const hipBend = Math.acos(THREE.MathUtils.clamp(cosHip, -1, 1));
    const kneeBend = Math.PI - Math.acos(THREE.MathUtils.clamp(cosKnee, -1, 1));

    // Knie zeigt nach vorne (+Z) => Drehung um die lokale X-Achse
    const bendAxis = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -hipBend);
    leg.thigh.quaternion.copy(q).multiply(bendAxis);
    leg.knee.rotation.set(kneeBend, 0, 0);
    return { dist, kneeBend };
  }

  kick(dir) {
    if (this.kickTimer > 0.02) return false;
    this.kickTimer = 0.26;
    this.kickDir.copy(dir || new THREE.Vector3(0, 1, 0)).normalize();
    return true;
  }

  /** power-Multiplikator während der Schussbewegung */
  get kickPower() {
    if (this.kickTimer <= 0) return 1;
    const t = 1 - this.kickTimer / 0.26;
    return 1 + 1.05 * Math.sin(Math.PI * THREE.MathUtils.clamp(t, 0, 1));
  }

  setTarget(v) { this.footTarget.copy(v); }

  update(dt, ballPos) {
    this.t += dt;
    if (this.kickTimer > 0) this.kickTimer = Math.max(0, this.kickTimer - dt);

    /* ---- Körper folgt dem Fußziel ---- */
    const desiredRootX = THREE.MathUtils.clamp(this.footTarget.x - 0.22, -3.2, 3.2);
    const k = 1 - Math.exp(-7 * dt);
    const prevRootX = this.rootX;
    this.rootX += (desiredRootX - this.rootX) * k;
    const bodyVel = (this.rootX - prevRootX) / Math.max(dt, 1e-4);
    this.root.position.x = this.rootX;

    // Laufneigung + Gewichtsverlagerung
    const targetLean = THREE.MathUtils.clamp(bodyVel * 0.05, -0.3, 0.3);
    this.lean += (targetLean - this.lean) * (1 - Math.exp(-8 * dt));
    this.root.rotation.z = -this.lean * 0.55;

    /* ---- Fußziel inkl. Schussbewegung ---- */
    const swing = new THREE.Vector3();
    if (this.kickTimer > 0) {
      const t = 1 - this.kickTimer / 0.26;
      // Ausholen -> Durchziehen
      const curve = t < 0.3 ? -Math.sin((t / 0.3) * Math.PI) * 0.35 : Math.sin(((t - 0.3) / 0.7) * Math.PI) * 1.0;
      swing.copy(this.kickDir).multiplyScalar(curve * 0.42);
    }

    const aimed = new THREE.Vector3().copy(this.footTarget).add(swing);
    // Reichweite begrenzen (Hüfte des Schussbeins)
    const hipWorld = new THREE.Vector3();
    this.kickLeg.hip.updateWorldMatrix(true, false);
    this.kickLeg.hip.getWorldPosition(hipWorld);
    const off = new THREE.Vector3().subVectors(aimed, hipWorld);
    const reach = (this.thighLen + this.shinLen) * 0.99;
    if (off.length() > reach) off.setLength(reach);
    aimed.copy(hipWorld).add(off);
    aimed.y = Math.max(aimed.y, 0.055);
    aimed.z = THREE.MathUtils.clamp(aimed.z, -0.35, 0.55);

    /* ---- Atmung / Idle ---- */
    const breathe = Math.sin(this.t * 2.1) * 0.012;
    const hop = Math.abs(Math.sin(this.t * 3.4)) * 0.012;
    this.hips.position.y = this.hipY + breathe + hop - Math.abs(this.lean) * 0.05;
    this.torso.rotation.x = -0.06 + Math.sin(this.t * 2.1) * 0.014 + this.lean * 0.18;
    this.torso.rotation.z = this.lean * 0.35;
    this.torso.rotation.y = this.lean * 0.25;

    /* ---- Standbein ---- */
    const standTarget = new THREE.Vector3(
      this.root.position.x + this.standLeg.side * 0.14,
      0.055 + hop * 0.5,
      -0.02 + Math.sin(this.t * 1.7) * 0.01
    );
    this._solveLegIK(this.standLeg, standTarget);
    this.standLeg.ankle.rotation.set(0.15, 0, 0);

    /* ---- Schussbein per IK auf das Ziel ---- */
    this._solveLegIK(this.kickLeg, aimed);

    // Fußstellung: Spann zeigt Richtung Bewegung, beim Schuss gestreckt
    const kickStretch = this.kickTimer > 0 ? Math.sin((1 - this.kickTimer / 0.26) * Math.PI) : 0;
    this.kickLeg.ankle.rotation.x = 0.55 - kickStretch * 1.15 - THREE.MathUtils.clamp(this.footVel.y * 0.05, -0.4, 0.5);
    this.kickLeg.ankle.rotation.z = this.lean * 0.4;

    /* ---- Arme: Gegenbewegung fürs Gleichgewicht ---- */
    for (const arm of this.arms) {
      const s = arm.side;
      const spread = 0.30 + Math.abs(this.lean) * 1.5 + kickStretch * 0.22;
      const swingX = Math.sin(this.t * 2.1 + (s > 0 ? 0 : Math.PI)) * 0.14 - kickStretch * 0.55 * s;
      arm.shoulder.rotation.set(0, 0, s * spread - this.lean * 0.7 * s);
      arm.upper.rotation.set(-0.34 + swingX, s * 0.18, 0);
      arm.elbow.rotation.x = -1.05 - Math.abs(this.lean) * 0.9 - kickStretch * 0.4;
    }

    /* ---- Kopf schaut zum Ball ---- */
    if (ballPos) {
      this.headLook.lerp(ballPos, 1 - Math.exp(-10 * dt));
      const hw = new THREE.Vector3();
      this.head.getWorldPosition(hw);
      const dir = new THREE.Vector3().subVectors(this.headLook, hw);
      const parentQ = new THREE.Quaternion();
      this.head.parent.getWorldQuaternion(parentQ);
      dir.applyQuaternion(parentQ.invert()).normalize();
      const yaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -0.8, 0.8);
      const pitch = THREE.MathUtils.clamp(-Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), -0.75, 0.55);
      this.head.rotation.set(pitch * 0.85, yaw * 0.85, 0);
    }

    /* ---- Kollisionskugeln aktualisieren ---- */
    this.root.updateWorldMatrix(true, true);
    const c = this.colliders;
    this.kickLeg.shoe.getWorldPosition(c.foot.center);
    this.kickLeg.knee.getWorldPosition(c.knee.center);
    this.kickLeg.ankle.getWorldPosition(c.shin.center);
    c.shin.center.lerp(c.knee.center, 0.45);
    this.head.getWorldPosition(c.head.center);
    this.torso.getWorldPosition(c.chest.center);
    c.chest.center.y += 0.28;

    /* ---- Fußgeschwindigkeit (für den Ballimpuls) ---- */
    this.footPos.copy(c.foot.center);
    // Geglättete Fußgeschwindigkeit: ein springender Mauszeiger soll den Ball
    // nicht ins Nirwana schießen.
    _v.subVectors(this.footPos, this.footPrev).divideScalar(Math.max(dt, 1e-4));
    if (_v.length() > 9.5) _v.setLength(9.5);
    this.footVel.lerp(_v, 1 - Math.exp(-18 * dt));
    this.footPrev.copy(this.footPos);

    // Kontaktschatten mitziehen
    this.blob.position.x = this.root.position.x * 0.6 + this.footPos.x * 0.4;
    this.blob.position.z = 0.02;
  }

  celebrate(t) {
    // kleine Jubelpose beim Neustart/Highscore
    for (const arm of this.arms) {
      arm.shoulder.rotation.z = arm.side * (2.2 + Math.sin(t * 8) * 0.2);
      arm.elbow.rotation.x = -0.4;
    }
  }
}
