# AI CONTEXT INJECTION: Proyecto Escalafón

Eres el desarrollador principal de una PWA de estudio técnico y preparación para el escalafón técnico aeronáutico.
Lee este contexto antes de escribir una sola línea de código.

## 1. Stack Tecnológico (Estricto)

- **Frontend:** HTML5 Single File + Alpine.js v3 (Global Store Pattern) + Tailwind CSS v3 (CDN).
- **Backend:** Supabase (PostgreSQL). Toda la lógica compleja reside en Stored Procedures (RPCs).
- **Filosofía:** "No Build Tools". Editamos directamente `index.html` y `app.js`. Mobile-First.

## 2. Arquitectura de Datos (Supabase)

- **Tablas:**
  - `bancos` (id, slug, nombre): B787, Inglés, AMOS, Regulaciones.
  - `atas` (id, banco_id, nombre): Categorías por banco.
  - `preguntas` (id, banco_id, ata_id, texto, opciones, correcta, image_url).
  - `respuestas` (id, user_id, pregunta_id, es_correcta, modo_estudio).
- **Lógica de Negocio (RPCs):**
  - `obtener_general`: Filtra maestría (2 aciertos consecutivos) y cuarentena.
  - `obtener_repaso`: Lógica de repaso de fallados (Spaced Repetition).
  - `guardar_intento`: Registra el intento y actualiza estadísticas.
  - `reiniciar_progreso`: Reinicia el historial de progreso de estudio general del usuario en un banco.

## 3. Estado de la Aplicación (Alpine Store)

- **Navegación:** `vistaActual` ('login' -> 'inicio' -> 'dashboard' -> 'quiz' -> 'fin' / 'cargando').
- **Contexto:** `bancoSeleccionado` (UUID), `modoEstudio` ('general' | 'repaso').
- **Quiz Engine:** Carga por lotes (Batch Loading de 25 preguntas). Navegación cliente (`indiceActual`, `siguientePregunta()`).
- **Sesión local:** Guardada en localStorage bajo la clave `escalafon_sesion` para poder reanudar de inmediato si se suspende la pestaña.

## 4. Reglas de Desarrollo

- **Idiomas:** Código y comentarios en ESPAÑOL.
- **Estilos:** Tailwind clases utilitarias. UI desacoplada de la lógica JS.
- **Seguridad:** Row Level Security (RLS) activo. Validación visual en cliente, lógica en servidor.

## 5. Estado Actual

**Versión:** v1.6 — Estable  
**Última auditoría:** 2026-06-01  
Todos los módulos funcionales. Prioridad actual: estabilidad y contenido (ver `PROJECT_AUDIT_REPORT.md`).
