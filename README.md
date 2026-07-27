# ⚽ FU-BALL 2.0 — 3D-Jonglier-Challenge

Ein Browser-Spiel in echtem 3D: Du steuerst den **Fuß** eines Fußballers und
musst den Ball so lange wie möglich in der Luft halten. Zieh den Fuß von unten
durch den Ball und hau ihn nach oben.

Läuft komplett offline — kein Download, kein Build, keine externen Server.

## Starten

Das Spiel braucht einen kleinen lokalen Webserver (ES-Module lassen sich nicht
per `file://` laden):

```bash
python3 -m http.server 8000
# danach im Browser öffnen:  http://localhost:8000
```

Alternativ `npx serve` oder jeder andere statische Server.

## Steuerung

| Eingabe | Wirkung |
|---|---|
| **Maus / Finger bewegen** | Fuß bewegen — der Spieler läuft automatisch mit |
| **Klick / Tippen / Leertaste** | Schuss: kurze, kräftige Schussbewegung mit Extra-Power |
| **A D W S** oder **Pfeiltasten** | Fuß per Tastatur steuern |
| **M** | Ton an / aus |

Punkte gibt es für jeden Kontakt mit **Fuß, Knie oder Kopf**. Die Brust nimmt
den Ball nur an, ohne zu zählen. Ein sauber getroffener Schuss zählt als
*Perfekt* und startet eine Serie. Berührt der Ball den Rasen, ist Schluss —
der Rekord wird lokal im Browser gespeichert.

Mit steigender Punktzahl nimmt die Schwerkraft leicht zu; der Ball fällt
schneller und will präziser getroffen werden.

## Technik

Reines JavaScript mit [three.js](https://threejs.org) (r170, im Ordner
`vendor/` mitgeliefert). Es gibt **keine Bild- oder Ton-Dateien** — alle
Texturen und Geräusche werden zur Laufzeit erzeugt.

```
index.html          Seite, HUD, Menüs, Styles
src/main.js         Spielschleife, Zustände, Kollisionen, Punkte, Kamera
src/world.js        Stadion: Himmel, Rasen, Grashalme, Ränge, Beleuchtung
src/player.js       Spielerfigur: Aufbau, Animation, Bein-IK
src/ball.js         Ball: prozedurale Texturen und Flugphysik
src/effects.js      Partikel, Schockwellen, Ballschweif
src/audio.js        Synthetisierter Sound (WebAudio)
vendor/three/       three.js r170 (MIT)
```

Ein paar Details, die die Optik ausmachen:

- **Ballmuster** — das klassische Waben-Muster ist exakt das Voronoi-Diagramm
  der 12 Ikosaeder-Ecken (Fünfecke) und 20 Flächenmitten (Sechsecke) auf der
  Kugel. Daraus werden Farb-, Bump- und Rauheitskarte in einem Durchgang
  berechnet, inklusive Nähten, Ziernähten und Lederkorn.
- **Spielerfigur** — Körper, Arme und Beine sind Rotationskörper mit einer
  echten Silhouette (schmale Taille, breite Brust). Rückennummer und Wappen
  liegen als gekrümmte Aufnäher auf dem Trikot. Das Schussbein wird per
  Zwei-Knochen-IK auf den Mauszeiger gerechnet, der Rest — Gewichtsverlagerung,
  Standbein, Armbalance, Kopfblick zum Ball — läuft prozedural mit.
- **Rasen** — 42 000 instanzierte Grashalme mit Wind im Vertex-Shader, die zum
  Rand hin ausblenden und in die Rasentextur übergehen.
- **Licht** — ein dominantes Flutlicht mit weichem Schattenwurf, dazu
  Gegenlicht und Umgebungsreflexionen; ACES-Tonemapping, Bloom und SMAA.
- **Physik** — feste Zeitscheiben (1/120 s) mit Kollisionsprüfung in jedem
  Substep, dazu Drall, Magnus-Effekt und Luftwiderstand.

### Leistung

Läuft das Spiel unter 40 fps, schaltet es automatisch stufenweise zurück
(Pixelverhältnis → Kantenglättung und Schattenauflösung → Grashalme und
Bloom). Zum Debuggen liegt das Spielobjekt unter `window.FUBALL`.

## Lizenz

three.js steht unter der MIT-Lizenz (siehe `vendor/three/LICENSE`).
