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

## 📌 Reglas aprendidas (resumen acumulado)

> Esta sección se actualiza con cada lección nueva. Es la referencia rápida para no repetir errores.

| # | Regla | Archivo(s) |
|---|---|---|
| 1 | Los porcentajes están en escala 0–100, NO 0–1. `safePercent()` hace el clamp. | `app.js` |
| 2 | El valor `1` en `% PROGRAMA DE CAPACITACION` es un placeholder intencional, NO un error. Mostrar badge "SIN DATOS" si `% ≤ 1`. | `app.js` |
| 3 | Columnas con prefijo `PROGRESO` o `FINAL DE` → blacklist total. Nunca parsear. | `app.js` |
| 4 | `OBSERVACIONES - FECHA DE CORTE` sin sufijo = MAYO. Con sufijo `.1`–`.7` = meses siguientes. | `app.js` |
| 5 | `DEIBY` en CSV → normalizar siempre a `DEIBY MORENO`. | `app.js` |
| 6 | `BIMENSUAL` en CSV → normalizar a `BIMESTRAL`. `SEMESTRAL` NO existe en el CSV real. | `app.js` |
| 7 | El displayLabel del mes es el que va a la UI, NUNCA el `key` directamente. Ej: MAYO → "Abril (ejecución)". | `app.js` |
| 8 | Solo MAYO tiene datos en el estado actual (Mayo 2026). JUNIO–DICIEMBRE vacíos. | `app.js` |
| 9 | El semáforo corporativo usa el **peor** de los dos porcentajes (Plan vs Cap). Nunca promediar para categorizar. | `app.js` — `getEntityRisk()` |
| 10 | `m.risk` se calcula una sola vez en `processParsedData()`. Los renderizadores solo leen, nunca recalculan. | `app.js` |
| 11 | El dashboard se sirve exclusivamente vía `http://localhost:8080` — uso 100% interno CGE. | infraestructura |

---

## 🐛 Bugs conocidos / pendientes de resolver

| ID | Descripción | Prioridad | Estado |
|---|---|---|---|
| B-01 | Si Google Sheets cambia el nombre de una columna de encabezado, el parsing falla silenciosamente (retorna `null` para ese mes). | ALTA | Pendiente — agregar validación de columnas en `processParsedData()` |
| B-02 | El filtro "Estado Reporte" no afecta el gráfico YTD en Vista Anual (solo afecta Vista Mensual). Comportamiento esperado o bug? | BAJA | Pendiente decisión |

---

## 💡 Ideas y mejoras futuras

- Exportar tabla maestra a CSV desde el dashboard.
- Añadir contador de empresas en Rojo/Amarillo/Verde como KPI extra.
- Modo oscuro (dark mode toggle).
- Validación de columnas en carga: alertar si faltan columnas esperadas del CSV.
- Tooltip en gráfico Workload con lista de empresas (como se hizo en Salud del Portafolio).

---

*Actualizar este archivo después de cada sesión de desarrollo o pruebas.*
*Uso exclusivo interno — CGE 2026.*
