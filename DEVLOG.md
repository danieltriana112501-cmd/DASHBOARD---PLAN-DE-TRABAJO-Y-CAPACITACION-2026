# DEVLOG — CGE Dashboard: Errores y Aprendizajes

> Documento vivo. Cada error encontrado durante desarrollo/pruebas se registra aquí.
> Formato: fecha | archivo | error | causa raíz | solución aplicada.
> **Uso: 100% interno — CGE. No compartir externamente.**

---

## 📋 Plantilla de entrada

```
### [YYYY-MM-DD] — [ARCHIVO AFECTADO]
**Error:** descripción corta del síntoma
**Causa raíz:** por qué ocurre
**Solución:** qué se cambió en el código
**Lección:** regla general para no repetirlo
```

---

## 🟢 Sesión 1 — 2026-05-13 — Construcción inicial y refactoring

### [2026-05-13] — index.html + app.js
**Error:** CORS bloqueaba la carga de `app.js` al abrir `index.html` directamente con doble clic (protocolo `file://`).
**Causa raíz:** Los navegadores modernos bloquean imports entre archivos locales por política de seguridad.
**Solución:** Consolidar todo en un solo `app.js` (sin módulos ES6) y servir con `npx serve -l 8080`.
**Lección:** Siempre servir via `http://localhost`, nunca abrir HTMLs directamente desde el explorador de archivos.

### [2026-05-13] — modules/data.js, modules/ui.js
**Error:** Errores de sintaxis en template literals (backticks) al generar los archivos modulares.
**Causa raíz:** La generación automática de código escapó incorrectamente los backticks.
**Solución:** Migrar a un único `app.js` sin módulos para eliminar la fricción.
**Lección:** Preferir el enfoque monolítico en proyectos puramente estáticos sin bundler.

---

## 🟡 Sesión 2 — 2026-05-13 — Features y corrección de lógica de riesgo

### [2026-05-13] — app.js (renderRiesgosTable, renderConsultorChart)
**Error:** Empresa con Plan=20% y Cap=20% aparecía en "Buen Estado" (Verde) por tener Gap=0.
**Causa raíz:** La categorización original usaba solo el Gap (diferencia absoluta) entre plan y capacitación, ignorando el nivel de cumplimiento real de cada métrica.
**Solución:** Reemplazar lógica de Gap por semáforo corporativo basado en el **peor porcentaje** absoluto:
- 🔴 Rojo (RIESGO ALTO): 1% – 49%
- 🟡 Amarillo (RIESGO MEDIO): 50% – 84%
- 🟢 Verde (OK): 85% – 100%
**Lección:** Siempre usar el umbral de semáforo que el cliente ya conoce y usa en sus herramientas actuales (Google Sheets histórico). No inventar métricas nuevas que confundan al usuario final.

### [2026-05-13] — app.js (renderConsultoresAcordeon)
**Error:** Llamada incorrecta `getEntityRisk(m)` pasando el objeto completo del mes en vez de usar el campo `m.risk` ya calculado al parsear.
**Causa raíz:** El refactor que añadió `risk` al objeto `meses[]` quedó desincronizado con el renderizado del acordeón.
**Solución:** Usar `m.risk` directamente y `getRiskBadge(m.risk)` en todos los renderizadores.
**Lección:** Centralizar la categorización en `processParsedData()` → guardar `risk` en el objeto del mes. Todos los renderizadores solo deben **leer** `m.risk`, nunca recalcular.

---

## 🟢 Sesión 3 — 2026-06-12 — Reconexión CSV + Rediseño corporativo

### [2026-06-12] — app.js (processParsedData, initData)
**Error:** Dashboard no mostraba ningún dato en modo LIVE DATA.
**Causa raíz:** La columna `ENTIDAD` en el CSV real no tiene encabezado (celda vacía o espacio). `row['ENTIDAD']` retornaba `undefined` para todas las filas, y `.filter(item => item.entidad)` eliminaba el 100% de los datos silenciosamente.
**Solución:** Detectar dinámicamente el nombre de la primera columna desde `results.meta.fields[0]` y guardarlo en `ENTIDAD_COL`. `processParsedData` ahora usa `row[ENTIDAD_COL]` en vez del literal.
**Lección:** Nunca asumir el nombre de la columna clave. Usar `meta.fields[0]` de PapaParse para la columna de identidad primaria.

### [2026-06-12] — app.js (MONTHS, buildObsKeyMap)
**Error:** Las observaciones no aparecían en ninguna fila de la tabla.
**Causa raíz:** El hardcoding de `obsKey` con sufijos `.1`–`.7` no coincidía con los nombres reales del CSV:
- JUNIO se renombró a `OBSERVACIONES - FECHA DE CORTE JUNIO` (nombre único).
- JULIO–DICIEMBRE quedaron como `OBSERVACIONES - FECHA DE CORTE` repetidos, que PapaParse convierte en `_1`, `_2`, etc. (no `.1`, `.2`).
**Solución:** Función `buildObsKeyMap(fields)` que detecta el `obsKey` de cada mes por **posición** en el array de columnas: busca la primera columna que empiece con `OBSERVACIONES` después del `% PLAN ANUAL DE TRABAJO - [MES]` correspondiente.
**Lección:** Los nombres de columnas en Google Sheets pueden cambiar arbitrariamente. Mapear siempre por posición relativa, no por nombre exacto.

### [2026-06-12] — styles.css + index.html + app.js
**Cambio:** Rediseño corporativo con paleta naranja CGE `#ff8100`.
- Header: fondo oscuro `#1a1a2e` con franja inferior naranja.
- Acentos, barras de progreso, paginación y badges activos en naranja.
- Soporte de logo SVG/PNG con fallback a emoji (archivo `logo.svg` o `logo.png` en la misma carpeta).
- Paleta Chart.js actualizada: naranja para Plan, oscuro para Cap, verde para OK, dorado para Medio.
**Lección:** Centralizar todos los colores en variables CSS `:root`. Nunca hardcodear colores en CSS fuera del `:root`.

### [2026-06-12] — app.js (buildObsKeyMap)
**Error:** Dashboard se quedaba en "Cargando datos..." indefinidamente (cuelgue silencioso).
**Causa raíz:** En la iteración de columnas dentro de `buildObsKeyMap()`, si PapaParse encontraba una columna vacía o mal formada (generando un `undefined` en el array `fields`), se producía una excepción de tipo `TypeError: Cannot read properties of undefined (reading 'startsWith')`. Al no tener un bloque `try-catch`, el script abortaba y nunca llegaba a ejecutar `showLoading(false)` ni a renderizar los datos.
**Solución:** 
1. Añadir validación estricta `if (!col) continue;` para ignorar columnas vacías/nulas.
2. Añadir bloques `try-catch` robustos tanto en `buildObsKeyMap` como en `processParsedData`, imprimiendo el stack trace directamente en el HTML en caso de error crítico para facilitar el diagnóstico.
**Lección:** Siempre validar la existencia y tipo de un valor antes de invocar métodos de string (`startsWith`, `toUpperCase`), especialmente procesando arrays de librerías de terceros (PapaParse).

### [2026-06-12] — index.html + styles.css
**Cambio:** Se integró el logo oficial `LOGO-VECTOR-01-TRANSPARENTE-1.png` en la cabecera.
**Desafío visual:** El logo cuenta con texto en azul oscuro, que se perdía visualmente al colocarlo directamente sobre el navbar oscuro corporativo (`#1a1a2e`).
**Solución (Cápsula Protectora):** En lugar de cambiar todo el navbar a blanco, se creó un contenedor `.header__logo-wrapper`. Este actúa como una "cápsula" o badge flotante de color blanco puro (`#ffffff`) con bordes redondeados (`12px`).
- Se añadió una sombra volumétrica y un borde interior (`inset`) sutil en color naranja para enlazarlo con la paleta de marca.
- Tiene interactividad (Hover) que lo eleva ligeramente.
- Se mantuvo el sistema de fallback (con `onerror`) al ícono emoji 📊 por si la imagen falla al cargar.
**Lección:** En UI oscura con logos transparentes oscuros, usar un "floating pill" o cápsula aislada es una técnica excelente para mantener el layout general intacto garantizando 100% de contraste y legibilidad para el logo.

---

## 🟢 Sesión 4 — 2026-06-30 — Fix file:// + Informe HTML por consultor

### [2026-06-30] — app.js (CSV_URL, file:// guard)
**Error:** Dashboard no recibía datos pese a que la hoja y el CSV de Google eran válidos (verificado: 346 entidades, 212 con datos en MAYO).
**Causa raíz:** El usuario abría `index.html` con doble clic (protocolo `file://`). Google manda el header `Access-Control-Allow-Origin` para `Origin: http(s)` pero **no** para `Origin: null` (file://) → el fetch del CSV queda bloqueado por CORS antes de llegar al parsing.
**Solución:**
1. `CSV_URL` ahora fija `&gid=0` explícito (antes dependía de que la pestaña "2026" fuera la primera; previene fallo si se agregan pestañas).
2. Guard al inicio: si `location.protocol === 'file:'`, mostrar mensaje accionable en vez de colgarse en "Cargando datos..." (`mostrarErrorFileProtocol()`).
3. `start.bat` — lanzador doble-clickable que sirve el dashboard en `http://localhost:8080` y abre el navegador.
**Lección:** El dashboard NUNCA debe abrirse con doble clic al HTML. Usar `start.bat` o `npx serve -l 8080`. Confirmar siempre con `curl` los headers CORS del recurso real antes de asumir que el bug está en la lógica de parsing — en este caso el parsing estaba sano.

### [2026-06-30] — app.js (descargarInforme, bootReport)
**Cambio:** Botón "⬇ Descargar Informe" — genera un `.html` autónomo con todos los meses de un consultor, descargable y abrible offline (datos), interactivo (gráficos vía Chart.js CDN). Reusa el mismo `app.js`/`styles.css`/`index.html` del dashboard real (sin código paralelo) vía `window.__REPORT__` + `bootReport()`.
**Error 1 (crítico, hallado en verificación con captura real):** El informe descargado quedaba congelado en "Cargando datos..." con código JS crudo visible en pantalla.
**Causa raíz:** `app.js` contiene el literal `'<script src="app.js"></script>'` (la propia línea de reemplazo de `descargarInforme`). Al embeber el código fuente completo de `app.js` dentro de un nuevo `<script>` inline, el parser HTML del navegador encontraba ese `</script>` literal y cerraba la etiqueta a mitad de archivo — el resto se renderizaba como texto y ningún JS corría.
**Solución:** Escapar `</script` → `<\/script` en el texto de `app.js` antes de embeberlo (`safeJsText`). El backslash rompe la secuencia que el parser HTML busca, sin alterar el valor del string en JS.
**Lección:** Nunca embeber código fuente propio dentro de un `<script>` inline sin escapar `</script`. Si el propio archivo contiene ese literal (común en código que genera HTML), el bug es garantizado, no hipotético.

**Error 2 (severo, hallado en la misma verificación):** Tras corregir el error 1, el informe seguía fallando — `ReferenceError: Chart is not defined`.
**Causa raíz:** `Chart.defaults.font.family = ...` se ejecuta a **nivel de módulo** (no dentro de una función), antes de `DOMContentLoaded`. Si Chart.js (CDN) no cargó — caso esperado en el informe offline — esa línea revienta la ejecución de **todo** `app.js`, incluyendo `bootReport()`/`initData()`. El guard `typeof Chart !== 'undefined'` agregado dentro de `updateView()` nunca se alcanzaba.
**Solución:** Envolver las líneas `Chart.defaults.*` en `if (typeof Chart !== 'undefined') { ... }`.
**Lección:** Un guard dentro de una función no protege contra fallos en código de nivel de módulo que se ejecuta antes. Buscar TODO uso de una dependencia externa opcional (no solo dentro de funciones) antes de asumir que un guard cubre el caso "sin conexión". Este bug también podía romper el dashboard EN VIVO si el CDN de Chart.js fallaba alguna vez — no era exclusivo del informe.
**Verificación:** Se parseó el CSV real (no el mock) y se generó el informe con datos reales de un consultor (ANA MARIA CHIAPPE, 27 filas) usando jsdom (motor de DOM real, ejecuta el JS embebido) para confirmar render correcto, 0 errores JS, y consistencia con el dashboard (17 entidades activas en MAYO — coincide con captura de pantalla del usuario). Probar "se ve bien" en una captura no fue suficiente; los dos bugs reales solo aparecieron al ejecutar el HTML generado de verdad.

---

## 📌 Reglas aprendidas (resumen acumulado)

> Esta seción se actualiza con cada lección nueva. Es la referencia rápida para no repetir errores.

| # | Regla | Archivo(s) |
|---|---|---|
| 1 | Los porcentajes están en escala 0–100, NO 0–1. `safePercent()` hace el clamp. | `app.js` |
| 2 | El valor `1` en `% PROGRAMA DE CAPACITACION` es un placeholder intencional, NO un error. Mostrar badge "SIN DATOS" si `% ≤ 1`. | `app.js` |
| 3 | Columnas con prefijo `PROGRESO` o `FINAL DE` → blacklist total. Nunca parsear. | `app.js` |
| 4 | `OBSERVACIONES - FECHA DE CORTE` sin sufijo = MAYO. Con sufijo `.1`–`.7` = meses siguientes. **⚠️ Ahora se detecta dinámicamente.** | `app.js` |
| 5 | `DEIBY` en CSV → normalizar siempre a `DEIBY MORENO`. | `app.js` |
| 6 | `BIMENSUAL` en CSV → normalizar a `BIMESTRAL`. `SEMESTRAL` NO existe en el CSV real. | `app.js` |
| 7 | El displayLabel del mes es el que va a la UI, NUNCA el `key` directamente. Ej: MAYO → "Abril (ejecución)". | `app.js` |
| 8 | Solo MAYO tiene datos en el estado actual (Mayo 2026). JUNIO–DICIEMBRE vacíos. **⚠️ En Junio 2026 ya hay datos para JUNIO también.** | `app.js` |
| 9 | El semáforo corporativo usa el **peor** de los dos porcentajes (Plan vs Cap). Nunca promediar para categorizar. | `app.js` — `getEntityRisk()` |
| 10 | `m.risk` se calcula una sola vez en `processParsedData()`. Los renderizadores solo leen, nunca recalculan. | `app.js` |
| 11 | El dashboard se sirve exclusivamente vía `http://localhost:8080` — uso 100% interno CGE. | infraestructura |
| 12 | El nombre de la columna ENTIDAD puede estar vacío en el CSV. Usar `meta.fields[0]` de PapaParse. | `app.js` |
| 13 | Los obsKey de OBSERVACIONES cambian según el cliente renombre columnas. Detectar por posición con `buildObsKeyMap()`. | `app.js` |
| 14 | El dashboard NUNCA se abre con doble clic al HTML (`file://`). Google no manda CORS a `Origin: null`. Usar `start.bat` o `npx serve`. | infraestructura |
| 15 | Nunca embeber código fuente propio dentro de un `<script>` inline sin escapar `</script` — si el archivo contiene ese literal (ej. el propio código que genera HTML), el parser corta el bloque a mitad. | `app.js` — `descargarInforme()` |
| 16 | Dependencias externas opcionales (Chart.js CDN) deben guardarse con `typeof X !== 'undefined'` en TODO punto donde se usan, incluido código a nivel de módulo — un guard solo dentro de una función no protege si la dependencia falla antes, al cargar el script. | `app.js` |

---

## 🐛 Bugs conocidos / pendientes de resolver

| ID | Descripción | Prioridad | Estado |
|---|---|---|---|
| B-01 | Si Google Sheets cambia el nombre de una columna de encabezado, el parsing falla silenciosamente. | ALTA | **Resuelto — `buildObsKeyMap()` es resistente a renombramientos** |
| B-02 | El filtro "Estado Reporte" no afecta el gráfico YTD en Vista Anual. Comportamiento esperado o bug? | BAJA | Pendiente decisión |
| B-03 | Dashboard no recibía datos al abrir `index.html` con doble clic (`file://` sin CORS). | ALTA | **Resuelto — guard `file://` + `start.bat`** |
| B-04 | Informe descargado por consultor quedaba en blanco/congelado: `</script>` literal en `app.js` cerraba el script embebido a mitad de archivo. | ALTA | **Resuelto — `safeJsText` escapa `</script` antes de embeber** |
| B-05 | `Chart.defaults.*` a nivel de módulo reventaba todo `app.js` si Chart.js (CDN) no cargaba, anulando el guard de `updateView()`. | ALTA | **Resuelto — guard `typeof Chart !== 'undefined'` también a nivel de módulo** |

---

## 💡 Ideas y mejoras futuras

- Exportar tabla maestra a CSV desde el dashboard.
- Añadir contador de empresas en Rojo/Amarillo/Verde como KPI extra.
- Modo oscuro (dark mode toggle).
- Validación de columnas en carga: alertar si faltan columnas esperadas del CSV.
- Tooltip en gráfico Workload con lista de empresas (como se hizo en Salud del Portafolio).
- Informe por consultor: agregar opción "todos los consultores" (ZIP o varios HTML) si se vuelve recurrente.

---

*Actualizar este archivo después de cada sesión de desarrollo o pruebas.*
*Uso exclusivo interno — CGE 2026.*
