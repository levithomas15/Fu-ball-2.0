import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

import { World } from './world.js';
import { Ball, BALL_R } from './ball.js';
import { Player } from './player.js';
import { Effects } from './effects.js';
import { Audio } from './audio.js';

/* ================================================================ *
 *  Grundgerüst
 * ================================================================ */

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0.35, 1.42, 3.5);

const world = new World(scene, renderer);
const ball = new Ball(scene);
const player = new Player(scene);
const fx = new Effects(scene);
const audio = new Audio();

/* ---------- Post-Processing ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.75, 0.86
);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const smaa = new SMAAPass(window.innerWidth, window.innerHeight);
composer.addPass(smaa);

/* ================================================================ *
 *  Spielzustand
 * ================================================================ */

const STATE = { MENU: 'menu', PLAY: 'play', OVER: 'over' };
const game = {
  state: STATE.MENU,
  score: 0,
  best: Number(localStorage.getItem('fuball2_best') || 0),
  perfectStreak: 0,
  gravity: 12.0,
  shake: 0,
  overTimer: 0,
  maxHeight: 0,
};

const ui = {
  hud: document.getElementById('hud'),
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  combo: document.getElementById('combo'),
  meter: document.getElementById('meterFill'),
  popups: document.getElementById('popups'),
  start: document.getElementById('startScreen'),
  over: document.getElementById('overScreen'),
  finalScore: document.getElementById('finalScore'),
  finalBest: document.getElementById('finalBest'),
  newBest: document.getElementById('newBest'),
  verdict: document.getElementById('verdict'),
  loader: document.getElementById('loader'),
  sound: document.getElementById('sound'),
};
ui.best.textContent = game.best;

/* ================================================================ *
 *  Eingabe – die Maus/der Finger steuert direkt den Fuß
 * ================================================================ */

const pointer = new THREE.Vector2(0, -0.3);
const raycaster = new THREE.Raycaster();
const playPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const footTarget = new THREE.Vector3(0.35, 0.5, 0);
let pointerActive = false;
const keys = new Set();

function updatePointer(cx, cy) {
  pointer.x = (cx / window.innerWidth) * 2 - 1;
  pointer.y = -(cy / window.innerHeight) * 2 + 1;
  pointerActive = true;
}

renderer.domElement.addEventListener('pointermove', (e) => updatePointer(e.clientX, e.clientY));
renderer.domElement.addEventListener('pointerdown', (e) => {
  updatePointer(e.clientX, e.clientY);
  audio.resume();
  if (game.state === STATE.PLAY) doKick();
});
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Space') {
    e.preventDefault();
    audio.resume();
    if (game.state === STATE.PLAY) doKick();
    else if (game.state === STATE.MENU) startGame();
    else if (game.state === STATE.OVER && game.overTimer > 0.6) startGame();
  }
  if (e.code === 'KeyM') {
    audio.resume();
    const on = audio.toggle();
    flashSound(on ? 'Ton an' : 'Ton aus');
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

function flashSound(text) {
  ui.sound.textContent = text;
  ui.sound.style.opacity = '0.75';
  clearTimeout(flashSound._t);
  flashSound._t = setTimeout(() => (ui.sound.style.opacity = '0'), 1100);
}

function doKick() {
  // Schussrichtung: dorthin, wo der Ball gerade ist (leicht nach oben)
  const dir = new THREE.Vector3().subVectors(ball.pos, player.footPos);
  if (dir.lengthSq() < 1e-4 || dir.y < 0.05) dir.set(0, 1, 0);
  dir.y = Math.abs(dir.y) + 0.55;
  dir.z = 0;
  if (player.kick(dir)) fx.ring(player.footPos, new THREE.Vector3(0, 0, 1), 0x6ff2c8);
}

/* Tastatursteuerung als Alternative zur Maus */
function keyboardTarget(dt) {
  let dx = 0, dy = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dy += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dy -= 1;
  if (dx || dy) {
    footTarget.x = THREE.MathUtils.clamp(footTarget.x + dx * 3.6 * dt, -3.2, 3.2);
    footTarget.y = THREE.MathUtils.clamp(footTarget.y + dy * 2.6 * dt, 0.06, 1.4);
    return true;
  }
  return false;
}

/* ================================================================ *
 *  Punkte & Anzeige
 * ================================================================ */

function popup(worldPos, text, cls = '') {
  const v = worldPos.clone().project(camera);
  const el = document.createElement('div');
  el.className = 'pop ' + cls;
  el.textContent = text;
  el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
  el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
  ui.popups.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function setScore(n) {
  game.score = n;
  ui.score.textContent = n;
  ui.score.classList.remove('pulse');
  void ui.score.offsetWidth;
  ui.score.classList.add('pulse');
}

const PRAISE = ['Stark!', 'Weiter so!', 'Sauber!', 'Technik!', 'Weltklasse!', 'Unfassbar!'];

function milestone(n) {
  const idx = Math.min(PRAISE.length - 1, Math.floor(n / 10) - 1);
  popup(ball.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), `${n} · ${PRAISE[idx]}`, 'perfect');
  audio.chime(Math.floor(n / 10) - 1);
  bloomPulse = 0.5;
}

/* ================================================================ *
 *  Ballkontakte
 * ================================================================ */

const TOUCH = {
  foot:  { e: 0.45, transfer: 0.75, minUp: 5.9, score: true,  label: 'Fuß' },
  shin:  { e: 0.40, transfer: 0.60, minUp: 5.2, score: true,  label: 'Fuß' },
  knee:  { e: 0.40, transfer: 0.55, minUp: 5.0, score: true,  label: 'Knie' },
  head:  { e: 0.45, transfer: 0.55, minUp: 5.2, score: true,  label: 'Kopf' },
  chest: { e: 0.22, transfer: 0.30, minUp: 3.0, score: false, label: 'Brust' },
};

const _n = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _t = new THREE.Vector3();

function handleCollisions() {
  if (ball.cooldown > 0) return;

  for (const key of ['foot', 'shin', 'knee', 'head', 'chest']) {
    const c = player.colliders[key];
    const cfg = TOUCH[key];
    const minDist = c.r + ball.radius;
    _n.subVectors(ball.pos, c.center);
    const d = _n.length();
    if (d > minDist || d < 1e-5) continue;

    _n.divideScalar(d);                                  // Stoßnormale
    _n.z *= 0.25;                                        // Tiefe kaum ablenken
    _n.normalize();
    const partVel = (key === 'foot' || key === 'shin') ? player.footVel : _t.set(0, 0, 0);
    _rel.subVectors(ball.vel, partVel);
    const vn = _rel.dot(_n);
    if (vn > 1.2) continue;                              // entfernt sich bereits

    const power = (key === 'foot' || key === 'shin') ? player.kickPower : 1;
    const impulse = -(1 + cfg.e) * Math.min(vn, 0);
    ball.vel.addScaledVector(_n, impulse);
    // Kraft des Fußes wirkt entlang der Stoßnormale – sonst schiebt jede
    // seitliche Fußbewegung den Ball immer weiter zur Seite.
    const push = Math.max(0, partVel.dot(_n));
    ball.vel.addScaledVector(_n, push * cfg.transfer * power);
    ball.vel.addScaledVector(partVel, 0.12 * power);

    // Reibung erzeugt Drall
    _t.copy(_rel).addScaledVector(_n, -vn);
    ball.vel.addScaledVector(_t, -0.16);
    ball.angVel.add(new THREE.Vector3().crossVectors(_n, _t).multiplyScalar(-2.2));

    // Grundhöhe, damit das Spiel spielbar bleibt
    // Untergrenze für die Höhe (spielbar) und Obergrenze (Ball bleibt erreichbar)
    const minUp = cfg.minUp * (key === 'foot' ? 0.62 + 0.38 * power : 1);
    ball.vel.y = THREE.MathUtils.clamp(ball.vel.y, minUp, 5.6 + 3.4 * power);
    if (ball.vel.length() > 11.5) ball.vel.setLength(11.5);

    // Zielhilfe: Flugbahn so korrigieren, dass der Ball zurück zum Spieler fällt
    const flight = (2 * ball.vel.y) / game.gravity;
    // Landepunkt Richtung Feldmitte ziehen, damit der Ball nicht abwandert
    const homeX = THREE.MathUtils.clamp(player.rootX * 0.35, -1.5, 1.5);
    const wantVx = (homeX - ball.pos.x) / Math.max(flight, 0.35);
    ball.vel.x = THREE.MathUtils.lerp(ball.vel.x, wantVx, key === 'foot' ? 0.72 : 0.55);
    ball.vel.x = THREE.MathUtils.clamp(ball.vel.x, -3.0, 3.0);

    // Überlappung auflösen
    ball.pos.copy(c.center).addScaledVector(_n, minDist + 0.001);
    ball.cooldown = 0.11;
    ball.apex = ball.pos.y;

    /* ---- Bewertung & Feedback ---- */
    const strength = THREE.MathUtils.clamp(ball.vel.length() / 9, 0.35, 1.6);
    fx.burst(ball.pos, _n, strength);
    fx.ring(ball.pos, new THREE.Vector3(0, 0, 1), key === 'foot' ? 0xffe6a0 : 0x9fd8ff);
    audio.kick(strength * (key === 'foot' ? 1.15 : 0.8));
    game.shake = Math.min(0.5, 0.12 + strength * 0.14);
    bloomPulse = Math.max(bloomPulse, 0.28 * strength);

    if (cfg.score) {
      const perfect = key === 'foot' && d < c.r + ball.radius * 0.55 && power > 1.25;
      if (perfect) {
        game.perfectStreak++;
        popup(ball.pos, 'PERFEKT!', 'perfect');
        ui.combo.textContent = game.perfectStreak > 1 ? `Perfekt-Serie ×${game.perfectStreak}` : 'Perfekt getroffen';
        ui.combo.classList.add('on');
      } else {
        game.perfectStreak = 0;
        ui.combo.classList.remove('on');
        if (key !== 'foot') popup(ball.pos, cfg.label + '!', 'perfect');
      }
      const next = game.score + 1;
      setScore(next);
      if (next % 10 === 0) milestone(next);
      // Schwierigkeit steigt sanft an
      game.gravity = 12.0 * (1 + Math.min(next, 70) / 70 * 0.30);
    } else {
      popup(ball.pos, 'Brust', '');
    }
    break;
  }
}

/* ================================================================ *
 *  Ablauf
 * ================================================================ */

function startGame() {
  game.state = STATE.PLAY;
  game.score = 0;
  game.perfectStreak = 0;
  game.gravity = 12.0;
  game.maxHeight = 0;
  setScore(0);
  ui.combo.classList.remove('on');
  ui.start.classList.add('hidden');
  ui.over.classList.add('hidden');
  ui.hud.classList.add('on');
  ball.reset(player.rootX + 0.4, 3.1);
  audio.resume();
}

function gameOver() {
  game.state = STATE.OVER;
  game.overTimer = 0;
  fx.ground(ball.pos);
  audio.thud();
  audio.crowdOoh();
  game.shake = 0.35;

  const isBest = game.score > game.best;
  if (isBest) {
    game.best = game.score;
    localStorage.setItem('fuball2_best', String(game.best));
    ui.best.textContent = game.best;
    audio.cheer();
  }
  ui.finalScore.textContent = game.score;
  ui.finalBest.textContent = game.best;
  ui.newBest.classList.toggle('on', isBest && game.score > 0);
  ui.verdict.textContent = verdictFor(game.score);
  setTimeout(() => {
    if (game.state === STATE.OVER) ui.over.classList.remove('hidden');
  }, 900);
}

function verdictFor(s) {
  if (s < 3) return 'Da geht mehr. Zieh den Fuß von unten durch den Ball.';
  if (s < 10) return 'Solide Grundlage – jetzt den Rhythmus finden.';
  if (s < 25) return 'Richtig gut! Der Ball gehorcht dir langsam.';
  if (s < 50) return 'Starke Technik. Die Kurve zeigt nach oben.';
  return 'Weltklasse. Das Stadion steht kopf!';
}

document.getElementById('startBtn').addEventListener('click', () => { audio.resume(); startGame(); });
document.getElementById('againBtn').addEventListener('click', () => { audio.resume(); startGame(); });

/* ================================================================ *
 *  Kamera
 * ================================================================ */

const camTarget = new THREE.Vector3(0.2, 1.0, 0);
const camPos = new THREE.Vector3(0.35, 1.42, 3.5);

function updateCamera(dt) {
  if (window.FUBALL && window.FUBALL.camLock) return; // Debug: Kamera festhalten
  const focusX = ball.pos.x * 0.4 + player.rootX * 0.3;
  const focusY = THREE.MathUtils.clamp(0.85 + ball.pos.y * 0.26, 0.85, 2.1);
  const dist = 3.5 + THREE.MathUtils.clamp(ball.pos.y - 1.5, 0, 3.5) * 0.5;

  camTarget.lerp(_t.set(focusX, focusY, 0), 1 - Math.exp(-3.4 * dt));
  camPos.lerp(
    _n.set(focusX * 0.5 + 0.12, 1.34 + ball.pos.y * 0.14, dist),
    1 - Math.exp(-2.6 * dt)
  );

  camera.position.copy(camPos);
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - dt * 1.9);
    const s = game.shake * game.shake * 0.09;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
  }
  camera.lookAt(camTarget);
}

/* ================================================================ *
 *  Hauptschleife
 * ================================================================ */

let bloomPulse = 0;
let firstFrameDone = false;
let last = performance.now();
let acc = 0;
const FIXED = 1 / 120;
let trailAcc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  /* ---- Fußziel aus der Zeigerposition ---- */
  if (!keyboardTarget(dt) && pointerActive) {
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(playPlane, hit)) {
      footTarget.x = THREE.MathUtils.clamp(hit.x, -3.2, 3.2);
      footTarget.y = THREE.MathUtils.clamp(hit.y, 0.06, 1.42);
      footTarget.z = 0;
    }
  }
  player.setTarget(footTarget);

  /* ---- Simulation ---- */
  if (game.state === STATE.PLAY) {
    player.update(dt, ball.pos);
    acc += dt;
    let guard = 0;
    while (acc >= FIXED && guard++ < 12) {
      ball.step(FIXED, game.gravity);
      handleCollisions();
      acc -= FIXED;
    }

    game.maxHeight = Math.max(game.maxHeight, ball.pos.y);
    ui.meter.style.height = THREE.MathUtils.clamp((ball.pos.y / 6) * 100, 0, 100) + '%';

    // Schweif bei schnellem Ball
    trailAcc += dt;
    if (ball.speed > 5.5 && trailAcc > 0.016) {
      fx.trail(ball.pos, ball.speed);
      trailAcc = 0;
    }

    // Boden berührt oder Ball außerhalb -> vorbei
    if (ball.pos.y <= ball.radius + 0.005) {
      ball.pos.y = ball.radius;
      ball.vel.y = Math.abs(ball.vel.y) * 0.35;
      gameOver();
    } else if (Math.abs(ball.pos.x) > 5.2) {
      gameOver();
    }
  } else {
    // Menü/Ende: Ball fällt weiter, Spieler bleibt lebendig
    acc = 0;
    ball.step(Math.min(dt, 1 / 60), game.gravity);
    if (ball.pos.y <= ball.radius) {
      ball.pos.y = ball.radius;
      if (Math.abs(ball.vel.y) > 0.4) {
        ball.vel.y = Math.abs(ball.vel.y) * 0.42;
        ball.vel.x *= 0.75;
        if (Math.abs(ball.vel.y) > 1.2) { fx.ground(ball.pos); audio.thud(); }
      } else {
        ball.vel.y = 0;
        ball.vel.x *= 1 - Math.min(1, 2.4 * dt);
        ball.angVel.multiplyScalar(1 - Math.min(1, 2.0 * dt));
      }
    }
    player.update(dt, ball.pos);
    if (game.state === STATE.OVER) {
      game.overTimer += dt;
      ui.meter.style.height = '0%';
    }
  }

  ball.sync();
  world.update(dt);
  fx.update(dt);
  updateCamera(dt);

  // Bloom pulsiert kurz bei Treffern
  if (bloomPulse > 0) bloomPulse = Math.max(0, bloomPulse - dt * 1.6);
  if (bloom.enabled) bloom.strength = 0.42 + bloomPulse * 0.55;

  composer.render();
  adaptQuality(dt);

  if (!firstFrameDone) {
    firstFrameDone = true;
    ui.loader.classList.add('hidden');
  }
}

/* ---- Fenstergröße ---- */
function applySize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  smaa.setSize(w, h);
  fx.resize();
}
window.addEventListener('resize', applySize);

/* ---- Automatische Qualitätsstufe ----
 * Läuft das Spiel zu langsam, werden nacheinander die teuersten Effekte
 * abgeschaltet, damit es auf schwächerer Hardware flüssig bleibt. */
let quality = 0, qTimer = 0, qFrames = 0;
function adaptQuality(dt) {
  if (quality >= 3) return;
  qTimer += dt;
  qFrames++;
  if (qTimer < 3) return;
  const fps = qFrames / qTimer;
  qTimer = 0;
  qFrames = 0;
  if (fps >= 40) return;
  quality++;
  if (quality === 1) {
    renderer.setPixelRatio(1);
    applySize();
  } else if (quality === 2) {
    smaa.enabled = false;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    world.keyLight.shadow.mapSize.set(1024, 1024);
    world.keyLight.shadow.map?.dispose();
    world.keyLight.shadow.map = null;
  } else {
    world.grass.visible = false;
    bloom.enabled = false;
  }
}

/* ---- Debug-Zugriff (praktisch zum Feinjustieren in der Konsole) ---- */
window.FUBALL = {
  scene, camera, renderer, composer, world, ball, player, fx, game, STATE, startGame, footTarget,
  // rendert sofort und liefert das Bild – nützlich für automatisierte Sichtprüfungen
  snapshot: () => { composer.render(); return renderer.domElement.toDataURL('image/png'); },
};

/* ---- Start ---- */
ball.reset(0.4, 1.4);
player.update(0.016, ball.pos);
renderer.compile(scene, camera);
requestAnimationFrame(frame);
// Notbremse, falls das erste Bild ungewöhnlich lange braucht
setTimeout(() => ui.loader.classList.add('hidden'), 8000);

// Kleine Demo-Bewegung im Menü, damit das Männchen "lebt"
(function menuIdle() {
  if (game.state === STATE.MENU) {
    const t = performance.now() / 1000;
    footTarget.set(0.35 + Math.sin(t * 0.9) * 0.35, 0.45 + Math.abs(Math.sin(t * 1.4)) * 0.35, 0);
    if (!pointerActive) player.setTarget(footTarget);
  }
  requestAnimationFrame(menuIdle);
})();
