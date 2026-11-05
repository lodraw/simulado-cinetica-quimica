// =====================================================================
//  VISOR 3D · Biorreactor + cáscaras procedurales (Three.js)
//  Todo se genera por código (CanvasTexture y GLSL): sin descargas ni licencias.
//  Las texturas de las cáscaras reaccionan al estado que calcula modelo.js
//  (estadoCascara): aquí solo se pinta, no se decide nada de química.
// =====================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ---------- utilidades de textura ----------
function lienzo(w = 512, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
// Pantallas táctiles: menos resolución, 30 cuadros/s y ruido más simple. En un teléfono no se
// distingue, y evita que la GPU se sature o se caliente. Con ratón todo queda en calidad completa.
const CALIDAD = matchMedia('(pointer: coarse)').matches
  ? { pixeles: 1.5, msCuadro: 31, octavas: 3, burbujas: 140, levadura: 300 } // con 2 octavas las manchas salen cuadradas
  : { pixeles: 2, msCuadro: 0, octavas: 4, burbujas: 220, levadura: 500 };

const rnd = (a, b) => a + Math.random() * (b - a);
function aTextura(canvas, rep = [1, 1], color = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep[0], rep[1]);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Manchas que dan la vuelta al borde del lienzo: la textura no deja costura en la esfera
function ruido(ctx, w, h, n, colores, rMin, rMax, alfa = 0.35) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = rnd(alfa * 0.4, alfa);
    ctx.fillStyle = colores[(Math.random() * colores.length) | 0];
    const x = rnd(0, w), y = rnd(0, h), r = rnd(rMin, rMax);
    for (const dx of [0, x < r ? w : x > w - r ? -w : 0]) for (const dy of [0, y < r ? h : y > h - r ? -h : 0]) {
      ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

const TEXTURAS = {
  naranja() {
    const [c, x] = lienzo(); x.fillStyle = '#f28a17'; x.fillRect(0, 0, 512, 512);
    x.filter = 'blur(7px)'; ruido(x, 512, 512, 900, ['#f7a23a', '#e07510', '#ffb347'], 6, 22, 0.25); x.filter = 'none';
    ruido(x, 512, 512, 2600, ['#c9650c'], 1, 2.6, 0.55);              // poros (glándulas de aceite)
    const [b, y] = lienzo(); y.fillStyle = '#b4b4b4'; y.fillRect(0, 0, 512, 512);
    ruido(y, 512, 512, 3000, ['#5a5a5a', '#707070'], 1.2, 3.2, 0.9);  // hoyuelos
    return { map: aTextura(c, [2, 2]), bump: aTextura(b, [2, 2], false), bumpScale: 2.2, interior: '#f5ead0', rough: 0.55 };
  },
  platano() {
    const [c, x] = lienzo(); const g = x.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, '#e9c62c'); g.addColorStop(0.5, '#f7dc4a'); g.addColorStop(1, '#e9c62c');
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(160,130,20,0.25)'; x.fillRect(i * 102.4, 0, 5, 512); } // aristas
    ruido(x, 512, 512, 220, ['#6b4a1d', '#835a22', '#4a3313'], 1.5, 5, 0.8); // manchas de maduración
    const [b, y] = lienzo(); y.fillStyle = '#9a9a9a'; y.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5; i++) { y.fillStyle = '#ffffff'; y.fillRect(i * 102.4, 0, 8, 512); }
    return { map: aTextura(c), bump: aTextura(b, [1, 1], false), bumpScale: 1.4, interior: '#f2edd6', rough: 0.45 };
  },
  pina() {
    const [c, x] = lienzo(); const [b, y] = lienzo();
    x.fillStyle = '#5a3d14'; x.fillRect(0, 0, 512, 512); y.fillStyle = '#202020'; y.fillRect(0, 0, 512, 512);
    // 10 columnas × 9 filas: el panal cierra exacto en el borde y no deja costura
    const R = 512 / 15, H = 512 / 9, RY = H / Math.sqrt(3);
    for (let row = -1; row < 10; row++) for (let col = -1; col < 12; col++) {
      const cx = col * 1.5 * R, cy = row * H + (col % 2 ? H / 2 : 0);
      const hex = ctx => { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; ctx.lineTo(cx + (R - 3) * Math.cos(a), cy + (RY - 3) * Math.sin(a)); } ctx.closePath(); };
      const gr = x.createRadialGradient(cx, cy, 2, cx, cy, R);
      gr.addColorStop(0, '#d8a640'); gr.addColorStop(0.55, '#a8742a'); gr.addColorStop(1, '#5e7a2a');
      x.fillStyle = gr; hex(x); x.fill();
      x.fillStyle = '#3a2a10'; x.beginPath(); x.arc(cx, cy - 4, 3.5, 0, Math.PI * 2); x.fill(); // espina
      const gb = y.createRadialGradient(cx, cy, 1, cx, cy, R); gb.addColorStop(0, '#ffffff'); gb.addColorStop(1, '#505050');
      y.fillStyle = gb; hex(y); y.fill();
    }
    return { map: aTextura(c, [3, 2]), bump: aTextura(b, [3, 2], false), bumpScale: 4, interior: '#f3d86a', rough: 0.7 };
  },
  mango() {
    const [c, x] = lienzo(); const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#c9382a'); g.addColorStop(0.35, '#e8752e'); g.addColorStop(0.6, '#e6b532'); g.addColorStop(1, '#6f9e35');
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    x.filter = 'blur(14px)'; ruido(x, 512, 512, 500, ['#f29a3a', '#b9462a', '#8fb43f'], 8, 30, 0.18); x.filter = 'none';
    ruido(x, 512, 512, 700, ['#fff2b0'], 0.8, 1.8, 0.6);              // lenticelas
    const [b, y] = lienzo(); y.fillStyle = '#a0a0a0'; y.fillRect(0, 0, 512, 512);
    ruido(y, 512, 512, 700, ['#c8c8c8'], 0.8, 2, 0.5);
    return { map: aTextura(c), bump: aTextura(b, [1, 1], false), bumpScale: 0.6, interior: '#f7b02e', rough: 0.35 };
  }
};

// ---------- shader de deterioro de la cáscara ----------
// Ruido en coordenadas del objeto: sin costuras y sin estirarse en los polos.
const GLSL_RUIDO = /* glsl */`
  uniform float uPardeo, uEscaldado, uDecolor, uOxidacion, uMoho, uArruga, uEscala, uHundir;
  varying vec3 vPosC;
  float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float ruido3(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < ${CALIDAD.octavas}; i++) { s += a * ruido3(p); p = p * 2.03 + 7.1; a *= 0.5; } return s / ${(1 - 0.5 ** CALIDAD.octavas).toFixed(4)}; }
`;
const GLSL_CELDAS = /* glsl */`
  // Distancia al centro de colonia más cercano (Worley). Basta un bloque de 2×2×2 celdas
  // alrededor del punto: cubre un radio de 0.5, el máximo de una colonia (radioM).
  float celdas(vec3 p) {
    vec3 i = floor(p - 0.5), f = p - i; float d = 1.0;
    for (int x = 0; x <= 1; x++) for (int y = 0; y <= 1; y++) for (int z = 0; z <= 1; z++) {
      vec3 g = vec3(x, y, z), c = g + vec3(hash3(i + g), hash3(i + g + 11.3), hash3(i + g + 27.7));
      d = min(d, length(c - f));
    }
    return d;
  }
  vec3 relieveC(vec3 pos, vec3 n, vec2 dH, float cara) {
    vec3 sx = dFdx(pos), sy = dFdy(pos), r1 = cross(sy, n), r2 = cross(n, sx);
    float det = dot(sx, r1) * cara;
    return normalize(abs(det) * n - sign(det) * (dH.x * r1 + dH.y * r2));
  }
`;
const GLSL_COLOR = /* glsl */`
  float nGrande = fbm(vPosC * 1.7), nFino = fbm(vPosC * 6.3 + 4.0);
  vec3 cC = diffuseColor.rgb;
  float lumaC = dot(cC, vec3(0.3, 0.59, 0.11));
  // Decoloración ácida: pierde saturación y palidece
  cC = mix(cC, vec3(lumaC) * vec3(1.0, 0.97, 0.86) * 0.65 + vec3(0.42, 0.40, 0.33), uDecolor * (0.8 + 0.2 * nFino));
  // Escaldado: tono cocido y opaco, verde olivo a pardo
  cC = mix(cC, cC * vec3(0.46, 0.40, 0.22) + vec3(0.035, 0.03, 0.01), uEscaldado * (0.75 + 0.25 * nGrande));
  // Pardeamiento: parches que crecen desde las zonas dañadas hasta cubrir la superficie
  cC = mix(cC, cC * vec3(0.8, 0.68, 0.55), uPardeo);
  float umbralP = 0.76 - uPardeo * 0.62;
  float mP = smoothstep(umbralP - 0.07, umbralP + 0.09, nGrande * 0.72 + nFino * 0.28);
  cC = mix(cC, cC * vec3(0.36, 0.22, 0.12) + vec3(0.025, 0.012, 0.004), mP * min(1.0, uPardeo * 3.5));
  // Oxidación alcalina: manchas casi negras
  if (uOxidacion >= 0.01) {
    float umbralO = 0.74 - uOxidacion * 0.56;
    float mO = smoothstep(umbralO - 0.04, umbralO + 0.05, fbm(vPosC * 3.1 + 9.0));
    cC = mix(cC, vec3(0.022, 0.014, 0.012), mO * 0.92);
  }
  // Moho: colonias con centro verde azulado y borde blanco de micelio
  float dM = uMoho > 0.02 ? celdas(vPosC * 2.6 + (nFino - 0.5) * 0.9) : 1.0;
  float radioM = uMoho * 0.5;
  float mM = (1.0 - smoothstep(radioM * 0.72, radioM, dM)) * step(0.02, uMoho);
  float borde = smoothstep(radioM * 0.34, radioM * 0.72, dM);
  vec3 cMoho = mix(vec3(0.16, 0.30, 0.24), vec3(0.92, 0.93, 0.88), borde) * (0.82 + 0.36 * nFino);
  cC = mix(cC, cMoho, mM);
  diffuseColor.rgb = cC;
`;

const hojaUniformes = () => ({ uPardeo: { value: 0 }, uEscaldado: { value: 0 }, uDecolor: { value: 0 }, uOxidacion: { value: 0 }, uMoho: { value: 0 }, uArruga: { value: 0 } });

// Inserta el deterioro en un MeshStandardMaterial. `compartidos` son los mismos
// uniformes para todos los materiales: se actualizan una vez por cuadro.
function conDeterioro(mat, compartidos, escala, hundir) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, compartidos, { uEscala: { value: escala }, uHundir: { value: hundir } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_RUIDO}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPosC = position * uEscala;
        if (uArruga > 0.001) transformed -= normal * uArruga * uHundir * fbm(vPosC * 2.4);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_RUIDO}\n${GLSL_CELDAS}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${GLSL_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + uEscaldado * 0.3 + uPardeo * 0.2 - uOxidacion * 0.55 + mM * 0.6, 0.08, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (uArruga > 0.001) {
          float hC = abs(fbm(vPosC * 4.2) - 0.5) * 2.0;
          normal = relieveC(-vViewPosition, normal, vec2(dFdx(hC), dFdy(hC)) * uArruga * 0.11 / max(uEscala, 0.001), faceDirection);
        }`);
  };
  return mat;
}

// ---------- geometrías ----------
// Promedia las normales de vértices en la misma posición: al arrugarse, la costura no se abre
function soldarNormales(g) {
  const p = g.attributes.position, n = g.attributes.normal, grupos = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(4)).join();
    (grupos.get(k) ?? grupos.set(k, []).get(k)).push(i);
  }
  const v = new THREE.Vector3();
  for (const ids of grupos.values()) {
    v.set(0, 0, 0);
    ids.forEach(i => v.add(new THREE.Vector3().fromBufferAttribute(n, i)));
    v.normalize();
    ids.forEach(i => n.setXYZ(i, v.x, v.y, v.z));
  }
  return g;
}
function tuboAfilado(curva, segs, radial, rMax) {
  const frames = curva.computeFrenetFrames(segs, false);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, P = curva.getPointAt(u);
    const r = rMax * Math.pow(Math.sin(Math.PI * u), 0.55) * (0.92 + 0.08 * Math.cos(u * 9));
    for (let j = 0; j <= radial; j++) {
      const v = j / radial * Math.PI * 2;
      const facet = 1 + 0.06 * Math.cos(v * 5); // sección pentagonal suave
      const n = frames.normals[i].clone().multiplyScalar(Math.cos(v)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(v)));
      pos.push(P.x + n.x * r * facet, P.y + n.y * r * facet, P.z + n.z * r * facet);
      uv.push(j / radial, u);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function tiraCurva(largo, ancho, curl, bend) { // fragmento de cáscara de plátano
  const g = new THREE.PlaneGeometry(ancho, largo, 8, 24), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const ang = (x / ancho) * curl, rad = ancho / curl;
    p.setXYZ(i, Math.sin(ang) * rad, y, (1 - Math.cos(ang)) * rad + bend * (y / largo) ** 2);
  }
  g.computeVertexNormals(); return g;
}
function geometriaEntera(clave) {
  if (clave === 'platano') {
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.5, 0.55, 0), new THREE.Vector3(-0.8, -0.15, 0), new THREE.Vector3(0, -0.4, 0),
      new THREE.Vector3(0.8, -0.15, 0), new THREE.Vector3(1.5, 0.6, 0)]);
    return soldarNormales(tuboAfilado(curva, 80, 40, 0.42));
  }
  const g = new THREE.SphereGeometry(1, 72, 48);
  if (clave === 'pina') g.scale(0.82, 1.15, 0.82);
  if (clave === 'mango') {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + 0.18 * y) + 0.12 * y * y); }
    g.scale(0.78, 1.05, 0.68); g.computeVertexNormals(); soldarNormales(g);
  }
  return g;
}
// Deja el trozo acostado (normal media hacia +Y) y con el pivote en su centro. Un parche
// de esfera nace a una distancia r de su origen: sin esto, al girar orbita y se sale del líquido.
function centrarFragmento(g) {
  const normales = g.attributes.normal, media = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < normales.count; i++) media.add(n.fromBufferAttribute(normales, i));
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(media.normalize(), new THREE.Vector3(0, 1, 0)));
  g.center(); g.computeBoundingSphere();
  return g;
}
function geometriaFragmento(clave) {
  if (clave === 'platano') return centrarFragmento(tiraCurva(rnd(0.7, 1.0), 0.32, rnd(1.6, 2.4), rnd(0.05, 0.2)));
  const r = clave === 'pina' ? 0.42 : 0.36;
  const g = new THREE.SphereGeometry(r, 24, 16, rnd(0, 6), rnd(1.2, 1.9), rnd(0.6, 1.0), rnd(0.8, 1.2));
  if (clave === 'mango') g.scale(1.1, 0.85, 1);
  return centrarFragmento(g);
}
// Punto más alto del trozo respecto a su pivote, con la orientación dada.
function alturaSobrePivote(geo, rotacion) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  let alto = -Infinity;
  for (let i = 0; i < p.count; i++) alto = Math.max(alto, v.fromBufferAttribute(p, i).applyEuler(rotacion).y);
  return alto;
}
// Amplitud del vaivén de un trozo; con actividad = 1 es la mayor posible.
const agitacion = (flota, actividad) => flota ? 0.02 + 0.03 * actividad : 0.04 + 0.1 * actividad;
const HOLGURA = 0.03; // separación mínima con la superficie, la pared y el fondo

// ---------- materiales propios del reactor ----------
// Líquido: absorción tipo Beer-Lambert. El trayecto óptico es mayor al centro del
// cilindro, así que el color se satura ahí y se aclara en los bordes.
// No pasa por tone mapping: el color en pantalla coincide con la escala del indicador.
function materialLiquido() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color('#f6b302') }, uTurbio: { value: new THREE.Color('#e9dfc6') }, uTurb: { value: 0.3 }, uHover: { value: 0 }, uAlto: { value: 2.2 } },
    vertexShader: /* glsl */`
      varying vec3 vN, vV; varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uTurbio; uniform float uTurb, uHover, uAlto;
      varying vec3 vN, vV; varying float vY;
      void main() {
        float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        float h = vY / uAlto + 0.5;                       // 0 fondo · 1 superficie
        float camino = pow(ndv, 0.75);
        float absorcion = 1.0 - exp(-(1.5 + 1.4 * uTurb) * camino);
        vec3 col = mix(mix(uColor, vec3(1.0), 0.06), uColor * 0.86, absorcion);
        col = mix(col, uTurbio, uTurb * 0.1 * (1.0 - 0.6 * h)); // la levadura se acumula abajo
        float borde = pow(1.0 - ndv, 3.0);
        col += borde * 0.1 + uHover * 0.06;
        float alfa = mix(0.76, 0.88, absorcion) + 0.06 * uTurb;
        gl_FragColor = vec4(col, clamp(alfa, 0.0, 0.92));
        #include <colorspace_fragment>
      }`
  });
}
// Vidrio sobre fondo claro: se dibuja por sus bordes oscuros y un reflejo vertical.
// (transmission no sirve aquí: un objeto transmisivo no ve a otro y escondía el líquido.)
function materialVidrio(lado = THREE.FrontSide) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, side: lado,
    vertexShader: /* glsl */`
      varying vec3 vN, vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vN, vV;
      void main() {
        vec3 N = normalize(vN);
        float f = pow(1.0 - abs(dot(N, normalize(vV))), 2.4);
        float reflejo = smoothstep(-0.66, -0.6, N.x) * smoothstep(-0.42, -0.48, N.x) * step(0.0, N.z);
        vec3 col = mix(vec3(0.27, 0.34, 0.33), vec3(1.0), reflejo);
        gl_FragColor = vec4(col, clamp(f * 0.7 + 0.03 + reflejo * 0.42, 0.0, 0.85));
        #include <colorspace_fragment>
      }`
  });
}
// Burbuja: casi invisible al centro, con borde brillante y un punto de luz
function materialBurbuja() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: /* glsl */`
      varying vec3 vN, vV;
      void main() {
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vN, vV;
      void main() {
        vec3 N = normalize(vN), V = normalize(vV);
        float borde = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);
        float brillo = smoothstep(0.93, 0.97, dot(N, normalize(vec3(-0.45, 0.6, 0.66))));
        gl_FragColor = vec4(vec3(1.0), clamp(0.07 + borde * 0.8 + brillo, 0.0, 0.95));
        #include <colorspace_fragment>
      }`
  });
}
function texturaSombra() {
  const [c, x] = lienzo(256, 256);
  const g = x.createRadialGradient(128, 128, 30, 128, 128, 128);
  g.addColorStop(0, 'rgba(23,33,29,0.42)'); g.addColorStop(0.55, 'rgba(23,33,29,0.16)'); g.addColorStop(1, 'rgba(23,33,29,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
function texturaManchas(n, rMin, rMax) { // espuma y velo superficial
  const [c, x] = lienzo(); x.clearRect(0, 0, 512, 512);
  ruido(x, 512, 512, n, ['#ffffff'], rMin, rMax, 0.8);
  return new THREE.CanvasTexture(c);
}

// =====================================================================
export class Reactor3D {
  constructor(contenedor, { alHover } = {}) {
    this.el = contenedor;
    this.alHover = alHover || (() => {});
    this.vista = 'reactor';
    this.estado = { T: 28, pH: 5, sellado: true, actividad: 0.5, turbidez: 0.3, colorLiquido: '#f6b302', cascara: null };
    this.reloj = new THREE.Clock();
    this.uCascara = hojaUniformes();
    this.visible = true;

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, CALIDAD.pixeles));
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1;
    contenedor.prepend(r.domElement);

    this.escena = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose(); // la textura se queda; lo que libera son sus búferes de trabajo
    this.escena.environmentIntensity = 0.55;

    this.camara = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.controles = new OrbitControls(this.camara, r.domElement);
    Object.assign(this.controles, { enableDamping: true, enablePan: false, minDistance: 4, maxDistance: 16, maxPolarAngle: Math.PI * 0.56, autoRotate: true, autoRotateSpeed: 0.5 });

    this.escena.add(new THREE.HemisphereLight(0xffffff, 0xc8cdc4, 1.1));
    const sol = new THREE.DirectionalLight(0xfffaf0, 1.5); sol.position.set(3, 6, 4); this.escena.add(sol);
    this.luzBase = new THREE.PointLight(0xffffff, 0, 5, 1.4); this.luzBase.position.set(0, -1.2, 0); this.escena.add(this.luzBase);

    this.texturas = {};
    this._construirReactor();
    this.grupoExhibe = new THREE.Group(); this.grupoExhibe.visible = false; this.escena.add(this.grupoExhibe);
    this._ponerCamara();
    this._prepararHover();

    new ResizeObserver(() => this._ajustar()).observe(contenedor);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(contenedor);
    this._ajustar();
    this._ultimoCuadro = 0;
    r.setAnimationLoop(ahora => this._animar(ahora));
  }

  _tex(clave) { return this.texturas[clave] ??= TEXTURAS[clave](); }
  _materiales(clave, escala, hundir) {
    const t = this._tex(clave);
    const ext = conDeterioro(new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: t.bumpScale, roughness: t.rough, side: THREE.FrontSide }), this.uCascara, escala, hundir);
    const int = conDeterioro(new THREE.MeshStandardMaterial({ color: t.interior, roughness: 0.85, side: THREE.BackSide }), this.uCascara, escala, hundir);
    return [ext, int];
  }

  _construirReactor() {
    const g = this.grupoReactor = new THREE.Group(); this.escena.add(g);
    const H = 3, R = 1.25;
    this.altoLiquido = 2.2;
    this.yTope = -H / 2 + this.altoLiquido;
    this.yFondo = -H / 2;
    this.radioLiquido = R - 0.04;

    // sombra de contacto: asienta el equipo sobre la página
    const sombra = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: texturaSombra(), transparent: true, depthWrite: false, toneMapped: false }));
    sombra.rotation.x = -Math.PI / 2; sombra.position.y = -H / 2 - 0.325; sombra.renderOrder = -1; g.add(sombra);

    // líquido (mosto)
    this.matLiquido = materialLiquido();
    this.liquido = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.04, R - 0.04, this.altoLiquido, 96), this.matLiquido);
    this.liquido.position.y = -H / 2 + this.altoLiquido / 2 + 0.01; this.liquido.renderOrder = 1; g.add(this.liquido);

    // levadura en suspensión (turbidez)
    const nL = CALIDAD.levadura, pl = new Float32Array(nL * 3);
    for (let i = 0; i < nL; i++) { const a = rnd(0, 6.28), rr = Math.sqrt(Math.random()) * (R - 0.1); pl.set([Math.cos(a) * rr, rnd(-H / 2 + 0.05, this.yTope - 0.05), Math.sin(a) * rr], i * 3); }
    const gl = new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.BufferAttribute(pl, 3));
    this.levadura = new THREE.Points(gl, new THREE.PointsMaterial({ color: 0xfff6e0, size: 0.03, transparent: true, opacity: 0.3, depthWrite: false }));
    this.levadura.renderOrder = 2; g.add(this.levadura);

    // burbujas de CO2
    this.N_BURB = CALIDAD.burbujas;
    this.burbujas = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), materialBurbuja(), this.N_BURB);
    this.datosBurb = Array.from({ length: this.N_BURB }, () => this._nuevaBurbuja(true));
    this.burbujas.renderOrder = 3; this.burbujas.frustumCulled = false; g.add(this.burbujas);
    this._m4 = new THREE.Matrix4();

    // espuma (CO2) y velo de Acetobacter (solo sin sello)
    const disco = (tex, color) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(R - 0.05, 72), new THREE.MeshBasicMaterial({ color, alphaMap: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 4; g.add(m); return m;
    };
    this.espuma = disco(texturaManchas(700, 6, 22), 0xfffdf5); this.espuma.position.y = this.yTope + 0.014;
    this.velo = disco(texturaManchas(260, 14, 40), 0xd9d6c2); this.velo.position.y = this.yTope + 0.02;

    // vidrio
    const vidrio = materialVidrio();
    const vaso = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 96, 1, true), vidrio); vaso.renderOrder = 6; g.add(vaso);
    const vasoAtras = new THREE.Mesh(vaso.geometry, materialVidrio(THREE.BackSide)); vasoAtras.renderOrder = 0; g.add(vasoAtras);
    const labio = new THREE.Mesh(new THREE.TorusGeometry(R, 0.022, 10, 96), new THREE.MeshStandardMaterial({ color: 0xdfe5e0, roughness: 0.2 }));
    labio.rotation.x = Math.PI / 2; labio.position.y = H / 2; g.add(labio);

    // graduación grabada en el vidrio
    const marca = new THREE.MeshBasicMaterial({ color: 0x17211d, transparent: true, opacity: 0.55, toneMapped: false });
    for (let i = 0; i < 11; i++) {
      const larga = i % 5 === 0;
      const m = new THREE.Mesh(new THREE.BoxGeometry(larga ? 0.26 : 0.14, 0.012, 0.004), marca);
      const a = 1.35, y = -1.25 + i * 0.25;
      m.position.set(Math.sin(a) * (R + 0.004), y, Math.cos(a) * (R + 0.004)); m.rotation.y = a; m.renderOrder = 7; g.add(m);
    }

    // base calefactora
    this.matBase = new THREE.MeshStandardMaterial({ color: 0xc9cfc8, metalness: 0.15, roughness: 0.5 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.22, R + 0.32, 0.3, 96), this.matBase);
    base.position.y = -H / 2 - 0.16; g.add(base);
    this.anillo = new THREE.Mesh(new THREE.TorusGeometry(R + 0.235, 0.03, 12, 96), new THREE.MeshBasicMaterial({ color: 0x1c7a55, toneMapped: false }));
    this.anillo.rotation.x = Math.PI / 2; this.anillo.position.y = -H / 2 - 0.03; g.add(this.anillo);

    // tapa + trampa de agua (airlock)
    const tapa = this.tapa = new THREE.Group();
    const grafito = new THREE.MeshStandardMaterial({ color: 0x27302c, metalness: 0.25, roughness: 0.55 });
    tapa.add(new THREE.Mesh(new THREE.CylinderGeometry(R + 0.06, R + 0.06, 0.14, 96), grafito));
    const vidrioTrampa = new THREE.MeshStandardMaterial({ color: 0xe6efec, roughness: 0.08, transparent: true, opacity: 0.42, depthWrite: false });
    const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 16), vidrioTrampa); tubo.position.y = 0.36; tubo.renderOrder = 8; tapa.add(tubo);
    const bulbo = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), vidrioTrampa); bulbo.position.y = 0.75; bulbo.renderOrder = 8; tapa.add(bulbo);
    this.aguaTrampa = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8fc7d6, transparent: true, opacity: 0.8 }));
    this.aguaTrampa.position.y = 0.75; tapa.add(this.aguaTrampa);
    this.burbujaTrampa = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    tapa.add(this.burbujaTrampa);
    tapa.position.y = H / 2 + 0.07; g.add(tapa);

    this.grupoCascaras = new THREE.Group(); g.add(this.grupoCascaras);
  }

  _nuevaBurbuja(inicio = false) {
    const a = rnd(0, 6.28), rr = Math.sqrt(Math.random()) * 1.05;
    return { x: Math.cos(a) * rr, z: Math.sin(a) * rr, y: inicio ? rnd(-1.5, this.yTope ?? 0.7) : -1.45, v: rnd(0.5, 1.1), s: rnd(0.018, 0.05), f: rnd(0, 6.28) };
  }

  _liberar(grupo) {
    grupo.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [o.material].flat().forEach(m => m.dispose()); } });
    grupo.clear();
  }

  setFruta(clave) {
    this.clave = clave;
    // fragmentos dentro del reactor: parte flota justo bajo la superficie, como el "sombrero"
    // de un mosto real, y el resto queda suspendido. Ninguno sale del líquido: los límites
    // se calculan con el tamaño de cada trozo y el vaivén máximo.
    this._liberar(this.grupoCascaras); this.fragmentos = [];
    const [ext, int] = this._materiales(clave, 2.4, 0.02);
    for (let i = 0; i < 11; i++) {
      const geo = geometriaFragmento(clave), m = new THREE.Group();
      m.add(new THREE.Mesh(geo, ext), new THREE.Mesh(geo, int));
      const flota = i < 6, radio = geo.boundingSphere.radius, ag = agitacion(flota, 1);
      // orden YXZ: el giro en Y es el último, así que girar no cambia la altura de las que flotan
      m.rotation.order = 'YXZ';
      if (flota) m.rotation.set(rnd(-0.3, 0.3), rnd(0, 6), rnd(-0.3, 0.3));
      else m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
      const rrMax = this.radioLiquido - radio - ag * Math.SQRT2 - HOLGURA;
      const a = i / 6 * 6.28 + rnd(-0.3, 0.3), rr = flota ? rnd(0.35, rrMax) : rnd(0.1, rrMax);
      const yMax = this.yTope - ag * 0.6 - HOLGURA;
      const y = flota ? yMax - alturaSobrePivote(geo, m.rotation) - rnd(0, 0.1)
        : rnd(this.yFondo + radio + ag * 0.6 + HOLGURA, yMax - radio);
      m.userData = { x: Math.cos(a) * rr, z: Math.sin(a) * rr, y, fase: rnd(0, 6.28), flota, rot: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(0.25) };
      this.grupoCascaras.add(m); this.fragmentos.push(m);
    }
    // fruta entera en exhibición
    this._liberar(this.grupoExhibe);
    this.grupoExhibe.scale.setScalar(clave === 'platano' ? 0.74 : clave === 'pina' ? 0.8 : 1);
    this.grupoExhibe.position.y = clave === 'pina' ? -0.3 : 0;
    const [e2] = this._materiales(clave, 1, 0.09);
    this.grupoExhibe.add(new THREE.Mesh(geometriaEntera(clave), e2));
    const adorno = (color, rough = 0.7) => conDeterioro(new THREE.MeshStandardMaterial({ color, roughness: rough, side: THREE.DoubleSide }), this.uCascara, 1, 0);
    if (clave === 'pina') { // corona
      const hoja = adorno(0x3f7d2c, 0.6);
      for (let i = 0; i < 14; i++) {
        const h = new THREE.Mesh(new THREE.ConeGeometry(0.08, rnd(0.7, 1.1), 4), hoja);
        const a = i / 14 * 6.28; h.position.set(Math.cos(a) * 0.12, 1.45, Math.sin(a) * 0.12);
        h.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); h.scale.z = 0.35; this.grupoExhibe.add(h);
      }
    }
    if (clave === 'mango' || clave === 'naranja') {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.18, 8), adorno(0x4a3218));
      t.position.y = clave === 'mango' ? 1.1 : 1.02; this.grupoExhibe.add(t);
    }
    if (clave === 'platano') {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 8), adorno(0x5b4a1c));
      t.position.set(1.6, 0.78, 0); t.rotation.z = -0.6; this.grupoExhibe.add(t);
    }
  }

  setVista(v) {
    this.vista = v;
    this.grupoReactor.visible = v === 'reactor';
    this.grupoExhibe.visible = v === 'cascara';
    this._ponerCamara();
  }

  _ponerCamara() {
    const reactor = this.vista === 'reactor';
    this.controles.target.set(0, reactor ? -0.22 : 0, 0);
    this.camara.position.set(...(reactor ? [6.1, 2.6, 9.8] : [3, 1.2, 5.3]));
  }

  update(s) { Object.assign(this.estado, s); this._aplicarEstado(); }

  // Lo instantáneo se aplica aquí; color y deterioro se interpolan en _animar
  _aplicarEstado() {
    const { T, sellado } = this.estado;
    const tc = T < 25 ? new THREE.Color(0x2e6fbf) : T <= 30 ? new THREE.Color(0x1c7a55) : new THREE.Color(0xe2700c).lerp(new THREE.Color(0xc8102e), Math.min(1, (T - 30) / 15));
    this.anillo.material.color.copy(tc);
    this.luzBase.color.copy(tc); this.luzBase.intensity = T > 30 ? 2 + (T - 30) * 0.2 : T < 25 ? 1.6 : 0.7;
    this.tapa.position.set(sellado ? 0 : 0.95, sellado ? 1.57 : 1.86, 0);
    this.tapa.rotation.z = sellado ? 0 : -0.34;
  }

  _prepararHover() {
    const rayo = new THREE.Raycaster(), p = new THREE.Vector2(), dom = this.renderer.domElement;
    let arrastrando = false;
    const soltar = () => {
      if (!this.hover) return;
      this.hover = null; dom.style.cursor = ''; this.controles.autoRotate = true; this.alHover(null);
    };
    dom.addEventListener('pointerdown', () => { arrastrando = true; soltar(); });
    window.addEventListener('pointerup', () => { arrastrando = false; });
    dom.addEventListener('pointerleave', soltar);
    dom.addEventListener('pointermove', ev => {
      if (arrastrando) return;
      const b = dom.getBoundingClientRect();
      p.set((ev.clientX - b.left) / b.width * 2 - 1, -(ev.clientY - b.top) / b.height * 2 + 1);
      rayo.setFromCamera(p, this.camara);
      const reactor = this.vista === 'reactor';
      const blanco = reactor ? [this.liquido] : this.grupoExhibe.children;
      if (!rayo.intersectObjects(blanco, false).length) return soltar();
      this.hover = reactor ? 'liquido' : 'cascara';
      dom.style.cursor = 'help'; this.controles.autoRotate = false;
      this.alHover({ tipo: this.hover, x: ev.clientX, y: ev.clientY });
    });
  }

  _ajustar() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h;
    // en lienzos angostos se abre el campo para que el reactor no se corte
    this.camara.fov = this.camara.aspect < 0.9 ? 30 / Math.max(0.55, this.camara.aspect / 0.9) : 30;
    this.camara.updateProjectionMatrix();
  }

  // Si el equipo no alcanza 24 cuadros/s, baja la resolución poco a poco hasta 1×.
  // Una pausa larga (pestaña oculta, reactor fuera de vista) no cuenta como lentitud.
  _vigilarFluidez(ahora) {
    const pausa = ahora - this._ultimoCuadro > 500;
    this._ultimoCuadro = ahora;
    if (pausa) { this._inicioLapso = ahora; this._cuadros = 0; return; }
    this._cuadros++;
    const lapso = ahora - this._inicioLapso;
    if (lapso < 2000) return;
    const fps = this._cuadros * 1000 / lapso, resolucion = this.renderer.getPixelRatio();
    this._inicioLapso = ahora; this._cuadros = 0;
    if (fps < 24 && resolucion > 1) this.renderer.setPixelRatio(Math.max(1, resolucion - 0.25));
  }

  _animar(ahora) {
    if (!this.visible || ahora - this._ultimoCuadro < CALIDAD.msCuadro) return;
    this._vigilarFluidez(ahora);
    const dt = Math.min(0.05, this.reloj.getDelta()), t = this.reloj.elapsedTime;
    const { actividad, T, turbidez, cascara, sellado } = this.estado;
    const k = 1 - Math.exp(-dt * 5); // transición suave entre condiciones
    this.controles.update();

    if (cascara) {
      const u = this.uCascara, ir = (n, v) => { u[n].value += (v - u[n].value) * k; };
      ir('uPardeo', cascara.pardeamiento); ir('uEscaldado', cascara.escaldado); ir('uDecolor', cascara.decoloracion);
      ir('uOxidacion', cascara.oxidacion); ir('uMoho', cascara.moho); ir('uArruga', cascara.arrugado);
    }

    if (this.vista === 'cascara') { this.grupoExhibe.rotation.y += dt * (this.hover ? 0 : 0.25); }
    else {
      const L = this.matLiquido.uniforms;
      this._cObjetivo ??= new THREE.Color();
      L.uColor.value.lerp(this._cObjetivo.set(this.estado.colorLiquido), k);
      L.uTurb.value += (turbidez - L.uTurb.value) * k;
      L.uHover.value += ((this.hover ? 1 : 0) - L.uHover.value) * k;
      this.levadura.material.opacity = 0.12 + L.uTurb.value * 0.7;
      this.espuma.material.opacity += (Math.min(0.55, actividad * 0.7) - this.espuma.material.opacity) * k;
      this.velo.material.opacity += ((cascara?.moho ?? 0) * 0.8 - this.velo.material.opacity) * k;

      // burbujas: cantidad ∝ actividad metabólica, velocidad ∝ temperatura
      const activas = Math.round(this.N_BURB * Math.min(1, actividad));
      const vel = 0.5 + Math.max(0, Math.min(45, T)) / 30;
      for (let i = 0; i < this.N_BURB; i++) {
        const b = this.datosBurb[i];
        if (i < activas) {
          b.y += b.v * vel * dt;
          if (b.y > this.yTope) Object.assign(b, this._nuevaBurbuja());
          const s = b.s * (1 + (b.y + 1.5) * 0.25);
          this._m4.makeScale(s, s, s).setPosition(b.x + Math.sin(t * 3 + b.f) * 0.02, b.y, b.z);
        } else this._m4.makeScale(0, 0, 0);
        this.burbujas.setMatrixAt(i, this._m4);
      }
      this.burbujas.instanceMatrix.needsUpdate = true;
      // trampa de agua
      const ciclo = (t * (0.4 + actividad * 2.5)) % 1;
      this.burbujaTrampa.visible = sellado && actividad > 0.08;
      this.burbujaTrampa.position.set(0, 0.62 + ciclo * 0.25, 0);
      // cáscaras: las burbujas las agitan; el tejido blando se encoge
      const esc = 1 - 0.3 * (cascara?.arrugado ?? 0);
      (this.fragmentos || []).forEach(f => {
        const u = f.userData, ag = agitacion(u.flota, actividad);
        f.position.set(u.x + Math.sin(t * 0.7 + u.fase) * ag, u.y + Math.sin(t * 1.1 + u.fase) * ag * 0.6, u.z + Math.cos(t * 0.6 + u.fase) * ag);
        if (!u.flota) f.rotation.x += u.rot.x * dt * (0.3 + actividad);
        f.rotation.y += u.rot.y * dt * (0.3 + actividad);
        f.scale.setScalar(esc);
      });
    }
    this.renderer.render(this.escena, this.camara);
  }
}

export function webglDisponible() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
