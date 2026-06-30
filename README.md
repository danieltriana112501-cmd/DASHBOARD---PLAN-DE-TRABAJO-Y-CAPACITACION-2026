# DASHBOARD---PLAN-DE-TRABAJO-Y-CAPACITACION-2026

Dashboard estático (HTML/CSS/JS, sin build) de seguimiento de % Plan de Trabajo y Capacitación de CGE. Datos en vivo desde Google Sheets vía CSV.

## Uso

**Nunca abrir `index.html` con doble clic** (Google bloquea CORS para `file://`). Ejecutar:

```
start.bat
```

Sirve el dashboard en `http://localhost:8080` y abre el navegador automáticamente. Alternativa manual: `npx serve -l 8080`.

## Informe por consultor

Seleccionar un consultor en el filtro y clic en **⬇ Descargar Informe**: genera un `.html` autónomo con los datos de ese consultor (todos los meses), abrible con doble clic. Requiere internet solo para los gráficos (Chart.js vía CDN); los datos y la tabla funcionan offline.

Detalle de errores y decisiones de diseño: ver [DEVLOG.md](DEVLOG.md).
