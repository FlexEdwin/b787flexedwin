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
- **Batch Loading**: ✅ Carga por lotes configurable para modo General (25–800 preguntas). Modo Por Capítulo carga siempre la totalidad de preguntas del capítulo (`cantidad: 9999`). Repaso e Ilimitado y Favoritas también sin límite.
- **Offline-Ready**: ✅ Service Worker y LocalStorage configurados para tolerancia a fallos de red.

### D. Estabilización y Mejoras de Experiencia (v1.6) ✅ **COMPLETADO**

- **Reinicio de Progreso**: El usuario puede limpiar su progreso del banco actual llamando a `reiniciar_progreso(p_banco_id, p_ata_id)` vía RPC. El RPC borra de forma selectiva (a partir de la versión v1.9.3) los registros de la tabla `respuestas` (maestría) y/o los registros de la tabla `exclusion` (excluidas "Ya me la sé"), devolviendo dichas preguntas al pool general de estudio. Los registros de `favorita` **no** se borran bajo ninguna circunstancia.
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
- **Umbral de Maestría Configurable**: ✅ El alumno puede seleccionar que se repita la pregunta 1 vez (predeterminado / recomendado), 2 veces (estándar) o 3 veces para considerarla aprendida.
- **Maestría Instantánea ("Ya me la sé")**: ✅ Se añadió el botón para excluir permanentemente preguntas del pool de estudio con cartel de confirmación para evitar exclusiones accidentales.
- **Preguntas Favoritas**: ✅ Se implementó un sistema de marcación de favoritas (estrella) con estudio completo e ilimitado (se cargan todas las favoritas de corrido) y opción de desmarcar en caliente.
- **Persistencia en Reinicio**: ✅ Reiniciar el progreso conserva intactas las preguntas favoritas. Las exclusiones de "Ya me la sé" y el historial de maestría se borran de acuerdo a la selección del usuario, permitiendo que vuelvan a aparecer en el pool.

### H. Botón de Visualización Sin Penalización (v1.9.2) ✅ **COMPLETADO**

- **Ver Respuesta en Caliente**: ✅ Botón en forma de ojo (`👁 Ver Respuesta`) que permite al alumno ver cuál es la opción correcta sin verse obligado a responderla y sin penalizar sus estadísticas de estudio (no se suma a repaso de fallos, ni se marca como correcta/incorrecta).
- **Flujo de Continuación**: ✅ El botón inferior del Quiz cambia a un botón morado "Continuar" que le permite saltar de manera limpia a la siguiente pregunta del lote sin alterar el progreso acumulado en la sesión.

### I. Reinicio de Progreso Configurable (v1.9.3) ✅ **COMPLETADO**

- **Selector de Componentes a Reiniciar**: ✅ Al presionar "Reiniciar Progreso", se despliega un modal nativo interactivo con checkboxes que le permite al alumno decidir si desea borrar la Maestría General (historial de respuestas) y/o las Exclusiones ("Ya me la sé").
- **Higiene de Datos**: ✅ Las favoritas se conservan siempre intactas, logrando un control total sobre el reset del banco.

### J. Recarga de Estadísticas Reactivas (v1.9.4) ✅ **COMPLETADO**

- **Auto-Refresh asíncrono**: ✅ Al salir o cancelar una sesión de Quiz a mitad de lote, o al pausar el test, la aplicación ahora recarga automáticamente en segundo plano las estadísticas del banco seleccionado, garantizando que el Dashboard refleje el avance real sin forzar un F5.

### K. UX, Contexto de Sesión y Rendimiento de Resultados (v2.0.0) ✅ **COMPLETADO**

- **Modo Por Capítulo Completo**: ✅ Se eliminó el selector de cantidad de preguntas del modo "Por Capítulo/Tema/Categoría". Al seleccionar un capítulo, el sistema carga automáticamente TODAS las preguntas no dominadas del mismo (llamada `obtener_general` con `cantidad: 9999` y `p_ata_id` filtrado). Cada capítulo tiene un número diferente de preguntas y no tiene sentido truncarlo artificialmente.
- **Contexto de Sesión en Resultados**: ✅ El modal de fin de lote ahora muestra claramente el banco y el modo de estudio practicado ("B787 / Capítulo: ATA 29 - Hidráulica", "AMOS / Entrenamiento General", etc.), usando los getters reactivos existentes (`listaBancos`, `atas`, `labelCategoria`).
- **Resultados Instantáneos (Fast Path)**: ✅ `finalizarSesion()` navega a la pantalla de resultados de forma **inmediata** sin esperar la recarga de estadísticas del banco. Los datos del resumen (aciertos, fallos, %) ya están en RAM. Las estadísticas del banco se actualizan en segundo plano y se reflejan reactivamente en el modal sin que el usuario perciba ningún retraso.

---

## 4. Reglas de Negocio (v2.0 Refactor)

### 4.1. Mecánica de Estudio

1.  **Selección de Contexto**: Banco -> Dashboard -> Quiz.
2.  **Anti-Memoria**: Barajado estricto pero conservando identidad de opción (`{letra: 'B'}`).
3.  **Persistencia**: Cada click se intenta guardar en la nube.

### 4.2 Lógica de Aprendizaje

- **Algoritmo**: Doble Validación (General vs Repaso).
- **Criterio de Graduación (General)**: Graduación/retiro definitivo tras cumplir el umbral de maestría seleccionado (1 por defecto, o hasta 3 aciertos consecutivos) en modo `general`.
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

---

## 7. Roadmap y Backlog (Futuras Implementaciones)

### Funcionalidad Propuesta: "Puntos Débiles" (Modo Pesadilla)
**Descripción:** Permitir a los usuarios estudiar exclusivamente aquellas preguntas que han fallado un número determinado de veces (ej. 3, 4 o 5+ veces) para concentrarse en su "talón de Aquiles".

**Diseño de UX Sugerido:**
- En lugar de múltiples botones, crear una tarjeta única en el Dashboard llamada **"🔥 Puntos Débiles"**.
- Dentro de la tarjeta, un selector desplegable: *"Estudiar preguntas falladas al menos: [ 2 | 3 | 5 ] veces"*.
- Al iniciar, se cargaría ese lote de preguntas específicas.

**Requisito Técnico Estricto (Rendimiento de Base de Datos):**
- ❌ **Evitar:** Hacer un `COUNT` dinámico en tiempo real sobre la tabla `respuestas` donde `es_correcta = false` agrupando por pregunta. A medida que el volumen de respuestas crezca, esto saturaría el CPU y RAM de Supabase innecesariamente.
- ✅ **Implementación Óptima:** Agregar una columna `total_fallos_historicos` (INT, default 0) a la tabla `progreso`. 
- Cada vez que el usuario falle una pregunta (durante el guardado del intento en la RPC `guardar_intento`), incrementar este contador (`total_fallos_historicos = total_fallos_historicos + 1`).
- La nueva RPC `obtener_puntos_debiles(p_limite_fallos)` simplemente haría un `SELECT` con `WHERE total_fallos_historicos >= p_limite_fallos`. Esta consulta indexada es instantánea y garantiza que la aplicación mantenga su escalabilidad sin comprometer el servidor.

### Optimización Ultra-Ligera del Motor de Maestría (Escalabilidad a +10k usuarios)
**Descripción:** Refactorizar la lógica central de la RPC `obtener_general` para eliminar el cálculo de maestría "al vuelo" que actualmente lee y ordena registros de la tabla `respuestas`. 

**Motivación:** 
Actualmente, el sistema determina si una pregunta está "aprendida" ejecutando una subconsulta que verifica los últimos 2 o 3 intentos del usuario en la tabla de `respuestas`. Para el MVP y miles de usuarios, PostgreSQL maneja esto sin problema. Sin embargo, a medida que la tabla crezca a millones de respuestas, esta evaluación dinámica en cada petición consumirá ciclos de CPU innecesarios.

**Implementación Técnica Sugerida (Supabase SQL):**
1. Aprovechar la tabla `progreso` existente y su columna `respondida_bien_seguido`.
2. Asegurar que la RPC `guardar_intento` mantenga sincronizado este número de forma atómica.
3. Modificar `obtener_general` para que el filtro de maestría simplemente evalúe: 
   `WHERE p.id NOT IN (SELECT pregunta_id FROM progreso WHERE respondida_bien_seguido >= p_umbral_maestria AND user_id = v_user_id)`
4. **Impacto:** Convierte una subconsulta de agregación y ordenamiento pesado en una simple lectura de índice. Esto garantizará tiempos de respuesta de milisegundos sin importar el tamaño del historial del usuario.
