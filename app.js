/* ==========================================================
   CGE Dashboard — app.js (Unificado)
   Lógica principal, parsing de CSV, gráficos y UI
   ========================================================== */

// --- 1. CONFIGURACIÓN ---
const CSV_URL = 'https://docs.google.com/spreadsheets/d/1Bq-tn32eN0WIWoarZpeYpg2qVEAmLy4IcYB8gdyb_Zk/export?format=csv&gid=0';
const USE_MOCK_DATA = false;

// Nombre real de la primera columna (ENTIDAD). Se detecta dinámicamente al parsear.
let ENTIDAD_COL = 'ENTIDAD';

// obsKey se rellena dinámicamente en buildObsKeyMap() — no hardcodear aquí
const MONTHS = [
  { key: 'MAYO',       obsKey: null, displayLabel: 'Abril (ejecución)'      },
  { key: 'JUNIO',      obsKey: null, displayLabel: 'Mayo (ejecución)'       },
  { key: 'JULIO',      obsKey: null, displayLabel: 'Junio (ejecución)'      },
  { key: 'AGOSTO',     obsKey: null, displayLabel: 'Julio (ejecución)'      },
  { key: 'SEPTIEMBRE', obsKey: null, displayLabel: 'Agosto (ejecución)'    },
  { key: 'OCTUBRE',    obsKey: null, displayLabel: 'Septiembre (ejecución)' },
  { key: 'NOVIEMBRE',  obsKey: null, displayLabel: 'Octubre (ejecución)'   },
  { key: 'DICIEMBRE',  obsKey: null, displayLabel: 'Noviembre (ejecución)'  },
];

const COLUMN_BLACKLIST_PATTERNS = ['PROGRESO', 'FINAL DE'];

const FREQ_WEIGHTS = {
  'MENSUAL': 1.0,
  'BIMESTRAL': 0.5,
  'TRIMESTRALMENTE': 0.33,
  'SIN FRECUENCIA': 0.1,
};

const MOCK_CSV = `ENTIDAD,FRECUENCIA DE CONSULTORIA,CONSULTOR,% PLAN ANUAL DE TRABAJO - MAYO,% PROGRAMA DE CAPACITACION - MAYO,PROGRESO PLAN ANUAL DE TRABAJO - MAYO,PROGRESO PROGRAMA DE CAPACITACION - MAYO,OBSERVACIONES - FECHA DE CORTE,FINAL DE MAYO,% PLAN ANUAL DE TRABAJO - JUNIO,% PROGRAMA DE CAPACITACION - JUNIO,PROGRESO PLAN ANUAL DE TRABAJO - JUNIO,PROGRESO PROGRAMA DE CAPACITACION - JUNIO,OBSERVACIONES - FECHA DE CORTE.1,FINAL DE JUNIO
Cliente Normal 1,MENSUAL,DIEGO CALDERON,95.0,90.0,0,0,Ok,MAYO,,,,,,
Cliente Normal 2,BIMESTRAL,DANIEL RAMIREZ,100.0,85.0,0,0,Falta firma,MAYO,,,,,,
Cliente Sin Datos Mayo,MENSUAL,LUISA FERNANDA,,,,,,MAYO,,,,,,
Cliente Huérfano 1,MENSUAL,SIN CONSULTOR,50.0,40.0,0,0,Atención urgente,MAYO,,,,,,
Cliente Huérfano 2,BIMESTRAL,GESTOR,60.0,50.0,0,0,Asignar,MAYO,,,,,,
Cliente Typo Consultor,MENSUAL,DEIBY,80.0,80.0,0,0,Todo al día,MAYO,,,,,,
Cliente Proxy Cero 1,MENSUAL,MIGUEL SIERRA,90.0,1.0,0,0,CAPACITACION PORCENTAJE A 0,MAYO,,,,,,
Cliente Proxy Cero 2,TRIMESTRALMENTE,KAREN RAMIREZ,85.0,1.0,0,0,Sin capacitar,MAYO,,,,,,
Cliente Typo Freq,BIMENSUAL,ANA MARIA CHIAPPE,70.0,75.0,0,0,Revisar frecuencia,MAYO,,,,,,
Cliente Normal 3,MENSUAL,DIEGO CALDERON,100.0,100.0,0,0,Excelente,MAYO,,,,,,
Cliente Normal 4,MENSUAL,DANIEL RAMIREZ,88.0,92.0,0,0,,MAYO,,,,,,
Cliente Normal 5,MENSUAL,LUISA FERNANDA,45.0,20.0,0,0,Riesgo alto,MAYO,,,,,,
Cliente Normal 6,MENSUAL,MIGUEL SIERRA,75.0,75.0,0,0,,MAYO,,,,,,
Cliente Normal 7,MENSUAL,KAREN RAMIREZ,92.0,88.0,0,0,Visita ok,MAYO,,,,,,
Cliente Normal 8,BIMESTRAL,ANA MARIA CHIAPPE,100.0,100.0,0,0,,MAYO,,,,,,
Cliente Normal 9,MENSUAL,ANDREA CONTRERAS,60.0,90.0,0,0,Gap amplio,MAYO,,,,,,
Cliente Normal 10,MENSUAL,NELLY MARTIN,85.0,85.0,0,0,,MAYO,,,,,,
Cliente Normal 11,MENSUAL,MIGUEL DAVILA,95.0,100.0,0,0,,MAYO,,,,,,
Cliente Normal 12,MENSUAL,NAIDU FERNANDEZ,100.0,100.0,0,0,,MAYO,,,,,,
Cliente Normal 13,MENSUAL,PILAR RAMIREZ,80.0,80.0,0,0,,MAYO,,,,,,`;

// --- 2. ESTADO GLOBAL ---
const state = {
  data: [],
  activeMonths: [],
  currentMonth: null,
  currentConsultor: '',
  estadoReporte: 'con_datos',
  searchQuery: '',
  vistaActual: 'mensual',
  charts: {},
  sortCol: null,
  sortAsc: true,
  currentPage: 1,
  itemsPerPage: 10
};

// --- 3. UTILIDADES ---
function safePercent(val) {
  const n = parseFloat(val);
  if (isNaN(n) || val === '' || val === null || val === undefined) return null;
  return Math.min(100, Math.max(0, n));
}

function normalizeConsultor(raw) {
  const s = (raw || '').trim().toUpperCase();
  if (!s || s === 'SIN CONSULTOR') return 'SIN CONSULTOR';
  if (s === 'GESTOR') return 'GESTOR';
  if (s === 'DEIBY') return 'DEIBY MORENO';
  return s;
}

function normalizeFrecuencia(raw) {
  const s = (raw || '').trim().toUpperCase();
  if (s === 'BIMENSUAL') return 'BIMESTRAL';
  return s || 'SIN FRECUENCIA';
}

// Semaforización corporativa: usa el peor de los dos porcentajes
function getEntityRisk(plan, cap) {
  if (plan === null && cap === null) return null;
  const worst = Math.min(plan !== null ? plan : 100, cap !== null ? cap : 100);
  if (worst <= 1) return 'SIN_DATOS';  // proxy de cero
  if (worst < 50)  return 'ALTO';      // Rojo: 1-49%
  if (worst < 85)  return 'MEDIO';     // Amarillo: 50-84%
  return 'OK';                          // Verde: 85-100%
}

function getRiskClass(risk) {
  if (risk === 'ALTO')      return 'gap-alto';
  if (risk === 'MEDIO')     return 'gap-medio';
  if (risk === 'OK')        return 'gap-ok';
  return '';
}

function getRiskBadge(risk) {
  if (risk === 'ALTO')      return '<span class="badge badge--alto">RIESGO ALTO</span>';
  if (risk === 'MEDIO')     return '<span class="badge badge--medio">RIESGO MEDIO</span>';
  if (risk === 'SIN_DATOS') return '<span class="badge badge--sin-dato">SIN DATOS</span>';
  return '<span class="badge badge--ok">OK</span>';
}

// Mantener calcGap para mostrar la brecha informativa en tabla
function calcGap(planPct, capPct) {
  if (planPct === null || capPct === null) return null;
  return Math.abs(planPct - capPct);
}

// --- 4. CARGA DE DATOS ---

/**
 * Construye el mapeo dinámico de obsKey para cada mes.
 * Estrategia: buscar la columna que empiece con 'OBSERVACIONES'
 * inmediatamente después de los datos de cada mes, usando los
 * fields del CSV para no depender de nombres fijos ni sufijos .N
 * @param {string[]} fields - Array de nombres de columnas del CSV
 */
function buildObsKeyMap(fields) {
  try {
    console.log('[CGE] Columnas detectadas en CSV:', fields);
    
    MONTHS.forEach(m => {
      const planKey = `% PLAN ANUAL DE TRABAJO - ${m.key}`;
      const planIdx = fields.indexOf(planKey);
      
      if (planIdx === -1) {
        console.warn(`[CGE] No se encontró columna para el mes ${m.key}`);
        m.obsKey = null;
        return;
      }
      
      // Buscar la siguiente columna que empiece con 'OBSERVACIONES'
      for (let i = planIdx + 1; i < fields.length; i++) {
        const col = fields[i];
        if (!col) continue; // Saltar si col es undefined o string vacío
        
        // Parar si llegamos al bloque del siguiente mes
        if (col.startsWith('% PLAN ANUAL DE TRABAJO')) break;
        if (col.toUpperCase().startsWith('OBSERVACIONES')) {
          m.obsKey = col;
          console.log(`[CGE] Mes ${m.key} → obsKey detectado: "${col}"`);
          break;
        }
      }
      
      if (!m.obsKey) {
        console.warn(`[CGE] No se encontró columna OBSERVACIONES para ${m.key}`);
      }
    });
  } catch (err) {
    console.error("Error in buildObsKeyMap:", err);
  }
}

function initData() {
  showLoading(true);

  if (USE_MOCK_DATA) {
    document.getElementById('badge-data-source').innerHTML = '<span class="blink-dot">●</span> MOCK DATA';
    document.getElementById('badge-data-source').classList.remove('live');
    Papa.parse(MOCK_CSV, {
      header: true, skipEmptyLines: true,
      complete: function(results) {
        // Detectar primera columna (ENTIDAD puede tener cualquier nombre)
        if (results.meta && results.meta.fields && results.meta.fields.length > 0) {
          ENTIDAD_COL = results.meta.fields[0];
          console.log(`[CGE] Columna ENTIDAD detectada: "${ENTIDAD_COL}"`);
          buildObsKeyMap(results.meta.fields);
        }
        processParsedData(results.data);
      }
    });
  } else {
    document.getElementById('badge-data-source').innerHTML = '<span class="blink-dot">●</span> LIVE DATA';
    document.getElementById('badge-data-source').classList.add('live');
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        // Detectar primera columna (ENTIDAD puede tener cualquier nombre o estar vacía)
        if (results.meta && results.meta.fields && results.meta.fields.length > 0) {
          ENTIDAD_COL = results.meta.fields[0];
          console.log(`[CGE] Columna ENTIDAD detectada: "${ENTIDAD_COL}"`);
          buildObsKeyMap(results.meta.fields);
        }
        processParsedData(results.data);
      },
      error: function(err) {
        console.error("Error al cargar CSV:", err);
        showLoading(false);
        mostrarErrorConexion();
      }
    });
  }
}

// Muestra un mensaje de error amigable en pantalla si falla la conexión
function mostrarErrorConexion() {
  const loadEl = document.getElementById('loading-state');
  if (loadEl) {
    loadEl.innerHTML = `
      <div class="error-state">
        <span class="error-state__icon">⚠️</span>
        <p class="error-state__title">Error de conexión</p>
        <p class="error-state__msg">No se pudo cargar la hoja de Google Sheets.<br>Verifica que el archivo esté publicado y la URL sea correcta.</p>
        <button onclick="initData()" class="error-state__btn">Reintentar</button>
      </div>`;
  }
}

// Google bloquea CORS para protocolo file:// — el dashboard debe servirse vía http(s)
function mostrarErrorFileProtocol() {
  const loadEl = document.getElementById('loading-state');
  if (loadEl) {
    loadEl.innerHTML = `
      <div class="error-state">
        <span class="error-state__icon">⚠️</span>
        <p class="error-state__title">Abre el dashboard correctamente</p>
        <p class="error-state__msg">No abras este archivo con doble clic (file://).<br>Ejecuta <strong>start.bat</strong> en esta carpeta, o visita <strong>http://localhost:8080</strong> tras correr <code>npx serve -l 8080</code>.</p>
      </div>`;
  }
}

function processParsedData(rawData) {
  try {
    state.data = rawData.map(row => {
      // Usar ENTIDAD_COL detectado dinámicamente (la primera columna del CSV)
      const entidadVal = (row[ENTIDAD_COL] || '').trim();
      
      const item = {
        entidad: entidadVal,
        frecuenciaRaw: row['FRECUENCIA DE CONSULTORIA'],
        frecuencia: normalizeFrecuencia(row['FRECUENCIA DE CONSULTORIA']),
        consultorRaw: row['CONSULTOR'],
        consultor: normalizeConsultor(row['CONSULTOR']),
        meses: {}
      };

      MONTHS.forEach(m => {
        const planKey = `% PLAN ANUAL DE TRABAJO - ${m.key}`;
        const capKey = `% PROGRAMA DE CAPACITACION - ${m.key}`;
        const planVal = safePercent(row[planKey]);
        const capVal = safePercent(row[capKey]);
        // obsKey puede ser null si el mes aún no tiene columna en la hoja
        const obsVal = m.obsKey ? (row[m.obsKey] || '') : '';
        
        item.meses[m.key] = {
          plan: planVal,
          cap: capVal,
          gap: calcGap(planVal, capVal),
          risk: getEntityRisk(planVal, capVal),
          obs: obsVal
        };
      });

      return item;
    }).filter(item => item.entidad);

    state.activeMonths = MONTHS.filter(m => 
      state.data.some(row => row.meses[m.key] && (row.meses[m.key].plan !== null || row.meses[m.key].cap !== null))
    );

    if (state.activeMonths.length > 0) {
      state.currentMonth = state.activeMonths[0].key;
    }

    initUI();
    updateView();
    showLoading(false);
  } catch (err) {
    console.error("Error in processParsedData:", err);
    document.getElementById('loading-state').innerHTML = `<div style="color:red; max-width:800px; text-align:left;"><h3>Error in processParsedData</h3><pre>${err.stack}</pre></div>`;
  }
}

// --- 5. UI Y RENDERIZADO ---
function showLoading(show) {
  document.getElementById('loading-state').hidden = !show;
  document.getElementById('content').hidden = show;
}

function initUI() {
  const selectMes = document.getElementById('select-mes');
  selectMes.innerHTML = '';
  state.activeMonths.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.key;
    opt.textContent = m.displayLabel;
    selectMes.appendChild(opt);
  });

  const consultores = [...new Set(state.data.map(d => d.consultor))].sort();
  const selectConsultor = document.getElementById('select-consultor');
  selectConsultor.innerHTML = '<option value="">Todos</option>';
  consultores.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    selectConsultor.appendChild(opt);
  });

  selectMes.addEventListener('change', (e) => { state.currentMonth = e.target.value; updateView(); });
  selectConsultor.addEventListener('change', (e) => { state.currentConsultor = e.target.value; state.currentPage = 1; updateView(); });
  document.getElementById('select-estado').addEventListener('change', (e) => { state.estadoReporte = e.target.value; state.currentPage = 1; updateView(); });
  document.getElementById('input-busqueda').addEventListener('input', (e) => { state.searchQuery = e.target.value.toLowerCase(); state.currentPage = 1; updateView(); });
  document.getElementById('btn-vista-mensual').addEventListener('click', () => setVista('mensual'));
  document.getElementById('btn-vista-anual').addEventListener('click', () => setVista('anual'));

  const btnInforme = document.getElementById('btn-descargar-informe');
  if (btnInforme) {
    btnInforme.addEventListener('click', () => {
      if (!state.currentConsultor) { alert('Selecciona un consultor primero.'); return; }
      descargarInforme(state.currentConsultor);
    });
  }

  document.querySelectorAll('#tabla-maestra th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.sortCol === col) state.sortAsc = !state.sortAsc;
      else { state.sortCol = col; state.sortAsc = true; }
      
      document.querySelectorAll('#tabla-maestra th.sortable').forEach(el => el.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(state.sortAsc ? 'sorted-asc' : 'sorted-desc');
      updateView();
    });
  });
}

function setVista(vista) {
  state.vistaActual = vista;
  const btnMensual = document.getElementById('btn-vista-mensual');
  const btnAnual = document.getElementById('btn-vista-anual');
  const divMensual = document.getElementById('vista-mensual');
  const divAnual = document.getElementById('vista-anual');
  const grupoMes = document.getElementById('grupo-mes');

  if (vista === 'mensual') {
    btnMensual.classList.add('view-toggle__btn--active'); btnAnual.classList.remove('view-toggle__btn--active');
    divMensual.hidden = false; divAnual.hidden = true; grupoMes.hidden = false;
  } else {
    btnAnual.classList.add('view-toggle__btn--active'); btnMensual.classList.remove('view-toggle__btn--active');
    divAnual.hidden = false; divMensual.hidden = true; grupoMes.hidden = true; 
  }
  updateView();
}

function updateView() {
  if (!state.currentMonth) return;

  const filteredData = state.data.filter(item => {
    if (state.searchQuery && !item.entidad.toLowerCase().includes(state.searchQuery)) return false;
    if (state.currentConsultor && item.consultor !== state.currentConsultor) return false;
    return true;
  });

  const activeData = filteredData.filter(item => {
    const hasData = item.meses[state.currentMonth].plan !== null || item.meses[state.currentMonth].cap !== null;
    if (state.estadoReporte === 'con_datos') return hasData;
    if (state.estadoReporte === 'sin_datos') return !hasData;
    return true;
  });

  updateKPIs(activeData);
  renderMasterTable(activeData);

  const chartsOk = typeof Chart !== 'undefined';

  if (state.vistaActual === 'mensual') {
    document.getElementById('chart-consultor-subtitle').textContent = MONTHS.find(m => m.key === state.currentMonth)?.displayLabel || '';
    renderRiesgosTable(activeData);
    renderConsultoresAcordeon(activeData);
    if (chartsOk) { renderConsultorChart(activeData); renderWorkloadMensualChart(activeData); }
    else mostrarAvisoSinGraficos();
  } else {
    if (chartsOk) { renderYTDChart(filteredData); renderFrecuenciaChart(filteredData); renderWorkloadChart(filteredData); }
    else mostrarAvisoSinGraficos();
  }
}

// Chart.js viene de CDN — si el informe descargado se abre sin internet, avisar en vez de quedar en blanco
function mostrarAvisoSinGraficos() {
  document.querySelectorAll('.chart-wrapper').forEach(w => {
    if (!w.querySelector('.chart-aviso-offline')) {
      const p = document.createElement('p');
      p.className = 'chart-aviso-offline tabla-vacia';
      p.textContent = 'Gráficos no disponibles sin conexión a internet (Chart.js no cargó).';
      w.appendChild(p);
    }
  });
}

function updateKPIs(activeData) {
  document.getElementById('kpi-val-entidades').textContent = activeData.length;
  document.getElementById('kpi-val-consultores').textContent = new Set(activeData.map(d => d.consultor)).size;

  let sumPlan = 0, countPlan = 0, sumCap = 0, countCap = 0, huerfanas = 0;
  activeData.forEach(d => {
    const m = d.meses[state.currentMonth];
    if (m.plan !== null) { sumPlan += m.plan; countPlan++; }
    if (m.cap !== null) { sumCap += m.cap; countCap++; }
    if (d.consultor === 'SIN CONSULTOR' || d.consultor === 'GESTOR') huerfanas++;
  });

  document.getElementById('kpi-val-plan').textContent = countPlan ? (sumPlan / countPlan).toFixed(1) + '%' : 'N/A';
  document.getElementById('kpi-val-capacitacion').textContent = countCap ? (sumCap / countCap).toFixed(1) + '%' : 'N/A';
  document.getElementById('kpi-val-huerfanas').textContent = `${huerfanas} (${activeData.length ? ((huerfanas / activeData.length) * 100).toFixed(1) : 0}%)`;
}

function createProgressCell(val, isCap = false) {
  if (val === null) return `<span class="badge badge--sin-dato">N/A</span>`;
  if (val <= 1 && isCap) return `<div style="display:flex; align-items:center; gap:8px;"><span class="badge badge--sin-dato">SIN DATOS (1%)</span></div>`;
  const fillClass = isCap ? 'barra-progreso__fill barra-progreso__fill--cap' : 'barra-progreso__fill';
  return `<div class="barra-progreso"><div class="barra-progreso__track"><div class="${fillClass}" style="width: ${val}%"></div></div><span class="barra-progreso__valor">${val.toFixed(1)}%</span></div>`;
}

function renderMasterTable(activeData) {
  const tbody = document.getElementById('tbody-maestra');
  document.getElementById('tabla-maestra-info').textContent = `Mostrando ${activeData.length} resultados`;
  
  if (activeData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="tabla-vacia">No hay datos para mostrar</td></tr>';
    document.getElementById('paginacion').innerHTML = '';
    return;
  }

  let sortedData = [...activeData];
  if (state.sortCol) {
    sortedData.sort((a, b) => {
      let valA, valB;
      const m = state.currentMonth;
      switch (state.sortCol) {
        case 'entidad': valA = a.entidad; valB = b.entidad; break;
        case 'frecuencia': valA = a.frecuencia; valB = b.frecuencia; break;
        case 'consultor': valA = a.consultor; valB = b.consultor; break;
        case 'plan': valA = a.meses[m].plan || 0; valB = b.meses[m].plan || 0; break;
        case 'capacitacion': valA = a.meses[m].cap || 0; valB = b.meses[m].cap || 0; break;
        case 'gap': valA = a.meses[m].gap || 0; valB = b.meses[m].gap || 0; break;
        default: valA = 0; valB = 0;
      }
      if (valA < valB) return state.sortAsc ? -1 : 1;
      if (valA > valB) return state.sortAsc ? 1 : -1;
      return 0;
    });
  }

  const totalPages = Math.ceil(sortedData.length / state.itemsPerPage);
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  const start = (state.currentPage - 1) * state.itemsPerPage;
  const pagedData = sortedData.slice(start, start + state.itemsPerPage);

  tbody.innerHTML = pagedData.map(d => {
    const m = d.meses[state.currentMonth];
    const riskClass = getRiskClass(m.risk);
    const consultorBadge = (d.consultor === 'SIN CONSULTOR' || d.consultor === 'GESTOR') ? `<span class="badge badge--huerfana">${d.consultor}</span>` : d.consultor;
    return `<tr><td><strong>${d.entidad}</strong></td><td>${d.frecuencia}</td><td>${consultorBadge}</td><td>${createProgressCell(m.plan)}</td><td>${createProgressCell(m.cap, true)}</td><td class="${riskClass}">${m.gap !== null ? m.gap.toFixed(1) + '%' : 'N/A'}</td><td class="text-muted">${m.obs || '-'}</td></tr>`;
  }).join('');

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pag = document.getElementById('paginacion');
  if (totalPages <= 1) { pag.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="paginacion__btn ${i === state.currentPage ? 'paginacion__btn--active' : ''}" data-page="${i}">${i}</button>`;
  }
  pag.innerHTML = html;
  pag.querySelectorAll('button').forEach(btn => btn.addEventListener('click', (e) => { state.currentPage = parseInt(e.target.dataset.page); updateView(); }));
}

function renderRiesgosTable(activeData) {
  const tbody = document.getElementById('tbody-riesgos');
  // Ordenar: primero ALTO, luego MEDIO, luego OK, dentro de cada grupo por peor promedio
  const riskOrder = { 'ALTO': 0, 'MEDIO': 1, 'SIN_DATOS': 0, 'OK': 2, null: 3 };
  const riesgos = [...activeData]
    .filter(d => d.meses[state.currentMonth].risk !== null)
    .sort((a, b) => {
      const ra = riskOrder[a.meses[state.currentMonth].risk];
      const rb = riskOrder[b.meses[state.currentMonth].risk];
      if (ra !== rb) return ra - rb;
      // dentro del mismo semáforo, ordenar por peor promedio (más bajo primero)
      const avgA = ((a.meses[state.currentMonth].plan || 0) + (a.meses[state.currentMonth].cap || 0)) / 2;
      const avgB = ((b.meses[state.currentMonth].plan || 0) + (b.meses[state.currentMonth].cap || 0)) / 2;
      return avgA - avgB;
    })
    .slice(0, 10);

  if (riesgos.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="tabla-vacia">No hay riesgos identificados</td></tr>'; return; }

  tbody.innerHTML = riesgos.map(d => {
    const m = d.meses[state.currentMonth];
    return `<tr><td><strong>${d.entidad}</strong></td><td>${d.consultor}</td><td>${m.plan !== null ? m.plan.toFixed(1) + '%' : 'N/A'}</td><td>${m.cap !== null ? m.cap.toFixed(1) + '%' : 'N/A'}</td><td class="${getRiskClass(m.risk)}">${m.gap !== null ? m.gap.toFixed(1) + '%' : 'N/A'}</td><td>${getRiskBadge(m.risk)}</td><td class="text-muted">${m.obs || '-'}</td></tr>`;
  }).join('');
}

function renderConsultoresAcordeon(activeData) {
  const container = document.getElementById('acordeon-consultores');
  const porConsultor = {};
  activeData.forEach(d => { if (!porConsultor[d.consultor]) porConsultor[d.consultor] = []; porConsultor[d.consultor].push(d); });

  if (Object.keys(porConsultor).length === 0) { container.innerHTML = '<p class="tabla-vacia">No hay datos para mostrar</p>'; return; }

  container.innerHTML = Object.entries(porConsultor).sort((a, b) => a[0].localeCompare(b[0])).map(([consultor, entidades]) => {
    let sumPlan = 0, countPlan = 0, sumCap = 0, countCap = 0;
    entidades.forEach(e => { const m = e.meses[state.currentMonth]; if (m.plan !== null) { sumPlan += m.plan; countPlan++; } if (m.cap !== null) { sumCap += m.cap; countCap++; } });
    const avgPlan = countPlan ? (sumPlan/countPlan).toFixed(1) + '%' : 'N/A';
    const avgCap = countCap ? (sumCap/countCap).toFixed(1) + '%' : 'N/A';
    const tableRows = entidades.map(e => {
      const m = e.meses[state.currentMonth];
      return `<tr><td>${e.entidad}</td><td>${e.frecuencia}</td><td>${m.plan !== null ? m.plan.toFixed(1) + '%' : 'N/A'}</td><td>${m.cap !== null ? m.cap.toFixed(1) + '%' : 'N/A'}</td><td>${getRiskBadge(m.risk)}</td><td>${m.obs || '-'}</td></tr>`;
    }).join('');

    return `<div class="acordeon__item"><button class="acordeon__header" aria-expanded="false"><div class="acordeon__header-left"><span>${consultor}</span><span class="badge">${entidades.length} entidades</span></div><div class="acordeon__header-stats"><span class="acordeon__stat">Plan: ${avgPlan}</span><span class="acordeon__stat">Cap: ${avgCap}</span><span class="acordeon__chevron">▼</span></div></button><div class="acordeon__body"><table class="acordeon__table"><thead><tr><th>Entidad</th><th>Freq</th><th>Plan</th><th>Cap</th><th>Estado</th><th>Obs</th></tr></thead><tbody>${tableRows}</tbody></table></div></div>`;
  }).join('');

  container.querySelectorAll('.acordeon__header').forEach(btn => btn.addEventListener('click', () => {
    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', !isExpanded);
    if (!isExpanded) btn.nextElementSibling.classList.add('open');
    else btn.nextElementSibling.classList.remove('open');
  }));
}

// --- 6. CHART.JS ---
// Guard: si Chart.js (CDN) no cargó -- ej. informe offline sin internet -- esta línea
// corre igual al parsear el archivo, ANTES de DOMContentLoaded. Sin el guard, todo
// app.js revienta aquí y ni siquiera bootReport()/initData() llegan a ejecutarse.
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'Source Sans 3', sans-serif";
  Chart.defaults.color = "#6b5e52";
}

// Paleta de colores corporativa CGE
const COLORES = {
  riesgoAlto:  '#e63946',
  riesgoMedio: '#ffd166',
  ok:          '#06d6a0',
  primario:    '#ff8100',
  oscuro:      '#1a1a2e',
  fondoBarra:  '#f0e4d4'
};

function safeDestroyChart(chartId) { if (state.charts[chartId]) state.charts[chartId].destroy(); }

function renderConsultorChart(activeData) {
  safeDestroyChart('chart-consultores');
  const allConsultants = [...new Set(state.data.map(d => d.consultor))].sort();
  const porConsultor = {};
  allConsultants.forEach(c => porConsultor[c] = { alto: [], medio: [], ok: [] });

  activeData.forEach(d => {
    const m = d.meses[state.currentMonth];
    const risk = m.risk;
    if (risk === 'ALTO' || risk === 'SIN_DATOS') porConsultor[d.consultor].alto.push(d.entidad);
    else if (risk === 'MEDIO') porConsultor[d.consultor].medio.push(d.entidad);
    else if (risk === 'OK') porConsultor[d.consultor].ok.push(d.entidad);
  });

  const labels = allConsultants;
  const dataAlto = labels.map(c => porConsultor[c].alto.length);
  const dataMedio = labels.map(c => porConsultor[c].medio.length);
  const dataOk = labels.map(c => porConsultor[c].ok.length);

  state.charts['chart-consultores'] = new Chart(document.getElementById('chart-consultores'), {
    type: 'bar', 
    data: { 
      labels, 
      datasets: [
        { label: 'Riesgo Alto (1% – 49%)', data: dataAlto, backgroundColor: COLORES.riesgoAlto },
        { label: 'Riesgo Medio (50% – 84%)', data: dataMedio, backgroundColor: COLORES.riesgoMedio },
        { label: 'Buen Estado (85% – 100%)', data: dataOk, backgroundColor: COLORES.ok }
      ] 
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: false, 
      indexAxis: 'y', 
      scales: { 
        x: { stacked: true }, 
        y: { stacked: true } 
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const datasetIndex = context.datasetIndex;
              const consultant = labels[context.dataIndex];
              let entities = [];
              let prefix = context.dataset.label + ':';
              
              if (datasetIndex === 0) entities = porConsultor[consultant].alto;
              else if (datasetIndex === 1) entities = porConsultor[consultant].medio;
              else if (datasetIndex === 2) entities = porConsultor[consultant].ok;
              
              const count = entities.length;
              if (count === 0) return `${prefix} 0`;
              
              const lines = [`${prefix} ${count} empresas`];
              const maxShow = 15;
              entities.slice(0, maxShow).forEach(e => lines.push(`  • ${e}`));
              if (entities.length > maxShow) {
                lines.push(`  ... y ${entities.length - maxShow} más`);
              }
              return lines;
            }
          }
        }
      }
    }
  });
}

function renderYTDChart(filteredData) {
  safeDestroyChart('chart-ytd');
  const labels = [], planData = [], capData = [];
  state.activeMonths.forEach(m => {
    labels.push(m.displayLabel);
    let sumP = 0, countP = 0, sumC = 0, countC = 0;
    filteredData.forEach(d => { const ms = d.meses[m.key]; if (ms) { if (ms.plan !== null) { sumP += ms.plan; countP++; } if (ms.cap !== null) { sumC += ms.cap; countC++; } } });
    planData.push(countP ? sumP/countP : null); capData.push(countC ? sumC/countC : null);
  });
  state.charts['chart-ytd'] = new Chart(document.getElementById('chart-ytd'), {
    type: 'line', data: { labels, datasets: [
      { label: '% Plan Trabajo', data: planData, borderColor: COLORES.primario, backgroundColor: 'rgba(255,129,0,.1)', fill: true, tension: 0.3, spanGaps: true, pointBackgroundColor: COLORES.primario },
      { label: '% Capacitación', data: capData, borderColor: COLORES.oscuro, backgroundColor: 'rgba(26,26,46,.08)', fill: true, tension: 0.3, spanGaps: true, pointBackgroundColor: COLORES.oscuro }
    ]},
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
  });
}

function renderFrecuenciaChart(filteredData) {
  safeDestroyChart('chart-frecuencia');
  const counts = {};
  filteredData.forEach(d => { counts[d.frecuencia] = (counts[d.frecuencia] || 0) + 1; });
  state.charts['chart-frecuencia'] = new Chart(document.getElementById('chart-frecuencia'), {
    type: 'doughnut', data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: [COLORES.primario, COLORES.oscuro, COLORES.riesgoMedio, COLORES.riesgoAlto] }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '65%' }
  });
}

function renderWorkloadChart(filteredData) {
  safeDestroyChart('chart-workload');
  const allConsultants = [...new Set(state.data.map(d => d.consultor))].sort();
  const porConsultor = {};
  allConsultants.forEach(c => porConsultor[c] = { count: 0, workload: 0 });

  filteredData.forEach(d => {
    porConsultor[d.consultor].count += 1; porConsultor[d.consultor].workload += (FREQ_WEIGHTS[d.frecuencia] || 0.1);
  });
  const labels = Object.keys(porConsultor);
  state.charts['chart-workload'] = new Chart(document.getElementById('chart-workload'), {
    type: 'bar', data: { labels, datasets: [
      { label: 'Total Entidades', data: labels.map(l => porConsultor[l].count), backgroundColor: COLORES.fondoBarra },
      { label: 'Workload (Peso)', data: labels.map(l => porConsultor[l].workload), backgroundColor: COLORES.primario }
    ]},
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
  });
}

function renderWorkloadMensualChart(activeData) {
  safeDestroyChart('chart-workload-mensual');
  const allConsultants = [...new Set(state.data.map(d => d.consultor))].sort();
  const porConsultor = {};
  allConsultants.forEach(c => porConsultor[c] = { count: 0, workload: 0 });

  activeData.forEach(d => {
    porConsultor[d.consultor].count += 1; porConsultor[d.consultor].workload += (FREQ_WEIGHTS[d.frecuencia] || 0.1);
  });
  const labels = Object.keys(porConsultor);
  state.charts['chart-workload-mensual'] = new Chart(document.getElementById('chart-workload-mensual'), {
    type: 'bar', data: { labels, datasets: [
      { label: 'Entidades (Mes)', data: labels.map(l => porConsultor[l].count), backgroundColor: COLORES.fondoBarra },
      { label: 'Workload (Mes)', data: labels.map(l => porConsultor[l].workload), backgroundColor: COLORES.primario }
    ]},
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
  });
}

// --- 7. INFORME POR CONSULTOR (HTML autónomo, mismo app.js) ---

// Arranque cuando el HTML contiene datos embebidos (window.__REPORT__) en vez de pedir el CSV
function bootReport() {
  document.getElementById('badge-data-source').innerHTML = '<span class="blink-dot">●</span> INFORME OFFLINE';
  document.getElementById('badge-data-source').classList.remove('live');

  state.data = window.__REPORT__.data;
  state.activeMonths = MONTHS.filter(m =>
    state.data.some(row => row.meses[m.key] && (row.meses[m.key].plan !== null || row.meses[m.key].cap !== null))
  );
  if (state.activeMonths.length > 0) state.currentMonth = state.activeMonths[0].key;

  initUI();
  const btnInforme = document.getElementById('btn-descargar-informe');
  if (btnInforme) btnInforme.style.display = 'none'; // no tiene sentido re-generar dentro de un informe ya generado

  updateView();
  showLoading(false);
}

function sanitizeFilename(name) {
  return (name || 'consultor').replace(/[\\/:*?"<>|]/g, '-').trim();
}

// Convierte el logo a data URI para que el informe funcione sin internet
function imageToDataUrl(src) {
  return fetch(src)
    .then(r => r.blob())
    .then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }))
    .catch(() => ''); // logo opcional: si falla, el <img onerror> ya existente cae al emoji
}

// Genera un .html autónomo: mismo index.html + styles.css + app.js, con los datos
// del consultor embebidos. Al abrirlo, bootReport() los usa en vez de pedir el CSV.
async function descargarInforme(consultor) {
  if (window.__REPORT__) { alert('La descarga de informes no está disponible dentro de un informe ya generado.'); return; }

  const btn = document.getElementById('btn-descargar-informe');
  const originalText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }

  try {
    const [htmlText, cssText, jsText, logoDataUrl] = await Promise.all([
      fetch('index.html').then(r => r.text()),
      fetch('styles.css').then(r => r.text()),
      fetch('app.js').then(r => r.text()),
      imageToDataUrl('LOGO-VECTOR-01-TRANSPARENTE-1.png')
    ]);

    const payload = {
      consultor: consultor,
      data: state.data.filter(d => d.consultor === consultor),
      generatedAt: new Date().toISOString()
    };
    // Blindar contra '</script>' o '<' dentro de observaciones del CSV
    const payloadJson = JSON.stringify(payload).replace(/</g, '\\u003c');
    // app.js contiene el literal '</script>' (el propio replace de abajo) — sin esto
    // el HTML parser cierra el <script> a mitad de archivo y el resto se ve como texto
    const safeJsText = jsText.replace(/<\/script/gi, '<\\/script');

    const html = htmlText
      .replace('<link rel="stylesheet" href="styles.css" />', `<style>${cssText}</style>`)
      .replace('src="LOGO-VECTOR-01-TRANSPARENTE-1.png"', `src="${logoDataUrl}"`)
      .replace('<script src="app.js"></script>', `<script>window.__REPORT__ = ${payloadJson};</script>\n<script>${safeJsText}</script>`);

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Informe_${sanitizeFilename(consultor)}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error generando informe:', err);
    alert('No se pudo generar el informe. Verifica que el dashboard se esté sirviendo vía http://localhost (no abierto con doble clic).');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}

// --- 8. INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', function() {
  if (window.__REPORT__) { bootReport(); return; }
  if (location.protocol === 'file:') { mostrarErrorFileProtocol(); return; }
  initData();
});
