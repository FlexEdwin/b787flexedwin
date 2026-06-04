# PROJECT_BRIEF.md: Proyecto Escalafón

## 1. Visión del Producto

Desarrollar una plataforma web progresiva (PWA) de alto rendimiento para el entrenamiento, estudio y autoevaluación técnica de personal de mantenimiento aeronáutico.
El objetivo no es la certificación oficial ante un ente regulador, sino la **maestría técnica personal** y la preparación para **ascensos internos** (escalafón). La herramienta actúa como un "Gimnasio Mental" para interiorizar conocimientos complejos.

## 2. El Problema (The Pain)

El proceso de ascenso y mejora profesional requiere dominar grandes volúmenes de información técnica dispersa en manuales o bases de datos estáticas.

- No existe una herramienta unificada que permita practicar activamente (Active Recall) sobre los tres pilares críticos del puesto: **La Aeronave (B787)**, el **Idioma (Inglés Técnico)** y el **Software de Gestión (AMOS)**.
- Estudiar de listas estáticas o Excel es ineficiente y no simula la presión de la toma de decisiones.

## 3. Alcance del Proyecto (MVP)

Para considerar el proyecto "Terminado v1.0", la aplicación debe cumplir estrictamente con:

### A. Soporte Multi-Banco (Crítico) ✅ **COMPLETADO**

El sistema debe dejar de ser "B787-céntrico" en su arquitectura y soportar múltiples bancos de preguntas independientes:

1.  **B787**: Sistemas, ATAs, Procedimientos.
2.  **Inglés Técnico**: Terminología aeronáutica.
3.  **AMOS**: Uso del software de gestión de mantenimiento.
4.  **Regulaciones Aeronáuticas**: Normativas RAC 145, SMS, Factores Humanos y EWIS.

> **Estado:** ✅ Implementado. Bancos se cargan dinámicamente desde tabla `bancos` en Supabase. RPCs filtran preguntas por `p_banco_id`. UI proporciona feedback visual de selección.

### B. Refactorización y Profesionalización ✅ **COMPLETADO**

- **Limpieza de Código**: ✅ Eliminados comentarios `TODO`, estandarizada nomenclatura.
- **Desacople UI/Lógica**: ✅ Clases de estilos movidas a directivas `:class` en HTML. Eliminadas funciones `claseBoton()` y `estiloLetra()`.
- **Corrección de Textos**: ⏳ Pendiente de revisión final.

### C. Gestión de Contenidos & UX ✅ **COMPLETADO (v1.0)**

- **Ingesta**: CSV/Importación directa a Supabase.
- **Batch Loading**: ✅ Implementada carga por lotes (configurable por el usuario: 25, 50, 100 preguntas) reduciendo latencia.
- **Offline-Ready**: ✅ Service Worker y LocalStorage configurados para tolerancia a fallos de red.

### D. Estabilización y Mejoras de Experiencia (v1.6) ✅ **COMPLETADO**

- **Reinicio de Progreso**: El usuario puede limpiar su progreso del banco actual llamando a `reiniciar_progreso(p_banco_id, p_ata_id)` vía RPC. El RPC borra: (a) los registros de la tabla `respuestas` para ese banco (que es lo que `obtener_general` consulta para determinar maestría), y (b) los registros de la tabla `exclusion` para ese banco, devolviendo las preguntas excluidas ("Ya me la sé") al pool general. Adicionalmente resetea `progreso.respondida_bien_seguido`. Los registros de `favorita` **no** se borran. Esto devuelve todas las preguntas (incluidas las excluidas) al pool general de estudio, manteniendo el set de favoritas intacto.
- **Fix "Imagen Fantasma" (Ghost Image)**: ✅ Oculta inmediatamente la imagen de la pregunta anterior durante las transiciones de carga, mostrando un skeleton loader en conexiones lentas.
- **Indicador de Preguntas Pendientes**: ✅ Se reemplazó el sistema de "racha" en la pantalla de resultados por una métrica real: "X preguntas por aprender de Y", calculado restando las preguntas devueltas en modo general y repaso del total del banco.
- **Ayuda Integrada (FAQ)**: ✅ Modal flotante interactivo con respuestas rápidas sobre cómo funciona la doble validación, sincronización de progreso, y reinicio.
- **Rediseño de Login & Header**: ✅ Mayor relevancia al acceso de "Invitado" y personalización del header mostrando el email o "Invitado" según corresponda.
- **Footer Interactivo**: ✅ Enlaces funcionales hacia el sitio principal `flexedwin.com` y correo de soporte `hello@flexedwin.com`.

### E. Hardening y Limpieza de Código (v1.6.1) ✅ **COMPLETADO**

- **Eliminación de `console.log` en producción**: ✅ Removidos 10+ logs de debug que exponían parámetros de RPC y estado interno. Solo se conservan `console.error` para errores reales.
- **Corrección de comentarios batch**: ✅ Documentación interna ahora refleja correctamente el lote variable (antes decía siempre 50 o 25).
- **Bug `showToast` duplicado**: ✅ Eliminada la llamada duplicada que mostraba el toast dos veces al usuario.
- **Reindentación de `cargarAtas()`**: ✅ Método reintegrado correctamente al objeto `app()`.
- **Rebranding completo**: ✅ `package.json`, `sw.js` (cache), `manifest.json` actualizados a "Proyecto Escalafón" v1.6.0.
- **Fix hardcode multi-banco**: ✅ Eliminado `bancoSeleccionado = 'b787'` hardcodeado en vista Coming Soon.
- **Manifest PWA reforzado**: ✅ Añadidos `scope`, `lang`, `description` y `orientation`.
- **Sincronización de dependencias**: ✅ `download:js` en `package.json` ahora descarga `alpinejs@3.14.1` igual que el CDN en `index.html`.

### F. Control de Estudio Personalizado (v1.8) ✅ **COMPLETADO**

- **Selector de Cantidad de Preguntas**: ✅ Selector en dashboard para elegir lotes de 25, 50 o 100 preguntas.
- **Repaso Ilimitado**: ✅ El modo "Repaso Fallos" ahora trae TODAS las preguntas falladas pendientes (`cantidad: 9999`) sin restricciones.
- **Persistencia Inmediata**: ✅ Validado que el avance (aciertos/errores) se guarda de manera atómica al instante, previniendo pérdida de historial si se suspende la prueba.
- **Corrección de UI de Lote**: ✅ Solucionado el bug visual donde se mostraba "Pregunta 26 de 25" moviendo la validación y añadiendo protecciones al getter visual.

### G. Funcionalidades de Repetición y Gestión Personalizada (v1.9) ✅ **COMPLETADO**

- **Selector de Cantidad Ampliado**: ✅ Se extendieron las opciones de cantidad por sesión a: 200, 300, 400, 500, 600, 700 y 800 preguntas.
- **Umbral de Maestría Configurable**: ✅ El alumno puede seleccionar que se repita la pregunta 1 vez, 2 veces (recomendado) o 3 veces para considerarla aprendida.
- **Maestría Instantánea ("Ya me la sé")**: ✅ Se añadió el botón para excluir permanentemente preguntas del pool de estudio con cartel de confirmación para evitar exclusiones accidentales.
- **Preguntas Favoritas**: ✅ Se implementó un sistema de marcación de favoritas (estrella) con estudio completo e ilimitado (se cargan todas las favoritas de corrido) y opción de desmarcar en caliente.
- **Persistencia en Reinicio**: ✅ Reiniciar el progreso conserva intactas las preguntas favoritas. Las exclusiones de "Ya me la sé" **sí se borran** en el reinicio, permitiendo que esas preguntas vuelvan a aparecer en el pool de estudio general.

---

## 4. Reglas de Negocio (v2.0 Refactor)

### 4.1. Mecánica de Estudio

1.  **Selección de Contexto**: Banco -> Dashboard -> Quiz.
2.  **Anti-Memoria**: Barajado estricto pero conservando identidad de opción (`{letra: 'B'}`).
3.  **Persistencia**: Cada click se intenta guardar en la nube.

### 4.2 Lógica de Aprendizaje

- **Algoritmo**: Doble Validación (General vs Repaso).
- **Criterio de Graduación (General)**: Graduación/retiro definitivo tras 2 aciertos consecutivos en modo `general`.
- **Criterio de Liberación (Repaso)**: Una pregunta fallada entra en cuarentena (Repaso) y se libera (vuelve a General) tras responderse correctamente 1 sola vez en modo `repaso`.

---

## 5. Arquitectura Técnica

### Stack Tecnológico (Optimizado)

- **Frontend**: HTML5 + Tailwind CSS + Alpine.js (3-Tier nav architecture).
- **Backend**: Supabase (PostgreSQL + Auth + RPCs con `user_id` context).

### Modelo de Datos (Conceptual)

Se requiere una migración para añadir la columna `banco_id` o `categoria` a las tablas principales:

- `bancos`: { id, nombre (B787, Inglés, AMOS), descripcion }
- `preguntas`: { ..., banco_id, ... }
- `atas/categorias`: { ..., banco_id, ... }

---

## 6. Definición de Éxito ✅ **LOGRADO**

1.  ✅ Usuario se loguea (o entra como invitado) y ve bancos disponibles.
2.  ✅ Navegación fluida (Dashboard -> Quiz) sin tiempos de carga por pregunta.
3.  ✅ Validación correcta en B787, Inglés, AMOS y Regulaciones Aeronáuticas.
4.  ✅ Persistencia de datos y estadísticas fiables.
