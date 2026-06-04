# CGE Dashboard — Prompt Mejorado y Corregido
> Basado en análisis directo del archivo real: `REGISTRO___PLAN_DE_TRABAJO_Y_CAPACITACION_-_MAYO_2026.xlsx`
> **Fecha:** Mayo 2026 | **Filas reales:** 333 entidades | **Columnas:** 51

---

## 🔴 CORRECCIONES CRÍTICAS AL PROMPT ORIGINAL

Las siguientes secciones contienen errores factuales detectados en el archivo real que **romperían el dashboard si no se corrigen**:

| # | Error en prompt original | Realidad en el CSV |
|---|---|---|
| 1 | `OBSERVACIONES - FECHA DE CORTE - [MONTH]` | Ver sección 2B — los nombres reales son distintos |
| 2 | Frecuencias: "MENSUAL, BIMESTRAL, SEMESTRAL" | Reales: MENSUAL, BIMESTRAL, TRIMESTRALMENTE, BIMENSUAL (typo) |
| 3 | No menciona columnas `FINAL DE [MES]` | Existen y deben ignorarse (6 columnas basura) |
| 4 | Valor "0" como placeholder | El CSV usa "1" como proxy de 0% — ver sección 3 |
| 5 | Mock CSV simple | Debe replicar exactamente la estructura de 51 columnas |

---

## 1. Tech Stack
- **Estructura:** HTML5 semántico.
- **Estilos:** CSS3 puro (Variables CSS, Flexbox, CSS Grid). **PROHIBIDO:** Bootstrap, Tailwind, cualquier framework CSS externo.
- **Lógica:** JavaScript ES6+ vanilla. **PROHIBIDO:** React, Vue, Angular, jQuery.
- **Fuente de datos:** Google Sheets publicado como CSV (PapaParse via CDN).
- **Librerías externas (solo CDN):** PapaParse 5.x y Chart.js 4.x.
- **Despliegue objetivo:** Netlify — completamente estático, sin backend.

---

## 2. Estructura Real del CSV (Fuente de Verdad)

### 2A. Columnas fijas (primeras 3)
```
ENTIDAD                   → Nombre del cliente
FRECUENCIA DE CONSULTORIA → Frecuencia del servicio
CONSULTOR                 → Nombre del consultor asignado
```

### 2B. Estructura por mes — **NOMBRES EXACTOS DE COLUMNAS** ⚠️

Cada mes tiene **6 columnas** en este orden exacto. La OBSERVACIONES tiene naming inconsistente por ser columna duplicada en Google Sheets (pandas la renombra al exportar CSV):

| Columna | MAYO (mes 1) | JUNIO (mes 2) | JULIO (mes 3) | ... patrón |
|---|---|---|---|---|
| % Plan | `% PLAN ANUAL DE TRABAJO - MAYO` | `% PLAN ANUAL DE TRABAJO - JUNIO` | `% PLAN ANUAL DE TRABAJO - JULIO` | `% PLAN ANUAL DE TRABAJO - [MES]` |
| % Capacitación | `% PROGRAMA DE CAPACITACION - MAYO` | `% PROGRAMA DE CAPACITACION - JUNIO` | `% PROGRAMA DE CAPACITACION - JULIO` | `% PROGRAMA DE CAPACITACION - [MES]` |
| ⛔ PROGRESO Plan | `PROGRESO PLAN ANUAL DE TRABAJO - MAYO` | `PROGRESO PLAN ANUAL DE TRABAJO - JUNIO` | ... | **IGNORAR** |
| ⛔ PROGRESO Cap. | `PROGRESO PROGRAMA DE CAPACITACION - MAYO` | `PROGRESO PROGRAMA DE CAPACITACION - JUNIO` | ... | **IGNORAR** |
| Observaciones | `OBSERVACIONES - FECHA DE CORTE` | `OBSERVACIONES - FECHA DE CORTE.1` | `OBSERVACIONES - FECHA DE CORTE.2` | `.N` donde N = índice 0-based del mes |
| ⛔ Separador | `FINAL DE MAYO` | `FINAL DE JUNIO` | `FINAL DE JULIO` | **IGNORAR** |

**Regla de parsing para OBSERVACIONES:** Dado que Google Sheets exporta duplicados con sufijos, el mapeo correcto de OBSERVACIONES por mes es:
- MAYO → `OBSERVACIONES - FECHA DE CORTE` (sin sufijo)
- JUNIO → `OBSERVACIONES - FECHA DE CORTE.1`
- JULIO → `OBSERVACIONES - FECHA DE CORTE.2`
- AGOSTO → `OBSERVACIONES - FECHA DE CORTE.3`
- SEPTIEMBRE → `OBSERVACIONES - FECHA DE CORTE.4`
- OCTUBRE → `OBSERVACIONES - FECHA DE CORTE.5`
- NOVIEMBRE → `OBSERVACIONES - FECHA DE CORTE.6`
- DICIEMBRE → `OBSERVACIONES - FECHA DE CORTE.7`

### 2C. Meses cubiertos (Mayo → Diciembre 2026)
```javascript
const MONTHS = [
  { key: 'MAYO',       obsKey: 'OBSERVACIONES - FECHA DE CORTE',    displayLabel: 'Abril (ejecución)'     },
  { key: 'JUNIO',      obsKey: 'OBSERVACIONES - FECHA DE CORTE.1',  displayLabel: 'Mayo (ejecución)'      },
  { key: 'JULIO',      obsKey: 'OBSERVACIONES - FECHA DE CORTE.2',  displayLabel: 'Junio (ejecución)'     },
  { key: 'AGOSTO',     obsKey: 'OBSERVACIONES - FECHA DE CORTE.3',  displayLabel: 'Julio (ejecución)'     },
  { key: 'SEPTIEMBRE', obsKey: 'OBSERVACIONES - FECHA DE CORTE.4',  displayLabel: 'Agosto (ejecución)'   },
  { key: 'OCTUBRE',    obsKey: 'OBSERVACIONES - FECHA DE CORTE.5',  displayLabel: 'Septiembre (ejecución)'},
  { key: 'NOVIEMBRE',  obsKey: 'OBSERVACIONES - FECHA DE CORTE.6',  displayLabel: 'Octubre (ejecución)'  },
  { key: 'DICIEMBRE',  obsKey: 'OBSERVACIONES - FECHA DE CORTE.7',  displayLabel: 'Noviembre (ejecución)' },
];
```

---

## 3. CRÍTICO: Sanitización y Programación Defensiva

### 3A. Blacklist de columnas (NO parsear JAMÁS)
```javascript
const COLUMN_BLACKLIST_PATTERNS = [
  'PROGRESO',   // Columnas con fórmulas SPARKLINE de Google Sheets
  'FINAL DE',   // Columnas separadoras entre meses (contienen el nombre del mes o NaN)
];
// Implementar como: COLUMN_BLACKLIST_PATTERNS.some(p => colName.includes(p))
```

### 3B. Whitelist estricta para métricas numéricas
Solo extraer datos de columnas que empiecen **exactamente** con:
- `% PLAN ANUAL DE TRABAJO -`
- `% PROGRAMA DE CAPACITACION -`

### 3C. Escala de valores
Los porcentajes están en escala **0–100** (enteros o decimales). **NO** en escala 0–1.
Ejemplo real: `91.0`, `100.0`, `75.0`.

### 3D. El problema del valor "1" como proxy de cero ⚠️
**Crítico:** Muchas entidades tienen `% PROGRAMA DE CAPACITACION = 1.0` con observaciones como *"CAPACITACION PORCENTAJE A 0"*. El valor `1` se usa como placeholder porque Google Sheets no permite vaciar la celda del gráfico sparkline. El código **DEBE**:
- Tratar el valor `1` como dato válido para cálculos (no ignorarlo)
- **Marcar visualmente** en la tabla de riesgos cuando % ≤ 1 con un badge "SIN DATOS" en rojo
- **NO confundir** con valores nulos: un `1` es un registro intencional, un `NaN` es mes sin datos

### 3E. Conversión segura de porcentajes
```javascript
function safePercent(val) {
  const n = parseFloat(val);
  if (isNaN(n) || val === '' || val === null || val === undefined) return null; // mes sin datos
  return Math.min(100, Math.max(0, n)); // clamp
}
// null = mes sin datos (excluir de promedios)
// 0–100 = dato válido (incluir en promedios, incluyendo 1)
```

### 3F. Normalización de CONSULTOR y FRECUENCIA
```javascript
// Normalizar variantes tipográficas del CSV real:
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

### 3G. Valores reales de FRECUENCIA en el CSV
```
MENSUAL          → 281 entidades (peso workload = 1.0)
BIMESTRAL        → 47 entidades  (peso workload = 0.5)
TRIMESTRALMENTE  → 4 entidades   (peso workload = 0.33)
BIMENSUAL        → 1 entidad     (normalizar → BIMESTRAL = 0.5)
```
**⚠️ "SEMESTRAL" NO existe en el CSV real — remover del código.**

### 3H. Orphan Accounts (Cuentas Huérfanas)
Entidades a clasificar como riesgo de cuenta huérfana:
- `CONSULTOR === 'SIN CONSULTOR'` → 6 entidades reales
- `CONSULTOR === 'GESTOR'` → 12 entidades reales (gestionadas pero sin consultor dedicado)
Total riesgo potencial: ~18 entidades = 5.4% del portafolio

---

## 4. Lógica de Negocio Central

### 4A. Label Mapping (Desfase de Mes)
El dato registrado en el mes `X` corresponde a la **ejecución del mes anterior**. Esto es porque el consultor visita al cliente en el mes `X` y documenta el avance de `X-1`.
- Columna **MAYO** → UI muestra: **"Ejecución Abril"**
- Columna **JUNIO** → UI muestra: **"Ejecución Mayo"**
- etc.

### 4B. Estado actual del CSV (Mayo 2026)
**Solo MAYO tiene datos** (96 de 333 entidades tienen porcentajes en MAYO).
Todos los meses de JUNIO a DICIEMBRE están completamente vacíos.
- El gráfico YTD Line Chart solo tendrá **1 punto** al inicio.
- El dropdown de selección de mes solo debe activar MAYO en la vista mensual.
- Los meses futuros deben detectarse automáticamente como "sin datos" y excluirse de gráficos.

```javascript
// Detectar meses con datos (al menos 1 entidad con valor no-nulo)
function getActiveMonths(data) {
  return MONTHS.filter(m => 
    data.some(row => safePercent(row[`% PLAN ANUAL DE TRABAJO - ${m.key}`]) !== null)
  );
}
```

### 4C. Velocidad Mes a Mes (Month-over-Month Velocity)
Para el contexto actual (solo MAYO con datos), mostrar la columna pero indicar "N/A" para meses sin comparativo previo. La función debe estar implementada para cuando lleguen datos futuros:
```javascript
function calcVelocity(currentPct, prevPct) {
  if (currentPct === null || prevPct === null) return null;
  return currentPct - prevPct; // positivo = avance, negativo = retroceso
}
```

### 4D. Implementation Gap (Brecha de Implementación)
```javascript
// Diferencia absoluta entre Plan de Trabajo vs Capacitación
function calcGap(planPct, capPct) {
  if (planPct === null || capPct === null) return null;
  return Math.abs(planPct - capPct);
}
// Gap > 30 = riesgo ALTO (heatmap rojo)
// Gap 15-30 = riesgo MEDIO (heatmap naranja)
// Gap < 15 = OK (heatmap verde)
```

### 4E. Weighted Workload Score (Puntuación de Carga Real)
```javascript
const FREQ_WEIGHTS = {
  'MENSUAL': 1.0,
  'BIMESTRAL': 0.5,
  'TRIMESTRALMENTE': 0.33,
  'SIN FRECUENCIA': 0.1,
};

function calcWorkloadScore(entities) {
  return entities.reduce((sum, e) => {
    const w = FREQ_WEIGHTS[normalizeFrecuencia(e['FRECUENCIA DE CONSULTORIA'])] ?? 0.1;
    return sum + w;
  }, 0);
}
```

---

## 5. UI/UX — Dos Vistas Principales

La interfaz debe tener un **toggle switch** superior que divida en dos modos:

### Vista 1: "Vista Mensual" (Micro)
- Rendimiento del mes seleccionado via dropdown.
- El dropdown solo muestra meses **con datos reales** (actualmente solo MAYO).
- Label de mes usa el displayLabel del mapping (ej: "Abril — ejecución").
- KPI Cards, tabla de entidades, gráficos de barras por consultor.

### Vista 2: "Vista Anual YTD" (Macro)
- Progreso acumulado desde inicio hasta el mes activo.
- Line chart con evolución mes a mes (solo puntos con datos reales).
- Gráfico de radar o barras de workload vs esfuerzo.
- Distribuciónde frecuencia (doughnut chart).

---

## 6. Componentes y Features

### A. KPI Cards (dinámicos por vista activa)
1. **Total Entidades Activas** — con datos en el mes seleccionado (96 en MAYO, no 333)
2. **Total Consultores Activos** — consultores con al menos 1 entidad activa
3. **% Promedio Plan de Trabajo** — solo sobre entidades con datos (excluir nulos)
4. **% Promedio Capacitación** — solo sobre entidades con datos (excluir nulos)
5. **% Cuentas Huérfanas** — (SIN CONSULTOR + GESTOR) / total entidades × 100

### B. Filtros Globales
- **Selector de Mes** (Dropdown) — solo meses activos
- **Selector de Consultor** (Dropdown) — lista de consultores únicos normalizados
- **Búsqueda de Entidad** (input texto) — filtro en tiempo real sobre la tabla maestra

### C. Acordeón de Consultores
Lista interactiva de consultores. Al expandir, muestra:
- Entidades asignadas con su FRECUENCIA
- % Plan de Trabajo del mes
- % Capacitación del mes
- Implementation Gap con color coding
- Observaciones del mes

### D. Visualizaciones Chart.js

**D1. YTD Trend (Line Chart)**
- Eje X: meses con datos reales únicamente (label = displayLabel)
- Eje Y: 0–100%
- 2 líneas: "% Plan de Trabajo" (azul) vs "% Capacitación" (naranja)
- Nota: con datos actuales solo habrá 1 punto; la línea crecerá mes a mes.

**D2. Rendimiento por Consultor (Grouped Bar Chart)**
- Barras agrupadas: % Plan vs % Capacitación por consultor
- Solo consultores con datos en el período seleccionado
- Ordenar de mayor a menor rendimiento

**D3. Workload vs Esfuerzo (Horizontal Bar Chart o Radar)**
- Comparar: N° entidades brutas vs Weighted Workload Score por consultor
- Permite identificar quién tiene más carga real vs carga aparente

**D4. Distribución de Frecuencia (Doughnut Chart)**
- Proporción de entidades por FRECUENCIA (MENSUAL, BIMESTRAL, TRIMESTRALMENTE)
- Incluir leyenda con conteos absolutos

### E. Tablas

**E1. Risk Alerts — Top 10 Peores**
Tabla heatmap con las 10 entidades de mayor riesgo. Criterios de ordenamiento:
1. Mayor Implementation Gap
2. Menor % promedio (Plan + Capacitación) / 2
3. Badge especial "SIN DATOS" si % = 1 (proxy de cero)

Columnas: Entidad | Consultor | % Plan | % Capac. | Gap | Estado | Observaciones

**E2. Tabla Maestra**
Todas las entidades, respondiendo a los filtros globales.
Columnas: Entidad | Frecuencia | Consultor | % Plan | % Capac. | Gap | Observaciones
- Ordenable por columna (click en header)
- Paginación si hay más de 50 filas

---

## 7. Mock CSV para Desarrollo (app.js)

El mock CSV embebido en `app.js` DEBE:
1. Replicar exactamente los **51 nombres de columna** del CSV real (incluyendo `OBSERVACIONES - FECHA DE CORTE` sin sufijo para MAYO y `.1`–`.7` para meses siguientes, y `FINAL DE [MES]` como columnas separadoras).
2. Incluir mínimo **20 filas** representativas con:
   - Entidades con datos completos en MAYO (% Plan y % Capac.)
   - Entidades sin datos en MAYO (todos NaN)
   - 1 entidad con `CONSULTOR = 'SIN CONSULTOR'`
   - 1 entidad con `CONSULTOR = 'GESTOR'`
   - 1 entidad con `CONSULTOR = 'DEIBY'` (typo sin apellido)
   - 2–3 entidades con `% PROGRAMA DE CAPACITACION - MAYO = 1` (proxy de 0%)
   - 1 entidad con `FRECUENCIA = 'BIMENSUAL'` (typo)
   - 1 entidad con `FRECUENCIA = 'TRIMESTRALMENTE'`
   - Columnas PROGRESO con valores `#NAME?` o texto fórmula para probar sanitización
   - Columnas FINAL DE [MES] con valores `MAYO` o NaN para probar blacklist
3. Todos los meses JUNIO–DICIEMBRE deben tener valores vacíos/NaN para simular el estado real actual.

**Ejemplo de estructura del header del mock CSV:**
```
ENTIDAD,FRECUENCIA DE CONSULTORIA,CONSULTOR,% PLAN ANUAL DE TRABAJO - MAYO,% PROGRAMA DE CAPACITACION - MAYO,PROGRESO PLAN ANUAL DE TRABAJO - MAYO,PROGRESO PROGRAMA DE CAPACITACION - MAYO,OBSERVACIONES - FECHA DE CORTE,FINAL DE MAYO,% PLAN ANUAL DE TRABAJO - JUNIO,% PROGRAMA DE CAPACITACION - JUNIO,PROGRESO PLAN ANUAL DE TRABAJO - JUNIO,PROGRESO PROGRAMA DE CAPACITACION - JUNIO,OBSERVACIONES - FECHA DE CORTE.1,FINAL DE JUNIO,...[continúa igual para JULIO a DICIEMBRE]
```

---

## 8. Diseño Visual (UI/UX Guidelines)

**Paleta:** Profesional y corporativa. Sugerencia:
- Primario: `#1A2E4A` (azul marino oscuro — confianza, compliance)
- Acento 1: `#00A896` (teal — progreso, éxito)
- Acento 2: `#F4A261` (naranja — advertencia, riesgo medio)
- Alerta: `#E63946` (rojo — riesgo alto, cuentas huérfanas)
- Fondo: `#F0F4F8` con cards blancas

**Tipografía:** Evitar Inter/Roboto/Arial. Usar combinaciones como:
- Display: `IBM Plex Sans Condensed` o `Barlow Condensed` (headers)
- Body: `Source Sans 3` o `Nunito Sans` (datos)

**Responsive:** Mobile-first. Las tarjetas KPI colapsan a 2 columnas en tablet, 1 en móvil.

**Animaciones:** Números de KPI con counter-up animation al cargar. Acordeón con transición smooth. Barras de progreso animadas.

---

## 9. Output Esperado

Tres archivos separados: `index.html`, `styles.css`, `app.js`.

El código debe estar:
- **Modularizado** en funciones con nombres descriptivos
- **Comentado** en español (empresa colombiana)
- **Sin dependencias de backend** — todo cliente-side
- **Preparado para producción** — la URL del CSV real de Google Sheets se configura en una constante al inicio de `app.js`:
  ```javascript
  const CSV_URL = 'TU_URL_DE_GOOGLE_SHEETS_AQUI'; // formato: .../pub?output=csv
  const USE_MOCK_DATA = true; // cambiar a false en producción
  ```

---

## 10. Consultores Reales (Referencia para Mock CSV)

Para que el mock sea realista, usar estos nombres reales del CSV:
```
DIEGO CALDERON (54 entidades), DANIEL RAMIREZ (45), LUISA FERNANDA (41),
MIGUEL SIERRA (33), DEIBY MORENO (30), KAREN RAMIREZ (29),
ANA MARIA CHIAPPE (29), ANDREA CONTRERAS (23), NELLY MARTIN (17),
GESTOR (12), MIGUEL DAVILA (7), SIN CONSULTOR (6),
NAIDU FERNANDEZ (4), PILAR RAMIREZ (2), DEIBY (1 → normalizar a DEIBY MORENO)
```

---

*Prompt generado mediante análisis directo del archivo Excel/CSV de CGE — Mayo 2026.*
*Correcciones aplicadas sobre: estructura de columnas, nombres exactos de OBSERVACIONES, valores de FRECUENCIA, proxy de cero (valor=1), columnas FINAL DE [MES], y distribución real de consultores.*
