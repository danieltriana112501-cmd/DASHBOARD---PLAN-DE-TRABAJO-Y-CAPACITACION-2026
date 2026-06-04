# AGENTS.md — CGE Dashboard: Porcentajes de Trabajo y Capacitación

> Guía para agentes de codificación IA que trabajen en este proyecto.
> Proyecto colombiano — comentarios y variables de UI en **español**.
> Fecha de referencia: **Mayo 2026** | Fuente real: `REGISTRO___PLAN_DE_TRABAJO_Y_CAPACITACION_-_MAYO_2026.xlsx`
> ⚠️ **USO INTERNO — CGE. No compartir externamente.**

---

## 📦 Tech Stack (estricto — no desviar)

| Capa | Tecnología permitida | Prohibido |
|---|---|---|
| Estructura | HTML5 semántico | Cualquier framework HTML |
| Estilos | CSS3 puro + Variables CSS + Flexbox + Grid | Bootstrap, Tailwind, cualquier lib CSS externa |
| Lógica | JavaScript ES6+ vanilla | React, Vue, Angular, jQuery |
| Datos | Google Sheets publicado como CSV (PapaParse 5.x via CDN) | Cualquier backend / Node.js |
| Gráficos | Chart.js 4.x via CDN | D3, ApexCharts, Highcharts |
| Despliegue | Netlify — sitio 100% estático | Vercel con SSR, Firebase functions |

**Output esperado siempre: 3 archivos separados — `index.html`, `styles.css`, `app.js`.**

---

## 🚀 Configuración del entorno de desarrollo

- **OBLIGATORIO**: El dashboard NUNCA se puede abrir con doble clic en `index.html` — el navegador bloquea las peticiones a Google Sheets por CORS.
- Siempre servir con un servidor local:
  ```bash
  npx serve -l 8080
  # Luego abrir: http://localhost:8080
  ```
- Para modo producción (datos reales), en `app.js`:
  ```javascript
  const CSV_URL = 'https://docs.google.com/spreadsheets/d/1Bq-tn32eN0WIWoarZpeYpg2qVEAmLy4IcYB8gdyb_Zk/export?format=csv';
  const USE_MOCK_DATA = false;
  ```
- Para desarrollo local, cambiar `USE_MOCK_DATA = true` y usar el mock embebido en `app.js`.
- Subir a Netlify arrastrando la carpeta con los 3 archivos (drag & drop deploy).

---

## 📊 Estructura real del CSV — Fuente de verdad

### Columnas fijas (primeras 3)
```
ENTIDAD                   → Nombre del cliente/empresa
FRECUENCIA DE CONSULTORIA → Frecuencia del servicio
CONSULTOR                 → Nombre del consultor asignado
```

### Patrón por mes (6 columnas × 8 meses = 48 columnas adicionales)

| Tipo | Nombre en CSV | Acción |
|---|---|---|
| ✅ Usar | `% PLAN ANUAL DE TRABAJO - [MES]` | Extraer como dato |
| ✅ Usar | `% PROGRAMA DE CAPACITACION - [MES]` | Extraer como dato |
| ⛔ Ignorar | `PROGRESO PLAN ANUAL DE TRABAJO - [MES]` | Blacklist |
| ⛔ Ignorar | `PROGRESO PROGRAMA DE CAPACITACION - [MES]` | Blacklist |
| ✅ Usar | `OBSERVACIONES - FECHA DE CORTE[.N]` | Ver regla abajo |
| ⛔ Ignorar | `FINAL DE [MES]` | Blacklist |

### Mapeo exacto de OBSERVACIONES (Google Sheets agrega sufijo a columnas duplicadas)
```
MAYO       → OBSERVACIONES - FECHA DE CORTE      (sin sufijo)
JUNIO      → OBSERVACIONES - FECHA DE CORTE.1
JULIO      → OBSERVACIONES - FECHA DE CORTE.2
AGOSTO     → OBSERVACIONES - FECHA DE CORTE.3
SEPTIEMBRE → OBSERVACIONES - FECHA DE CORTE.4
OCTUBRE    → OBSERVACIONES - FECHA DE CORTE.5
NOVIEMBRE  → OBSERVACIONES - FECHA DE CORTE.6
DICIEMBRE  → OBSERVACIONES - FECHA DE CORTE.7
```

### Constante MONTHS en app.js (no modificar el orden)
```javascript
const MONTHS = [
  { key: 'MAYO',       obsKey: 'OBSERVACIONES - FECHA DE CORTE',    displayLabel: 'Abril (ejecución)'      },
  { key: 'JUNIO',      obsKey: 'OBSERVACIONES - FECHA DE CORTE.1',  displayLabel: 'Mayo (ejecución)'       },
  { key: 'JULIO',      obsKey: 'OBSERVACIONES - FECHA DE CORTE.2',  displayLabel: 'Junio (ejecución)'      },
  { key: 'AGOSTO',     obsKey: 'OBSERVACIONES - FECHA DE CORTE.3',  displayLabel: 'Julio (ejecución)'      },
  { key: 'SEPTIEMBRE', obsKey: 'OBSERVACIONES - FECHA DE CORTE.4',  displayLabel: 'Agosto (ejecución)'    },
  { key: 'OCTUBRE',    obsKey: 'OBSERVACIONES - FECHA DE CORTE.5',  displayLabel: 'Septiembre (ejecución)' },
  { key: 'NOVIEMBRE',  obsKey: 'OBSERVACIONES - FECHA DE CORTE.6',  displayLabel: 'Octubre (ejecución)'   },
  { key: 'DICIEMBRE',  obsKey: 'OBSERVACIONES - FECHA DE CORTE.7',  displayLabel: 'Noviembre (ejecución)'  },
];
```

---

## ⚠️ Reglas críticas de parsing — leer antes de tocar app.js

### Blacklist de columnas (NUNCA parsear)
```javascript
const COLUMN_BLACKLIST_PATTERNS = ['PROGRESO', 'FINAL DE'];
// Uso: COLUMN_BLACKLIST_PATTERNS.some(p => colName.includes(p))
```

### Whitelist para métricas numéricas (SOLO estas)
- `% PLAN ANUAL DE TRABAJO -` (prefijo exacto)
- `% PROGRAMA DE CAPACITACION -` (prefijo exacto)

### Escala de porcentajes
- Rango: **0–100** (enteros o decimales). **NO 0–1.**
- Ejemplos reales: `91.0`, `100.0`, `75.0`, `1.0`

### El valor `1` como proxy de cero ⚠️ (bug intencional del cliente)
- Google Sheets no permite celdas vacías en columnas con gráfico sparkline.
- `% PROGRAMA DE CAPACITACION = 1.0` con observación *"CAPACITACION PORCENTAJE A 0"* = sin datos reales.
- **Regla:** Tratar `1` como dato válido en cálculos, pero mostrar badge **"SIN DATOS"** en rojo cuando `% ≤ 1`.
- **NO confundir** `1` (intencional) con `NaN` (mes sin registrar).

### Función de conversión segura (usar siempre)
```javascript
function safePercent(val) {
  const n = parseFloat(val);
  if (isNaN(n) || val === '' || val === null || val === undefined) return null;
  return Math.min(100, Math.max(0, n));
}
// null = mes sin datos → excluir de promedios
// 0–100 = dato válido → incluir en promedios (incluyendo 1)
```

---

## 🏢 Datos de negocio — referencia rápida

### Frecuencias reales en el CSV
```
MENSUAL         → 281 entidades  | peso workload = 1.0
BIMESTRAL       → 47 entidades   | peso workload = 0.5
TRIMESTRALMENTE → 4 entidades    | peso workload = 0.33
BIMENSUAL       → 1 entidad      | normalizar → BIMESTRAL
```
**⚠️ "SEMESTRAL" NO existe en el CSV — no agregarlo al código.**

### Normalización obligatoria
```javascript
function normalizeConsultor(raw) {
  const s = (raw || '').trim().toUpperCase();
  if (!s || s === 'SIN CONSULTOR') return 'SIN CONSULTOR';
  if (s === 'GESTOR') return 'GESTOR';
  if (s === 'DEIBY') return 'DEIBY MORENO'; // typo real en el CSV
  return raw.trim();
}

function normalizeFrecuencia(raw) {
  const s = (raw || '').trim().toUpperCase();
  if (s === 'BIMENSUAL') return 'BIMESTRAL'; // typo real en el CSV
  return s || 'SIN FRECUENCIA';
}
```

### Consultores reales (para mock CSV realista)
```
DIEGO CALDERON (54), DANIEL RAMIREZ (45), LUISA FERNANDA (41),
MIGUEL SIERRA (33), DEIBY MORENO (30), KAREN RAMIREZ (29),
ANA MARIA CHIAPPE (29), ANDREA CONTRERAS (23), NELLY MARTIN (17),
GESTOR (12), MIGUEL DAVILA (7), SIN CONSULTOR (6),
NAIDU FERNANDEZ (4), PILAR RAMIREZ (2), DEIBY (1 → normalizar)
```

### Cuentas huérfanas (riesgo de portafolio)
- `CONSULTOR === 'SIN CONSULTOR'` → 6 entidades
- `CONSULTOR === 'GESTOR'` → 12 entidades
- Total en riesgo: ~18 entidades = **5.4% del portafolio**

### Estado actual del CSV (Mayo 2026)
- **Solo MAYO tiene datos** — 96 de 333 entidades reportaron.
- JUNIO → DICIEMBRE están completamente vacíos.
- El YTD Line Chart arranca con **1 solo punto**; crecerá mes a mes.

---

## 🎨 Diseño visual — convenciones

### Paleta corporativa
```css
--color-primario:  #1A2E4A; /* azul marino — confianza, compliance */
--color-acento-1:  #00A896; /* teal — progreso, éxito */
--color-acento-2:  #F4A261; /* naranja — advertencia, riesgo medio */
--color-alerta:    #E63946; /* rojo — riesgo alto, cuentas huérfanas */
--color-fondo:     #F0F4F8;
--color-card:      #FFFFFF;
```

### Tipografía (Google Fonts — no usar Inter, Roboto ni Arial)
- Display/headers: `IBM Plex Sans Condensed` o `Barlow Condensed`
- Body/datos: `Source Sans 3` o `Nunito Sans`

### Animaciones requeridas
- Counter-up en números KPI al cargar.
- Smooth transition en acordeón de consultores.
- Barras de progreso animadas al renderizar.

### Responsive
- Mobile-first.
- KPI cards: 4 columnas en desktop → 2 en tablet → 1 en móvil.

---

## 🧪 Mock CSV — instrucciones

El mock embebido en `app.js` DEBE cubrir estos casos de borde:

| Caso | ¿Por qué? |
|---|---|
| Mínimo 20 filas | Cubrir paginación y filtros |
| Entidades con datos completos en MAYO | Flujo normal |
| Entidades sin datos en MAYO (NaN) | Detección de meses inactivos |
| 1 fila con `CONSULTOR = 'SIN CONSULTOR'` | Cuentas huérfanas |
| 1 fila con `CONSULTOR = 'GESTOR'` | Cuentas huérfanas |
| 1 fila con `CONSULTOR = 'DEIBY'` | Normalización de typos |
| 2-3 filas con `% CAPACITACION = 1` | Proxy de cero |
| 1 fila con `FRECUENCIA = 'BIMENSUAL'` | Normalización de typos |
| 1 fila con `FRECUENCIA = 'TRIMESTRALMENTE'` | Peso workload = 0.33 |
| Columnas PROGRESO con `#NAME?` | Prueba de blacklist / sanitización |
| Columnas `FINAL DE [MES]` con texto | Prueba de blacklist |
| JUNIO–DICIEMBRE todos vacíos | Estado real del CSV en Mayo 2026 |

**El header del mock debe replicar exactamente los 51 nombres de columna del CSV real.**

---

## 📐 Convenciones de código

- **Idioma de comentarios:** Español (empresa colombiana).
- **Idioma de variables internas:** inglés (camelCase).
- **Idioma de la UI:** Español.
- **Modularización:** Una función por responsabilidad; nombres descriptivos en inglés.
- **Sin dependencias de backend:** Todo debe correr 100% en el navegador.
- **Desfase de mes (Label Mapping):** El dato del mes `X` representa la ejecución del mes `X-1`. Usar siempre `displayLabel` del array `MONTHS`, no el `key` directamente.

### ⚠️ Semaforización corporativa (REEMPLAZA el sistema de Gap)

El sistema usa el **peor** de los dos porcentajes (Plan vs Cap) para determinar la categoría de la empresa. NO se usa el Gap.

```javascript
// getEntityRisk(plan, cap) — única fuente de verdad
// Se calcula en processParsedData() y se guarda en m.risk
// Los renderizadores SOLO leen m.risk, nunca recalculan.

// worst = Math.min(plan, cap)  ← el peor de los dos
// worst ≤ 1    → SIN_DATOS  (rojo — proxy de cero intencional)
// worst ≤ 49   → ALTO       (rojo   #E63946)  ← 1%–49%
// worst ≤ 84   → MEDIO      (naranja #F4A261)  ← 50%–84%
// worst ≥ 85   → OK         (verde  #00A896)  ← 85%–100%
```

> Este semáforo es el mismo que se usa en el Google Sheets histórico de CGE y en años anteriores.
> **No cambiar los umbrales sin aprobación del cliente.**

> El `gap` (diferencia absoluta plan-cap) sigue calculándose y mostrándose en la tabla **como dato informativo**,
> pero ya NO determina la categoría de riesgo.

---

## 📁 Estructura de archivos esperada

```
/
├── index.html          ← Estructura HTML semántica, carga de CDNs
├── styles.css          ← Todos los estilos (Variables CSS en :root)
├── app.js              ← Lógica, mock CSV, parsing, gráficos
├── AGENTS.md           ← Este archivo (guía para agentes IA)
└── DEVLOG.md           ← Registro de errores y aprendizajes (uso interno)
```

---

## 🧩 Features implementados (estado actual — Mayo 2026)

| Feature | Descripción | Estado |
|---|---|---|
| KPI Cards | 5 tarjetas: Entidades, Consultores, % Plan, % Cap, Huérfanas | ✅ Activo |
| Filtro de Mes | Solo muestra meses con datos reales | ✅ Activo |
| Filtro de Consultor | Dropdown con todos los consultores | ✅ Activo |
| Filtro Estado Reporte | Reportados / Faltantes / Todos | ✅ Activo |
| Buscador de Entidad | Búsqueda en tiempo real | ✅ Activo |
| Tabla Maestra | Paginada (10/página), ordenable por columna | ✅ Activo |
| Top 10 Alertas | Ordenado por semáforo rojo primero, luego peor promedio | ✅ Activo |
| Acordeón Consultores | Expandible, badge de estado por empresa | ✅ Activo |
| Salud del Portafolio | Barras apiladas por riesgo, tooltip con lista de empresas | ✅ Activo |
| Workload Anual | Carga ponderada por frecuencia — Vista Anual YTD | ✅ Activo |
| Workload Mensual | Carga operativa del mes filtrado — Vista Mensual | ✅ Activo |
| Tendencia YTD | Línea de evolución mes a mes | ✅ Activo |
| Distribución Frecuencia | Donut chart — Vista Anual YTD | ✅ Activo |

---

*Actualizado: Mayo 2026 — USO INTERNO CGE.*
