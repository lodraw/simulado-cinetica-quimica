import '@fontsource/schibsted-grotesk/latin-400.css';
import '@fontsource/schibsted-grotesk/latin-500.css';
import '@fontsource/schibsted-grotesk/latin-600.css';
import '@fontsource/newsreader/latin-500.css';
import './style.css';
import Chart from 'chart.js/auto';
import { FRUTAS, RANGOS, PARAM, INDICADOR, MASA_MOLAR, DENSIDAD_ETANOL, VOLUMEN_MOLAR, Y_MAX, calcular, faseCrecimiento, estequiometria, diaCompleto, colorPH, interpretarPH, estadoCascara } from './modelo.js';
import { Reactor3D, webglDisponible } from './reactor3d.js';
import { tex, ponerTex, conTex, renderizarEstaticos } from './tex.js';

const $ = id => document.getElementById(id);
const claves = Object.keys(FRUTAS);
const css = nombre => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

// Paleta categórica validada para daltonismo (todas las parejas). No se reordena.
const COLOR_FRUTA = { naranja: '#e2700c', platano: '#2e6fbf', pina: '#14907a', mango: '#a3245c' };

const ESCENARIOS = {
  optimo:   { temp: 28, ph: 5.0, dias: 6,   sellado: true },
  frio:     { temp: 12, ph: 5.0, dias: 6,   sellado: true },
  caliente: { temp: 42, ph: 5.0, dias: 6,   sellado: true },
  acido:    { temp: 28, ph: 2.5, dias: 6,   sellado: true },
  alcalino: { temp: 28, ph: 8.5, dias: 6,   sellado: true },
  corto:    { temp: 28, ph: 5.0, dias: 2,   sellado: true },
  oxigeno:  { temp: 28, ph: 5.0, dias: 8,   sellado: false }
};

const ETAPAS = [
  { t: 'Acondicionado', d: 'Lavado de las cáscaras para retirar impurezas o pesticidas; triturado y secado para aumentar el área de superficie expuesta.' },
  { t: 'Pretratamiento', d: 'Ruptura de la pared celular (celulosa, hemicelulosa y lignina) por cocción en agua o con ácido diluido (cítrico o sulfúrico).' },
  { t: 'Hidrólisis', d: 'Enzimas (celulasa) o ácidos diluidos rompen los carbohidratos complejos en azúcares simples: la celulosa da glucosa y la sacarosa da glucosa y fructosa.',
    r: ['\\ce{(C6H10O5)_{$n$} + $n$ H2O -> $n$ C6H12O6}', '\\ce{C12H22O11 + H2O ->}\\ \\underset{\\text{glucosa}}{\\ce{C6H12O6}} + \\underset{\\text{fructosa}}{\\ce{C6H12O6}}'] },
  { t: 'Fermentación', d: 'Inoculación con 10–25 g/L de levadura, contenedor sellado con trampa de agua para liberar $\\ce{CO2}$. Es la etapa que modela este simulador.', r: ['\\ce{C6H12O6 -> 2 C2H5OH + 2 CO2}'], actual: true },
  { t: 'Destilación', d: 'El etanol (p. eb. 78.4 °C) se evapora antes que el agua (100 °C); se condensa en un refrigerante. El mosto llega a ~10–15 % de etanol.' },
  { t: 'Combustión', d: 'Uso del bioetanol como combustible. El $\\ce{CO2}$ liberado es el que la planta absorbió al crecer (ciclo corto de carbono).', r: ['\\ce{C2H5OH + 3 O2 -> 2 CO2 + 3 H2O}'] }
];

// ---------- formato para LaTeX ----------
const num = (n, d = 2) => n.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/,/g, '{,}');
const u = texto => `\\ \\text{${texto}}`;
function cientifica(x) { // 3.2e-5 → 3.2 × 10⁻⁵
  const e = Math.floor(Math.log10(x)), m = x / 10 ** e;
  return `${m.toFixed(1)}\\times 10^{${e}}`;
}

function iniciar() {
  renderizarEstaticos();
  const el = { fruta: $('fruta'), temp: $('temp'), ph: $('ph'), dias: $('dias'), sellado: $('sellado') };
  let ultimo = null; // último cálculo, lo usa el tooltip del 3D

  // ---------- tooltip único (no lo recortan los paneles y admite LaTeX) ----------
  const tip = $('tip');
  function ponerTip(html, x, y) {
    if (tip._html !== html) { tip._html = html; tip.innerHTML = html; }
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight, m = 12;
    tip.style.left = Math.max(m, Math.min(innerWidth - w - m, x + 18)) + 'px';
    tip.style.top = (y + h + 24 > innerHeight ? Math.max(m, y - h - 16) : y + 18) + 'px';
  }
  const quitarTip = () => { tip.hidden = true; };
  document.querySelectorAll('.info').forEach(i => {
    const ver = () => { const b = i.getBoundingClientRect(); ponerTip(`<p>${conTex(i.dataset.tip)}</p>`, b.left, b.bottom - 8); };
    i.addEventListener('mouseenter', ver); i.addEventListener('focus', ver);
    i.addEventListener('mouseleave', quitarTip); i.addEventListener('blur', quitarTip);
    i.addEventListener('click', ev => ev.preventDefault()); // dentro del <label> del sello no debe cambiar el switch
  });

  function tipLiquido() {
    const { pH, r, clave } = ultimo, b = interpretarPH(pH), h = 10 ** -pH;
    return `<div class="tip-cab"><i style="background:${colorPH(pH)}"></i><b>${b.color}</b><span>${b.medio}</span></div>
      <p>${b.texto}</p>
      <div class="tip-eq">${tex(`[\\ce{H3O+}] = 10^{-${pH.toFixed(1)}} = ${cientifica(h)}${u('mol/L')}`)}</div>
      <div class="tip-eq">${tex(`f_{\\mathrm{pH}} = ${r.fP.toFixed(2)}`)} <small>para ${FRUTAS[clave].corto.toLowerCase()}</small></div>
      <p class="tip-pie">Turbidez ${(r.turbidez * 100).toFixed(0)} %: levadura en suspensión. El color simula un indicador universal; el mosto real no se tiñe solo.</p>`;
  }
  function tipCascara() {
    const { c } = ultimo;
    const lista = c.efectos.length
      ? c.efectos.slice(0, 3).map(e => `<li><b>${e.nombre}</b> ${conTex(e.porque)}</li>`).join('')
      : '<li><b>Cáscara fresca.</b> Todavía sin deterioro visible.</li>';
    return `<div class="tip-cab"><b>Qué le pasa a la cáscara</b></div><ul>${lista}</ul>${c.nota ? `<p class="tip-pie">${conTex(c.nota)}</p>` : ''}`;
  }

  // ---------- 3D ----------
  let reactor = null;
  if (webglDisponible()) {
    try {
      reactor = new Reactor3D($('lienzo3d'), {
        alHover: h => h ? ponerTip(h.tipo === 'liquido' ? tipLiquido() : tipCascara(), h.x, h.y) : quitarTip()
      });
    } catch (e) { console.error(e); }
  }
  if (!reactor) $('sinWebgl').hidden = false;

  // ---------- bandas ideales y escala del indicador ----------
  const banda = (id, lo, hi, min, max) => { const b = $(id); b.style.left = (lo - min) / (max - min) * 100 + '%'; b.style.width = (hi - lo) / (max - min) * 100 + '%'; };
  banda('bandaTemp', RANGOS.temp.lo, RANGOS.temp.hi, 0, 50);
  banda('bandaPh', RANGOS.ph.lo, RANGOS.ph.hi, 1, 14);
  banda('bandaDias', RANGOS.dias.lo, RANGOS.dias.hi, 1, 10);
  banda('escalaOptimo', RANGOS.ph.lo, RANGOS.ph.hi, 1, 14);
  const degradado = 'linear-gradient(90deg,' + INDICADOR.map(([p, c]) => `${c} ${(p - 1) / 13 * 100}%`).join(',') + ')';
  $('escalaBarra').style.background = degradado;
  $('pistaPh').style.setProperty('--escala', degradado);

  const chip = (id, estado, texto) => { const c = $(id); c.className = 'chip ' + estado; c.textContent = texto; };
  const claseFactor = f => f >= 0.9 ? 'ok' : f >= 0.5 ? 'warn' : 'bad';

  // ---------- gráficas ----------
  const tinta = css('--tinta'), tenue = css('--tenue'), linea = css('--linea'), hoja = css('--hoja');
  Chart.defaults.color = tenue;
  Chart.defaults.font.family = "'Schibsted Grotesk', sans-serif";
  Chart.defaults.font.size = 13;
  Chart.defaults.borderColor = linea;
  const tooltip = { backgroundColor: hoja, titleColor: tinta, bodyColor: tinta, borderColor: linea, borderWidth: 1, padding: 12, boxPadding: 6, cornerRadius: 4, usePointStyle: true };

  // Etiquetas directas: el valor sobre cada barra y el nombre al final de cada curva
  const etiquetas = {
    id: 'etiquetas',
    afterDatasetsDraw(chart) {
      const c = chart.ctx; c.save(); c.fillStyle = tinta; c.font = `500 ${Chart.defaults.font.size}px 'Schibsted Grotesk', sans-serif`;
      if (chart.config.type === 'bar') {
        c.textAlign = 'center';
        chart.getDatasetMeta(1).data.forEach((b, i) => {
          const y = Math.min(b.y, chart.getDatasetMeta(0).data[i].y);
          c.fillText(chart.data.datasets[1].data[i].toFixed(1) + ' %', b.x, y - 8);
        });
      } else {
        const puestos = [];
        chart.data.datasets.forEach((ds, i) => {
          if (!ds.clave) return;
          const p = chart.getDatasetMeta(i).data.at(-1);
          puestos.push({ y: p.y, x: p.x, texto: FRUTAS[ds.clave].corto, activo: ds.clave === el.fruta.value });
        });
        puestos.sort((a, b) => a.y - b.y).forEach((p, i, l) => { if (i && p.y - l[i - 1].y < 16) p.y = l[i - 1].y + 16; });
        c.textAlign = 'left'; c.textBaseline = 'middle';
        puestos.forEach(p => { c.fillStyle = p.activo ? tinta : tenue; c.fillText(p.texto, p.x + 8, p.y); });
      }
      c.restore();
    }
  };

  const barras = new Chart($('grafica'), {
    type: 'bar', plugins: [etiquetas],
    data: {
      labels: claves.map(k => FRUTAS[k].corto),
      datasets: [
        { label: 'Tope de la fruta', data: claves.map(k => FRUTAS[k].efic), backgroundColor: 'transparent', borderColor: tenue, borderWidth: 1, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom', grouped: false, order: 2, barPercentage: 0.62 },
        { label: 'Rendimiento actual', data: claves.map(() => 0), backgroundColor: [], borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom', grouped: false, order: 1, barPercentage: 0.46 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 260 }, layout: { padding: { top: 18 } },
      scales: {
        y: { min: 0, max: 100, border: { display: false }, title: { display: true, text: '% del máximo estequiométrico' }, ticks: { stepSize: 25, callback: v => v + ' %' } },
        x: { grid: { display: false }, ticks: { color: tinta } }
      },
      plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)} %` } } }
    }
  });

  const T_PUNTOS = Array.from({ length: 91 }, (_, i) => 1 + i * 0.1);
  const lineas = new Chart($('graficaTiempo'), {
    type: 'line', plugins: [etiquetas],
    data: {
      datasets: [
        ...claves.map(k => ({ label: FRUTAS[k].corto, data: [], borderColor: COLOR_FRUTA[k], backgroundColor: COLOR_FRUTA[k], borderWidth: 2, pointRadius: 0, pointHitRadius: 14, tension: 0.3, clave: k })),
        { label: 'Día actual', data: [], showLine: false, pointRadius: 7, pointHoverRadius: 7, pointBackgroundColor: tinta, pointBorderColor: hoja, pointBorderWidth: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: { right: 62 } },
      interaction: { mode: 'index', axis: 'x', intersect: false },
      scales: {
        x: { type: 'linear', min: 1, max: 10, grid: { display: false }, title: { display: true, text: 'Tiempo (días)' }, ticks: { stepSize: 1 } },
        y: { min: 0, max: 100, border: { display: false }, title: { display: true, text: 'Rendimiento (%)' }, ticks: { stepSize: 25, callback: v => v + ' %' } }
      },
      plugins: { legend: { display: false }, tooltip: { ...tooltip, filter: i => !!i.dataset.clave, itemSort: (a, b) => b.parsed.y - a.parsed.y, callbacks: { title: c => `Día ${c[0].parsed.x.toFixed(1)}`, label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)} %` } } }
    }
  });

  const leyendaFrutas = claves.map(k => `<span><i style="background:${COLOR_FRUTA[k]}"></i>${FRUTAS[k].corto}</span>`).join('');
  const LEYENDAS = {
    comparacion: `${leyendaFrutas}<span><i class="hueca"></i>Contorno: tope de la fruta en condiciones ideales</span>`,
    tiempo: `${leyendaFrutas}<span><i class="circulo"></i>Día actual de la fruta elegida</span>`
  };
  $('leyendaGrafica').innerHTML = LEYENDAS.comparacion;

  // ---------- etapas ----------
  $('etapas').innerHTML = ETAPAS.map((e, i) => `<li><button data-i="${i}" class="${e.actual ? 'actual' : ''}"><span class="n">${i + 1}</span>${e.t}${e.actual ? '<em>simulada</em>' : ''}</button></li>`).join('');
  const verEtapa = i => {
    const e = ETAPAS[i];
    $('etapaDetalle').innerHTML = `<p>${conTex(e.d)}</p>${(e.r || []).map(r => `<div class="reaccion">${tex(r, true)}</div>`).join('')}`;
    document.querySelectorAll('#etapas button').forEach(b => b.classList.toggle('sel', +b.dataset.i === i));
  };
  $('etapas').addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) verEtapa(+b.dataset.i); });
  verEtapa(3);

  // ---------- modelo en LaTeX ----------
  const tarjetasModelo = [
    { id: 'eqT', t: 'Temperatura' }, { id: 'eqP', t: 'pH' }, { id: 'eqD', t: 'Tiempo (logística)' }, { id: 'eqO', t: 'Oxígeno' }, { id: 'eqY', t: 'Máximo estequiométrico' }
  ];
  $('ecuaciones').innerHTML = tarjetasModelo.map(c => `<article><h3>${c.t}</h3><div id="${c.id}"></div><div class="eq-valor" id="${c.id}v"></div></article>`).join('');
  ponerTex($('eqY'), `Y_{\\max} = \\frac{2\\,M_{\\ce{C2H5OH}}}{M_{\\ce{C6H12O6}}} = \\frac{2(${MASA_MOLAR.etanol})}{${MASA_MOLAR.glucosa}}`, true);
  ponerTex($('eqYv'), `Y_{\\max} = ${Y_MAX.toFixed(4)}${u('g etanol / g glucosa')}`);

  function actualizarModelo(clave, T, pH, dias, sellado, r) {
    const f = FRUTAS[clave], vel = f.vel, tF = diaCompleto(clave);
    ponerTex($('eqPrincipal'), `R = \\eta \\cdot f_T \\cdot f_{\\mathrm{pH}} \\cdot f_t \\cdot f_{\\ce{O2}} = ${f.efic} \\times ${r.fT.toFixed(3)} \\times ${r.fP.toFixed(3)} \\times ${r.fD.toFixed(3)} \\times ${r.fO.toFixed(3)} = ${r.rendimiento.toFixed(1)}\\,\\%`, true);
    const sF = (PARAM.sigmaFrio / f.sensT).toFixed(2), sC = (PARAM.sigmaCalor / f.sensT).toFixed(2);
    ponerTex($('eqT'), `f_T = \\begin{cases} e^{-(${RANGOS.temp.lo}-T)^2 / 2(${sF})^2} & T < ${RANGOS.temp.lo} \\\\ 1 & ${RANGOS.temp.lo} \\le T \\le ${RANGOS.temp.hi} \\\\ e^{-(T-${RANGOS.temp.hi})^2 / 2(${sC})^2} & T > ${RANGOS.temp.hi} \\end{cases}`, true);
    ponerTex($('eqTv'), `T = ${T}\\ ^{\\circ}\\mathrm{C} \\;\\Rightarrow\\; f_T = ${r.fT.toFixed(3)}`);
    const s = PARAM.sigmaPH, rp = f.resPH;
    ponerTex($('eqP'), `f_{\\mathrm{pH}} = e^{-d^2/2(${s})^2},\\quad d = \\begin{cases} (${RANGOS.ph.lo}-\\mathrm{pH})/${rp} & \\mathrm{pH} < ${RANGOS.ph.lo} \\\\ 0 & ${RANGOS.ph.lo} \\le \\mathrm{pH} \\le ${RANGOS.ph.hi} \\\\ ${rp}\\,(\\mathrm{pH}-${RANGOS.ph.hi}) & \\mathrm{pH} > ${RANGOS.ph.hi} \\end{cases}`, true);
    ponerTex($('eqPv'), `\\mathrm{pH} = ${pH.toFixed(1)} \\;\\Rightarrow\\; f_{\\mathrm{pH}} = ${r.fP.toFixed(3)}`);
    ponerTex($('eqD'), `f_t = \\min\\!\\left(1,\\ \\frac{L(t)}{L(t_F)}\\right),\\quad L(t) = \\frac{1}{1 + e^{-${PARAM.kLog}(${vel}\\,t - ${PARAM.t0})}}`, true);
    ponerTex($('eqDv'), `t = ${dias.toFixed(1)}\\ \\text{d},\\ t_F = ${tF.toFixed(2)}\\ \\text{d} \\;\\Rightarrow\\; f_t = ${r.fD.toFixed(3)}`);
    ponerTex($('eqO'), `f_{\\ce{O2}} = \\begin{cases} 1 & \\text{con sello} \\\\ e^{-${PARAM.kO2}\\,\\max(0,\\ t-${PARAM.tO2})} & \\text{sin sello} \\end{cases}`, true);
    ponerTex($('eqOv'), `\\text{${sellado ? 'con' : 'sin'} sello} \\;\\Rightarrow\\; f_{\\ce{O2}} = ${r.fO.toFixed(3)}`);
  }

  // ---------- actualización ----------
  function actualizar() {
    const clave = el.fruta.value;
    const T = +el.temp.value, pH = +el.ph.value, dias = +el.dias.value, sellado = el.sellado.checked;
    const fruta = FRUTAS[clave];
    const r = calcular(clave, T, pH, dias, sellado);
    const fase = faseCrecimiento(dias, clave, sellado);
    const c = estadoCascara(clave, T, pH, dias, sellado);
    const color = colorPH(pH);
    ultimo = { clave, T, pH, dias, sellado, r, c };

    document.documentElement.style.setProperty('--mosto', color);
    ponerTex($('tempVal'), `${T}\\ ^{\\circ}\\mathrm{C}`);
    ponerTex($('phVal'), pH.toFixed(1));
    ponerTex($('diasVal'), `${dias.toFixed(1)}\\ \\text{días}`);
    for (const [id, min, max, v] of [['temp', 0, 50, T], ['ph', 1, 14, pH], ['dias', 1, 10, dias]]) $(id).style.setProperty('--p', (v - min) / (max - min) * 100 + '%');

    if (T >= RANGOS.temp.lo && T <= RANGOS.temp.hi) chip('tempChip', 'ok', 'Óptimo');
    else if (r.fT >= 0.5) chip('tempChip', 'warn', T < RANGOS.temp.lo ? 'Algo frío' : 'Algo caliente');
    else chip('tempChip', 'bad', T < RANGOS.temp.lo ? 'Muy frío' : 'Levadura inactiva');

    if (pH >= RANGOS.ph.lo && pH <= RANGOS.ph.hi) chip('phChip', 'ok', 'Óptimo');
    else chip('phChip', r.fP >= 0.5 ? 'warn' : 'bad', pH < RANGOS.ph.lo ? 'Muy ácido' : 'Poco ácido');

    if (dias < RANGOS.dias.lo) chip('diasChip', r.fD >= 0.5 ? 'warn' : 'bad', 'Incompleta');
    else if (dias <= RANGOS.dias.hi) chip('diasChip', 'ok', 'Óptimo');
    else chip('diasChip', sellado ? 'info' : 'bad', sellado ? 'Estacionaria' : 'Riesgo vinagre');

    ponerTex($('rendimiento'), `${r.rendimiento.toFixed(1)}\\,\\%`);
    if (r.rendimiento >= 70) chip('rendChip', 'ok', 'Alto');
    else if (r.rendimiento >= 40) chip('rendChip', 'warn', 'Medio');
    else chip('rendChip', 'bad', 'Bajo');
    $('rendSub').textContent = `del máximo estequiométrico; tope de esta fruta: ${fruta.efic} %`;
    ponerTex($('rendGg'), `\\approx ${r.gPorG.toFixed(3)}${u('g etanol / g azúcar')}`);
    $('frutaLabel').textContent = fruta.nombre;
    $('notaFruta').textContent = fruta.nota;

    [['fT', r.fT], ['fP', r.fP], ['fD', r.fD], ['fO', r.fO]].forEach(([id, f]) => {
      $(id).style.width = f * 100 + '%'; $(id).className = 'relleno ' + claseFactor(f);
      ponerTex($(id + 'p'), f.toFixed(2));
    });

    // diagnóstico
    const d = $('diagnostico');
    const peor = Math.min(r.fT, r.fP, r.fD, r.fO);
    let html;
    if (peor >= 0.95) { d.className = 'diagnostico'; html = `<strong>Condiciones ideales.</strong> <em>Saccharomyces cerevisiae</em> metaboliza los azúcares de la ${fruta.nombre.toLowerCase()} cerca de su máximo. Fase actual: ${fase.nombre.toLowerCase()}.`; }
    else {
      d.className = 'diagnostico ' + (peor < 0.5 ? 'bad' : 'warn');
      if (peor === r.fO) html = `<strong>Alerta de oxígeno.</strong> Sin sello hermético entra $\\ce{O2}$ y las bacterias acéticas oxidan el etanol a vinagre:<span class="diag-eq">$\\ce{C2H5OH + O2 -> CH3COOH + H2O}$</span>`;
      else if (peor === r.fT) html = T > RANGOS.temp.hi
        ? '<strong>Alerta térmica.</strong> Temperatura elevada: las enzimas de la levadura se desnaturalizan y la fermentación se detiene bruscamente.'
        : '<strong>Alerta térmica.</strong> Temperatura baja: la velocidad de las reacciones enzimáticas disminuye (Arrhenius) y se produce menos etanol en el mismo tiempo.';
      else if (peor === r.fP) html = pH < RANGOS.ph.lo
        ? '<strong>Alerta de acidez.</strong> Medio demasiado ácido: el exceso de $\\ce{H+}$ altera las proteínas de membrana y el transporte de glucosa hacia la levadura.'
        : '<strong>Alerta de pH.</strong> Medio poco ácido: la levadura pierde eficiencia y bacterias contaminantes compiten por el azúcar.';
      else html = `<strong>Fermentación en curso.</strong> Fase de ${fase.nombre.toLowerCase()}. ${fase.desc} Esta fruta completa su fermentación alrededor del día ${diaCompleto(clave).toFixed(1)}.`;
    }
    if (d._html !== html) { d._html = html; d.innerHTML = conTex(html.replace(/CO₂/g, '$\\ce{CO2}$').replace(/O₂/g, '$\\ce{O2}$')); }

    // gráficas
    barras.data.datasets[1].data = claves.map(k => calcular(k, T, pH, dias, sellado).rendimiento);
    barras.data.datasets[1].backgroundColor = claves.map(k => k === clave ? COLOR_FRUTA[k] : COLOR_FRUTA[k] + '59');
    barras.update();
    lineas.data.datasets.forEach(ds => {
      if (!ds.clave) return;
      ds.data = T_PUNTOS.map(t => ({ x: t, y: calcular(ds.clave, T, pH, t, sellado).rendimiento }));
      ds.borderWidth = ds.clave === clave ? 3 : 2;
      ds.borderColor = ds.clave === clave ? COLOR_FRUTA[ds.clave] : COLOR_FRUTA[ds.clave] + '66';
    });
    lineas.data.datasets.at(-1).data = [{ x: dias, y: r.rendimiento }];
    lineas.update();

    // 3D y overlays
    $('tagFase').textContent = fase.nombre;
    $('tagFase').className = 'fase fase-' + fase.id;
    ponerTex($('tagDia'), `\\text{Día } ${dias.toFixed(1)}\\;\\cdot\\;${T}\\ ^{\\circ}\\mathrm{C}\\;\\cdot\\;\\mathrm{pH}\\ ${pH.toFixed(1)}`);
    $('escalaMarca').style.left = (Math.min(14, Math.max(1, pH)) - 1) / 13 * 100 + '%';
    $('swT').style.background = T < 25 ? '#2e6fbf' : T <= 30 ? '#1c7a55' : '#e2700c';
    const efectos = c.efectos.slice(0, 4).map(e => `<div class="efecto"><span>${e.nombre}</span><div class="barra"><div class="relleno neutro" style="width:${e.valor * 100}%"></div></div></div>`).join('') || '<div class="efecto"><span>Cáscara fresca, sin deterioro visible</span></div>';
    const textoEfectos = efectos + (c.nota ? `<p>${conTex(c.nota)}</p>` : '');
    if ($('efectos')._html !== textoEfectos) { $('efectos')._html = textoEfectos; $('efectos').innerHTML = textoEfectos; }
    if (reactor) {
      if (reactor.clave !== clave) reactor.setFruta(clave);
      reactor.update({ T, pH, sellado, actividad: r.actividad, turbidez: r.turbidez, colorLiquido: color, cascara: c });
    }
    actualizarModelo(clave, T, pH, dias, sellado, r);
    actualizarCalc(r.rendimiento);
  }

  // ---------- calculadora ----------
  function actualizarCalc(rend) {
    const m = Math.max(0, +$('gAzucar').value || 0);
    const s = estequiometria(m, rend), fr = rend / 100;
    ponerTex($('calcRend'), `${rend.toFixed(1)}\\,\\%`);
    const M = MASA_MOLAR;
    ponerTex($('pasos'), `\\begin{aligned}
      n_{\\ce{C6H12O6}} &= \\frac{${num(m, 1)}${u('g')}}{${M.glucosa}${u('g/mol')}} = ${num(s.nGlucosa, 3)}${u('mol')} \\\\[6pt]
      n_{\\ce{C2H5OH}} &= 2 \\times ${num(s.nGlucosa, 3)} \\times ${fr.toFixed(3)} = ${num(s.nEtanol, 3)}${u('mol')} \\\\[6pt]
      m_{\\ce{C2H5OH}} &= ${num(s.nEtanol, 3)}${u('mol')} \\times ${M.etanol}${u('g/mol')} = ${num(s.gEtanol, 2)}${u('g')} \\\\[6pt]
      V_{\\ce{C2H5OH}} &= \\frac{${num(s.gEtanol, 2)}${u('g')}}{${DENSIDAD_ETANOL}${u('g/mL')}} = ${num(s.mlEtanol, 1)}${u('mL')} \\\\[6pt]
      V_{\\ce{CO2}} &= ${num(s.nCO2, 3)}${u('mol')} \\times ${VOLUMEN_MOLAR}${u('L/mol')} = ${num(s.lCO2, 1)}${u('L')}
    \\end{aligned}`, true);
    const res = `
      <div class="res"><span>Etanol obtenido</span><b>${tex(`${num(s.gEtanol, 1)}${u('g')}`)}</b><small>${tex(`${num(s.mlEtanol, 1)}${u('mL')}`)} · máx. teórico ${tex(`${num(s.gEtanolTeo, 1)}${u('g')}`)}</small></div>
      <div class="res"><span>${tex('\\ce{CO2}')} liberado</span><b>${tex(`${num(s.gCO2, 1)}${u('g')}`)}</b><small>${tex(`${num(s.lCO2, 1)}${u('L')}`)} a 25 °C y 1 atm</small></div>
      <div class="res"><span>Moles de etanol</span><b>${tex(`${num(s.nEtanol, 3)}${u('mol')}`)}</b><small>relación 1 : 2 glucosa a etanol</small></div>`;
    if ($('calcRes')._html !== res) { $('calcRes')._html = res; $('calcRes').innerHTML = res; }
  }
  $('gAzucar').addEventListener('input', () => actualizar());

  // ---------- eventos ----------
  const limpiarEscenario = () => document.querySelectorAll('#escenarios button').forEach(x => x.classList.remove('activa'));
  [el.temp, el.ph, el.dias].forEach(e => e.addEventListener('input', () => { if (e === el.dias) detener(); limpiarEscenario(); actualizar(); }));
  el.sellado.addEventListener('change', () => { limpiarEscenario(); actualizar(); });

  $('frutas').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    el.fruta.value = b.dataset.fruta;
    document.querySelectorAll('#frutas button').forEach(x => x.classList.toggle('activa', x === b));
    actualizar();
  });

  $('escenarios').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const e = ESCENARIOS[b.dataset.esc]; detener();
    el.temp.value = e.temp; el.ph.value = e.ph; el.dias.value = e.dias; el.sellado.checked = e.sellado;
    document.querySelectorAll('#escenarios button').forEach(x => x.classList.toggle('activa', x === b));
    actualizar();
  });

  $('vistas').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b || !reactor) return;
    reactor.setVista(b.dataset.vista);
    $('leyenda3d').hidden = b.dataset.vista !== 'reactor';
    $('leyendaCascara').hidden = b.dataset.vista !== 'cascara';
    document.querySelectorAll('#vistas button').forEach(x => x.classList.toggle('activa', x === b));
  });

  $('tabsGrafica').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    document.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== b.dataset.tab);
    document.querySelectorAll('#tabsGrafica button').forEach(x => x.classList.toggle('activa', x === b));
    $('leyendaGrafica').innerHTML = LEYENDAS[b.dataset.tab];
    (b.dataset.tab === 'tiempo' ? lineas : barras).resize();
  });

  // Presentación: si se sale con Esc de pantalla completa, también se apaga el modo
  const modoPresentacion = on => {
    document.documentElement.classList.toggle('presentacion', on);
    $('btnPresentacion').setAttribute('aria-pressed', on);
    Chart.defaults.font.size = on ? 15 : 13;
    [barras, lineas].forEach(g => g.update());
  };
  $('btnPresentacion').addEventListener('click', () => {
    const on = !document.documentElement.classList.contains('presentacion');
    modoPresentacion(on);
    if (on) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen?.();
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) modoPresentacion(false); });

  // ---------- animación de la fermentación ----------
  const TEXTO_PLAY = 'Simular del día 1 al 10';
  let anim = null;
  function detener() { if (anim) { cancelAnimationFrame(anim); anim = null; $('btnPlay').textContent = TEXTO_PLAY; $('btnPlay').classList.remove('activo'); } }
  $('btnPlay').addEventListener('click', () => {
    if (anim) return detener();
    limpiarEscenario();
    // muestra la gráfica temporal para que se vea la curva avanzar
    document.querySelector('#tabsGrafica [data-tab="tiempo"]').click();
    let v = 1, ult = performance.now();
    $('btnPlay').textContent = 'Pausar'; $('btnPlay').classList.add('activo');
    const paso = ahora => {
      v = Math.min(10, v + (ahora - ult) / 1000 * 0.9); ult = ahora; // ~10 s en total
      el.dias.value = v; actualizar();
      if (v >= 10) return detener();
      anim = requestAnimationFrame(paso);
    };
    anim = requestAnimationFrame(paso);
  });

  actualizar();
  document.querySelector('#escenarios [data-esc="optimo"]').classList.add('activa');
  document.fonts?.ready.then(() => { barras.update(); lineas.update(); });
}

window.addEventListener('load', iniciar);
