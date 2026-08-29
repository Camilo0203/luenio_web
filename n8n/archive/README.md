# Workflows retirados de la instancia

Estos workflows existieron en la instancia de n8n y se retiraron el 2026-08-29
por ser andamiaje: sondas (`Probe`), autopruebas, limpiezas e inicializadores.
Ninguno estaba activo.

Dos de ellos no son basura y conviene saber que están aquí:

- `luenio-insights-inicializar-hoja.json`
- `luenio-insights-inicializar-encabezados.json`

Son los que **reconstruyen la estructura del Google Sheets**. Si algún día hay
que rehacer la hoja, se restauran desde aquí.

## Restaurar uno

```bash
curl -X POST "$N8N_URL/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @n8n/archive/<archivo>.json
```

Queda inactivo y sin credenciales asignadas: hay que volver a elegirlas en la
interfaz de n8n antes de usarlo.
