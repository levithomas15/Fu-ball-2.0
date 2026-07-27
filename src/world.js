import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Baut das komplette Stadion: Himmel, Rasen (inkl. echter Grashalme),
 * Ränge mit Publikum, Bandenwerbung, Flutlichtmasten und die Beleuchtung.
 */
export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 0;
    this.grassShaders = [];
    this.flickerLamps = [];

    this._environment();
    this._sky();
    this._pitch();
    this._grass();
    this._stadium();
    this._lights();
  }

  /* ---------- Umgebungs-Reflexionen für PBR-Materialien ---------- */
  _environment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = env.texture;
    this.scene.environmentIntensity = 0.18;
    pmrem.dispose();
  }

  /* ---------- Abendhimmel mit Sonnenglühen und Sternen ---------- */
  _sky() {
    const geo = new THREE.SphereGeometry(300, 48, 24);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop:     { value: new THREE.Color('#0a1030') },
        uMid:     { value: new THREE.Color('#2a3d78') },
        uHorizon: { value: new THREE.Color('#e8763a') },
        uSun:     { value: new THREE.Vector3(-0.42, 0.10, -0.9).normalize() },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vDir;
        uniform vec3 uTop, uMid, uHorizon, uSun;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -1.0, 1.0);

          // Vertikaler Verlauf: Horizontglut -> Blaustunde -> Nachthimmel
          vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.30, h));
          col = mix(col, uTop, smoothstep(0.22, 0.85, h));

          // Sonnenglühen knapp unter dem Horizont
          float sun = max(dot(d, normalize(uSun)), 0.0);
          col += vec3(1.0, 0.52, 0.18) * pow(sun, 16.0) * 0.85;
          col += vec3(1.0, 0.62, 0.30) * pow(sun, 3.0) * 0.18;

          // Sterne im oberen Bereich
          vec3 g = floor(d * 420.0);
          float star = step(0.9975, hash(g)) * smoothstep(0.12, 0.6, h);
          col += vec3(star) * (0.55 + 0.45 * sin(hash(g + 3.0) * 40.0));

          // Leichte Wolkenbänder
          float band = sin(d.x * 3.1 + d.z * 2.2) * 0.5 + 0.5;
          col = mix(col, col * 1.12 + vec3(0.06, 0.03, 0.02),
                    band * smoothstep(0.0, 0.25, h) * (1.0 - smoothstep(0.25, 0.7, h)) * 0.5);

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    this.scene.add(sky);
    this.scene.fog = new THREE.FogExp2(0x1a2338, 0.0125);
  }

  /* ---------- Rasenfläche: Mähstreifen, Linien, Rauschen ---------- */
  _pitchTexture() {
    const S = 1024;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const M = 90; // Meter, die die Textur abdeckt
    const px = S / M;

    // Grundton
    g.fillStyle = '#2f6a2a';
    g.fillRect(0, 0, S, S);

    // Mähstreifen (8 m breit)
    for (let i = 0; i < M / 8 + 1; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.075)' : 'rgba(0,0,0,0.075)';
      g.fillRect(i * 8 * px, 0, 8 * px, S);
    }

    // Rauschen / Grasstruktur
    const img = g.getImageData(0, 0, S, S);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      const m = (Math.random() - 0.5) * 14;
      d[i] = Math.max(0, Math.min(255, d[i] + n * 0.6 + m));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n + m));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.4));
    }
    g.putImageData(img, 0, 0);

    // Spielfeldlinien (Mittelkreis + Mittellinie), zentriert
    g.strokeStyle = 'rgba(255,255,255,0.82)';
    g.lineWidth = 0.12 * px;
    g.beginPath();
    g.arc(S / 2, S / 2, 9.15 * px, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(0, S / 2);
    g.lineTo(S, S / 2);
    g.stroke();
    g.beginPath();
    g.arc(S / 2, S / 2, 0.2 * px, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.82)';
    g.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  _pitch() {
    const tex = this._pitchTexture();
    const geo = new THREE.PlaneGeometry(90, 90, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.25,
    });
    const pitch = new THREE.Mesh(geo, mat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    this.scene.add(pitch);
    this.pitch = pitch;
  }

  /* ---------- Einzelne Grashalme (instanziert, mit Wind ---------- */
  _grass() {
    // Schmale, leicht gebogene Halme – nicht als Dreiecke erkennbar
    const SEG = 4, BLADE_W = 0.0075, BLADE_H = 1.0;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const w = BLADE_W * (1 - t * 0.82);
      const bend = t * t * 0.16;
      pos.push(-w, t * BLADE_H, bend, w, t * BLADE_H, bend);
      uv.push(0, t, 1, t);
      if (i < SEG) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const COUNT = 42000;
    const RADIUS = 11;
    const phases = new Float32Array(COUNT);
    const tints = new Float32Array(COUNT);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4f9440,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
      envMapIntensity: 0.18,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float aPhase;
          attribute float aTint;
          uniform float uTime;
          varying float vTint;
          varying float vH;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vTint = aTint;
          vH = uv.y;
          float sway = sin(uTime * 1.9 + aPhase) * 0.5 + sin(uTime * 3.3 + aPhase * 1.7) * 0.22;
          transformed.x += sway * pow(uv.y, 1.7) * 0.055;
          transformed.z += cos(uTime * 1.4 + aPhase * 0.8) * pow(uv.y, 1.7) * 0.035;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying float vTint;
          varying float vH;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= mix(0.78, 1.1, vTint) * mix(0.66, 1.06, vH);`);
      mat.userData.shader = shader;
      this.grassShaders.push(shader);
    };

    const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < COUNT; i++) {
      // Dichter in Kameranähe; zum Rand hin werden die Halme kürzer,
      // damit die Grasfläche unsichtbar in die Rasentextur übergeht.
      const rn = Math.pow(Math.random(), 0.55);
      const r = rn * RADIUS;
      const a = Math.random() * Math.PI * 2;
      dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.8 + 1.2);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.rotation.z = (Math.random() - 0.5) * 0.45;
      const fade = 1 - THREE.MathUtils.smoothstep(rn, 0.5, 1.0);
      const h = (0.075 + Math.random() * 0.055) * (0.3 + 0.7 * fade);
      dummy.scale.set(0.8 + Math.random() * 0.5, h, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      phases[i] = Math.random() * Math.PI * 2;
      tints[i] = Math.random();
    }
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 1));
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    this.grass = mesh;
  }

  /* ---------- Ränge, Publikum, Banden, Flutlicht ---------- */
  _stadium() {
    const group = new THREE.Group();

    // Bandenwerbung rund ums Feld
    const adCanvas = document.createElement('canvas');
    adCanvas.width = 2048; adCanvas.height = 96;
    const ag = adCanvas.getContext('2d');
    const grad = ag.createLinearGradient(0, 0, 2048, 0);
    grad.addColorStop(0, '#0d1a3a'); grad.addColorStop(0.5, '#132a5c'); grad.addColorStop(1, '#0d1a3a');
    ag.fillStyle = grad; ag.fillRect(0, 0, 2048, 96);
    ag.font = 'bold 50px "Segoe UI", sans-serif';
    ag.textBaseline = 'middle';
    ag.textAlign = 'center';
    const words = ['FU-BALL 2.0', 'JONGLIER-CUP', 'KEEP IT UP', 'ARENA'];
    for (let i = 0; i < 4; i++) {
      ag.fillStyle = i % 2 ? '#ffd451' : '#eaf1ff';
      ag.fillText(words[i], 256 + i * 512, 50);
    }
    const adTex = new THREE.CanvasTexture(adCanvas);
    adTex.colorSpace = THREE.SRGBColorSpace;
    adTex.wrapS = THREE.RepeatWrapping;
    adTex.repeat.x = -4;   // BackSide-Zylinder: Textur spiegeln, sonst steht die Schrift verkehrt
    const ads = new THREE.Mesh(
      new THREE.CylinderGeometry(26, 26, 1.1, 96, 1, true),
      new THREE.MeshStandardMaterial({
        map: adTex, side: THREE.BackSide, roughness: 0.45, metalness: 0.1,
        emissiveMap: adTex, emissive: 0xffffff, emissiveIntensity: 0.35,
      })
    );
    ads.position.y = 0.55;
    group.add(ads);

    // Zuschauerränge (Kegelstumpf)
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(40, 27, 12, 96, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x111629, side: THREE.BackSide, roughness: 0.95 })
    );
    stand.position.y = 6;
    group.add(stand);

    // Dachkante
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(42.5, 40, 0.7, 96, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x090d16, side: THREE.DoubleSide, roughness: 0.9 })
    );
    roof.position.y = 12.2;
    group.add(roof);

    // Publikum: viele kleine, farbige Instanzen auf den Rängen.
    // Das Wippen läuft im Vertex-Shader, damit pro Frame keine CPU-Arbeit anfällt.
    const crowdGeo = new THREE.BoxGeometry(0.42, 0.62, 0.36);
    const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    crowdMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float aPhase;
          uniform float uTime;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed.y += sin(uTime * 2.1 + aPhase) * 0.09;`);
      this.crowdShader = shader;
    };
    const CROWD = 7000;
    const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, CROWD);
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    const crowdPhase = new Float32Array(CROWD);
    for (let i = 0; i < CROWD; i++) {
      crowdPhase[i] = Math.random() * Math.PI * 2;
      const t = Math.random();                 // 0 = unten, 1 = oben
      const r = 27.4 + t * 12.2;
      const a = Math.random() * Math.PI * 2;
      const y = 0.8 + t * 11.2;
      d.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      d.rotation.y = -a + Math.PI / 2;
      d.scale.setScalar(0.8 + Math.random() * 0.5);
      d.updateMatrix();
      crowd.setMatrixAt(i, d.matrix);
      col.setHSL(Math.random(), 0.4 + Math.random() * 0.35, 0.12 + Math.random() * 0.26);
      crowd.setColorAt(i, col);
    }
    crowdGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(crowdPhase, 1));
    crowd.instanceMatrix.needsUpdate = true;
    if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
    group.add(crowd);
    this.crowd = crowd;

    // Flutlichtmasten
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.5, metalness: 0.7 });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 6, roughness: 0.3,
    });
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const x = Math.cos(a) * 40, z = Math.sin(a) * 40;
      const mast = new THREE.Group();
      mast.position.set(x, 0, z);
      mast.lookAt(0, 0, 0);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 24, 12), mastMat);
      pole.position.y = 12;
      mast.add(pole);

      const head = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.2, 0.5), mastMat);
      head.position.set(0, 24.5, 0.4);
      mast.add(head);

      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 2; j++) {
          const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), lampMat);
          lamp.position.set(-2.4 + i * 1.6, 23.7 + j * 1.5, 0.68);
          mast.add(lamp);
        }
      }
      this.flickerLamps.push(lampMat);
      group.add(mast);
    }

    group.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
    this.scene.add(group);
    this.stadium = group;
  }

  /* ---------- Beleuchtung ----------
   * Ein klar dominantes Hauptlicht sorgt für einen kräftigen Schatten,
   * alles andere ist nur sanfte Aufhellung. */
  _lights() {
    this.scene.add(new THREE.HemisphereLight(0x8fb0ff, 0x24331a, 0.20));
    this.scene.add(new THREE.AmbientLight(0x2b3550, 0.12));

    // Hauptflutlicht: hoch und leicht seitlich, damit der Schatten am Spieler klebt
    const key = new THREE.DirectionalLight(0xfff0d0, 4.2);
    key.position.set(-3.6, 14, -3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 34;
    const s = 7;
    key.shadow.camera.left = -s; key.shadow.camera.right = s;
    key.shadow.camera.top = s; key.shadow.camera.bottom = -s;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.018;
    key.shadow.radius = 3;
    key.shadow.intensity = 0.92;
    this.scene.add(key);
    this.keyLight = key;

    // Zweites Flutlicht von vorne rechts (kühl) – zarter Gegenschatten
    const flood = new THREE.SpotLight(0xd6e6ff, 42, 55, Math.PI / 6.5, 0.6, 1.5);
    flood.position.set(13, 20, 11);
    flood.target.position.set(0, 0.9, 0);
    flood.castShadow = true;
    flood.shadow.mapSize.set(1024, 1024);
    flood.shadow.bias = -0.0012;
    flood.shadow.normalBias = 0.03;
    flood.shadow.intensity = 0.55;
    this.scene.add(flood, flood.target);

    // Kaltes Streiflicht von hinten für die Silhouette
    const rim = new THREE.DirectionalLight(0x9ec4ff, 0.42);
    rim.position.set(6, 4, -9);
    this.scene.add(rim);

    // Warmer Nahbereichs-Aufheller vor dem Spieler
    const fill = new THREE.PointLight(0xffd9ab, 2.2, 14, 2);
    fill.position.set(2.2, 2.2, 4.2);
    this.scene.add(fill);
  }

  update(dt) {
    this.time += dt;
    for (const sh of this.grassShaders) sh.uniforms.uTime.value = this.time;
    if (this.crowdShader) this.crowdShader.uniforms.uTime.value = this.time;

    // Leichtes Flackern der Flutlichter
    const f = 5.6 + Math.sin(this.time * 7.3) * 0.25 + Math.sin(this.time * 2.1) * 0.35;
    for (const m of this.flickerLamps) m.emissiveIntensity = f;
  }
}
