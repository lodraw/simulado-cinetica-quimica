// =====================================================================
//  MODELO CINÉTICO SEMI-EMPÍRICO (con fines didácticos)
//  Rendimiento = Eficiencia_fruta × f(T) × f(pH) × f(t) × f(O₂)
//  El 100 % corresponde al máximo ESTEQUIOMÉTRICO:
//  C6H12O6 → 2 C2H5OH + 2 CO2   ⇒  0.511 g de etanol por g de glucosa
// =====================================================================

export const MASA_MOLAR = { glucosa: 180.16, etanol: 46.07, co2: 44.01 };
export const Y_MAX = (2 * MASA_MOLAR.etanol) / MASA_MOLAR.glucosa; // 0.5114 g/g
export const DENSIDAD_ETANOL = 0.789;   // g/mL a 20 °C
export const VOLUMEN_MOLAR = 24.47;     // L/mol a 25 °C y 1 atm

// efic: % del máximo estequiométrico alcanzable (valores ILUSTRATIVOS)
// pardeo: qué tan rápido se oscurece la cáscara (ILUSTRATIVO; el plátano es el más sensible)
export const FRUTAS = {
  naranja: { nombre: 'Cáscara de Naranja', corto: 'Naranja', efic: 90, resPH: 1.0, sensT: 1.0, vel: 1.0, pardeo: 0.75,
    nota: 'Rica en azúcares solubles y pectina. Contiene D-limoneno, que en exceso inhibe a la levadura.' },
  platano: { nombre: 'Cáscara de Plátano', corto: 'Plátano', efic: 85, resPH: 0.8, sensT: 1.2, vel: 0.85, pardeo: 1.3,
    nota: 'Alto contenido de almidón: requiere más hidrólisis, por eso fermenta más lento.' },
  pina:    { nombre: 'Cáscara de Piña',    corto: 'Piña',    efic: 80, resPH: 1.4, sensT: 0.9, vel: 1.2, pardeo: 0.85,
    nota: 'Medio naturalmente ácido y rico en sacarosa: tolera mejor el pH bajo y arranca más rápido.' },
  mango:   { nombre: 'Cáscara de Mango',   corto: 'Mango',   efic: 75, resPH: 0.9, sensT: 1.1, vel: 0.95, pardeo: 1.0,
    nota: 'Más fibra (celulosa/lignina) y menos azúcar libre; más sensible a la temperatura.' }
};

export const RANGOS = { temp: { lo: 25, hi: 30 }, ph: { lo: 4.5, hi: 5.5 }, dias: { lo: 4, hi: 8 } };

// Constantes de las curvas de respuesta (ILUSTRATIVAS). La sección "El modelo" de la página las lee de aquí.
export const PARAM = { sigmaFrio: 6, sigmaCalor: 3.5, sigmaPH: 1.6, kLog: 1.3, t0: 3.2, kO2: 0.22, tO2: 2 };

export function factorTemp(T, clave) {
  const s = FRUTAS[clave].sensT;
  let d, sigma;
  if (T < RANGOS.temp.lo)      { d = RANGOS.temp.lo - T; sigma = PARAM.sigmaFrio / s; }   // frío: se ralentiza
  else if (T > RANGOS.temp.hi) { d = T - RANGOS.temp.hi; sigma = PARAM.sigmaCalor / s; } // calor: desnaturaliza (más brusco)
  else return 1;
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}

export function factorPH(pH, clave) {
  const r = FRUTAS[clave].resPH;
  let d;
  if (pH < RANGOS.ph.lo)      d = (RANGOS.ph.lo - pH) / r;
  else if (pH > RANGOS.ph.hi) d = (pH - RANGOS.ph.hi) * r;
  else return 1;
  return Math.exp(-(d * d) / (2 * PARAM.sigmaPH ** 2));
}

// Curva logística de crecimiento/producción
const L = (t, vel) => 1 / (1 + Math.exp(-PARAM.kLog * (t * vel - PARAM.t0)));
export const diaCompleto = clave => RANGOS.dias.hi / FRUTAS[clave].vel;

export function factorTiempo(dias, clave) {
  const vel = FRUTAS[clave].vel, tF = diaCompleto(clave);
  if (dias >= tF) return 1;
  return Math.min(1, L(dias, vel) / L(tF, vel));
}

// Actividad metabólica instantánea (derivada normalizada de la logística, 0–1)
export function actividad(dias, clave) {
  if (dias >= diaCompleto(clave)) return 0.04; // fase estacionaria: residual
  const l = L(dias, FRUTAS[clave].vel);
  return 4 * l * (1 - l);
}

// Sin sello hermético: Acetobacter oxida etanol → ácido acético (CH3COOH)
export function factorOxigeno(dias, sellado) {
  if (sellado) return 1;
  return Math.exp(-PARAM.kO2 * Math.max(0, dias - PARAM.tO2));
}

export function faseCrecimiento(dias, clave, sellado) {
  if (!sellado && dias > 3) return { id: 'acet', nombre: 'Acetificación', desc: 'El O₂ permite oxidar el etanol a ácido acético.' };
  if (dias >= diaCompleto(clave)) return { id: 'est', nombre: 'Estacionaria', desc: 'Azúcares agotados; la producción se estabiliza.' };
  const l = L(dias, FRUTAS[clave].vel);
  if (l < 0.15) return { id: 'lag', nombre: 'Latencia (lag)', desc: 'La levadura se adapta al medio; casi no hay etanol.' };
  if (l < 0.85) return { id: 'exp', nombre: 'Exponencial', desc: 'Máxima velocidad: abundante CO₂ y etanol.' };
  return { id: 'des', nombre: 'Desaceleración', desc: 'El sustrato escasea y el etanol empieza a inhibir.' };
}

export function calcular(clave, T, pH, dias, sellado = true) {
  const fT = factorTemp(T, clave);
  const fP = factorPH(pH, clave);
  const fD = factorTiempo(dias, clave);
  const fO = factorOxigeno(dias, sellado);
  const rendimientoFermentacion = FRUTAS[clave].efic * fT * fP * fD; // lo fermentado, antes de la acetificación
  const rendimiento = rendimientoFermentacion * fO;
  const act = actividad(dias, clave) * fT * fP * (sellado ? 1 : 0.6);
  // Turbidez: biomasa de levadura en suspensión; si la levadura no crece, el medio sigue claro (ILUSTRATIVO)
  const turbidez = 0.08 + 0.72 * fD * fT * fP;
  return { fT, fP, fD, fO, rendimiento, rendimientoFermentacion, actividad: act, turbidez, gPorG: Y_MAX * rendimiento / 100 };
}

// La acetificación consume etanol pero no retira el CO2 ya liberado: el etanol sale del
// rendimiento final y el CO2 de lo que se fermentó. Con sello ambos coinciden.
export function estequiometria(gAzucar, rendimiento, rendimientoFermentacion = rendimiento) {
  const n = gAzucar / MASA_MOLAR.glucosa;
  const nEt = 2 * n * rendimiento / 100, nCO2 = 2 * n * rendimientoFermentacion / 100;
  const gEt = nEt * MASA_MOLAR.etanol;
  return {
    nGlucosa: n,
    gEtanolTeo: 2 * n * MASA_MOLAR.etanol,
    nEtanol: nEt, gEtanol: gEt, mlEtanol: gEt / DENSIDAD_ETANOL,
    nCO2, gCO2: nCO2 * MASA_MOLAR.co2, lCO2: nCO2 * VOLUMEN_MOLAR
  };
}

// =====================================================================
//  INDICADOR UNIVERSAL · color del líquido (ayuda visual)
//  Colores aproximados de la escala comercial; el mosto real no se tiñe solo.
// =====================================================================
export const INDICADOR = [
  [1, '#c8102e'], [3, '#ea4f12'], [4, '#f58a07'], [5.5, '#f6c800'], [7, '#2f9e44'],
  [8.5, '#0f9aa8'], [10, '#1c6fd1'], [12, '#3a3fb0'], [14, '#6f1fa0']
];

const aRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export function colorPH(pH) {
  const x = Math.min(14, Math.max(1, pH));
  const i = Math.max(0, INDICADOR.findIndex(([p]) => p >= x) - 1);
  const [a, ca] = INDICADOR[i], [b, cb] = INDICADOR[i + 1];
  const t = (x - a) / (b - a), A = aRGB(ca), B = aRGB(cb);
  return '#' + A.map((v, k) => Math.round(v + (B[k] - v) * t).toString(16).padStart(2, '0')).join('');
}

const BANDAS_PH = [
  { hasta: 3,    color: 'Rojo',             medio: 'Fuertemente ácido',  texto: 'El exceso de H⁺ desnaturaliza proteínas de membrana y frena el transporte de glucosa: la levadura casi no fermenta.' },
  { hasta: 4.5,  color: 'Naranja',          medio: 'Ácido',              texto: 'Más ácido que el óptimo. La levadura sobrevive, pero gasta energía expulsando H⁺ y fermenta más lento.' },
  { hasta: 5.5,  color: 'Ámbar',            medio: 'Levemente ácido · zona óptima', texto: 'Condición ideal: favorece a S. cerevisiae y limita a las bacterias contaminantes.' },
  { hasta: 6.5,  color: 'Amarillo verdoso', medio: 'Poco ácido',         texto: 'Arriba del óptimo. La levadura aún trabaja, pero las bacterias empiezan a competir por el azúcar.' },
  { hasta: 7.5,  color: 'Verde',            medio: 'Neutro',             texto: 'Sin la protección de la acidez: el medio favorece a bacterias contaminantes.' },
  { hasta: 9.2,  color: 'Turquesa',         medio: 'Alcalino',           texto: 'Medio básico, lejos del óptimo de la levadura; baja la eficiencia de sus enzimas.' },
  { hasta: 11,   color: 'Azul',             medio: 'Muy alcalino',       texto: 'Las enzimas de la levadura pierden actividad y casi no se produce etanol.' },
  { hasta: 15,   color: 'Violeta',          medio: 'Fuertemente alcalino', texto: 'Condición extrema: daña la pared y la membrana celular; la fermentación se detiene.' }
];
export const interpretarPH = pH => BANDAS_PH.find(b => pH <= b.hasta);

// =====================================================================
//  ESTADO DE LA CÁSCARA · gobierna las texturas 3D (todo 0–1, ILUSTRATIVO)
//  Tendencias cualitativas, no mediciones: no entra en el rendimiento.
// =====================================================================
const limitar = x => Math.min(1, Math.max(0, x));
const paso = (a, b, x) => { const t = limitar((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function estadoCascara(clave, T, pH, dias, sellado) {
  // Regla de van 't Hoff (Q10 ≈ 2): el deterioro se duplica cada 10 °C
  const q10 = 2 ** ((Math.min(T, 40) - 28) / 10);
  const desgaste = 1 - Math.exp(-dias * q10 / 6);
  const pardeamiento = limitar(desgaste * (sellado ? 0.6 : 1) * FRUTAS[clave].pardeo);
  const escaldado = paso(34, 48, T);
  const decoloracion = paso(4.2, 1.5, pH) * (0.45 + 0.55 * desgaste);
  const oxidacion = paso(7, 10.5, pH) * (0.45 + 0.55 * desgaste);
  const moho = sellado ? 0 : paso(2, 7, dias) * paso(8, 18, T) * (1 - paso(36, 44, T)) * paso(1.5, 3, pH) * (1 - paso(8.5, 11, pH));
  const arrugado = limitar(0.55 * desgaste + 0.7 * escaldado + 0.35 * decoloracion + 0.35 * oxidacion);

  const efectos = [
    { id: 'pardeamiento', valor: pardeamiento, nombre: 'Pardeamiento enzimático', porque: 'La polifenol oxidasa convierte fenoles en quinonas, que forman melaninas pardas. Necesita $\\ce{O2}$, por eso avanza más sin sello.' },
    { id: 'escaldado', valor: escaldado, nombre: 'Escaldado por calor', porque: 'El calor daña las membranas y degrada los pigmentos: el tejido se ve cocido y opaco.' },
    { id: 'decoloracion', valor: decoloracion, nombre: 'Decoloración ácida', porque: 'El medio muy ácido hidroliza pectina y hemicelulosa y degrada pigmentos: la cáscara palidece.' },
    { id: 'oxidacion', valor: oxidacion, nombre: 'Oxidación alcalina', porque: 'En medio básico los fenoles se autooxidan rápido y la pectina se despolimeriza: manchas oscuras y superficie viscosa.' },
    { id: 'moho', valor: moho, nombre: 'Moho aerobio', porque: 'Con $\\ce{O2}$ crecen hongos filamentosos: colonias verdosas con borde blanco.' },
    { id: 'arrugado', valor: arrugado, nombre: 'Pérdida de turgencia', porque: 'La pared celular se degrada y el tejido se ablanda y se arruga.' }
  ].filter(e => e.valor >= 0.08).sort((a, b) => b.valor - a.valor);

  return {
    pardeamiento, escaldado, decoloracion, oxidacion, moho, arrugado, desgaste, efectos,
    nota: T < 20 ? 'Con frío el deterioro va más lento (regla $Q_{10}$): la cáscara se conserva.' : ''
  };
}
