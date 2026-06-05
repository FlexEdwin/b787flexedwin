# AI PROJECT LOG

## Estado Actual

- **Versión:** v1.9.4 (Hotfix)
- **Progreso:** ~100% completado.
- **Funcionalidad:** Login completo, Multi-Banco, Selector de cantidad de preguntas ampliado (25-800), Umbral de maestría configurable (1, 2 o 3 aciertos consecutivos), Exclusión de preguntas ("Ya me la sé") con confirmación, Marcación de Favoritas (estrella) con modo de estudio dedicado e ilimitado y persistencia tras reinicio. Al reiniciar progreso las exclusiones y el progreso general se pueden limpiar de forma selectiva (preguntas vuelven al pool) pero las favoritas se conservan intactas. Botón "Ver Respuesta" para consultar la respuesta correcta en caliente sin responder y avanzar sin penalización ni alterar estadísticas. Recarga automática y en segundo plano de las estadísticas al regresar al Dashboard tras cancelar o finalizar un quiz (solucionando el bug de estadísticas desactualizadas sin F5).
- **Deuda Técnica:** ⚠️ Preguntas duplicadas detectadas en tabla `preguntas` (10 textos repetidos, probablemente en banco Inglés). Requiere limpieza en BD.

---

### [2026-06-05] - Hotfix: Recarga de Estadísticas al Salir del Quiz (v1.9.4) ⚡

**REQUERIMIENTOS:**
1. Solucionar el bug por el cual las estadísticas del Dashboard ("preguntas pendientes de total") no se actualizaban al regresar de una sesión de Quiz a menos que se recargara manualmente con F5.

**CAMBIOS DE CÓDIGO & ARCHIVOS:**
- **src/js/app.js**:
  - Modificadas las funciones `volverAlDashboard()` y `volverAlMenu()` para invocar de forma asíncrona a `cargarStatsBanco(this.bancoSeleccionado)` en segundo plano cuando el usuario regresa al Dashboard. Esto asegura que los recuentos reactivos se refresquen inmediatamente sin bloquear la navegación del usuario.
- **sw.js**:
  - Se incrementó el identificador del caché a `escalafon-v8` para invalidar el almacenamiento en caché del navegador y propagar el cambio.

---

### [2026-06-05] - Feature: Reinicio de Progreso Configurable (v1.9.3) 🔄

**REQUERIMIENTOS:**
1. Permitir al usuario elegir selectivamente si desea reiniciar el progreso/maestría general (tabla `respuestas` y conteos de `progreso`) y/o reiniciar las exclusiones ("Ya me la sé" / tabla `exclusion`) al presionar "Reiniciar Progreso" en el Dashboard.
2. Reemplazar la confirmación estándar de navegador `confirm()` por un modal nativo interactivo con checkboxes.

**CAMBIOS DE CÓDIGO & ARCHIVOS:**
- **Base de Datos (Supabase SQL)** *(acción manual requerida)*:
  - Recreada la función RPC `reiniciar_progreso` para aceptar dos nuevos parámetros booleanos opcionales: `p_reiniciar_maestria` (por defecto TRUE) y `p_reiniciar_exclusiones` (por defecto TRUE) y realizar el borrado correspondiente de forma condicional.
- **src/js/app.js**:
  - Se añadieron las variables de estado `mostrarResetModal` (false), `resetOpMaestria` (true) y `resetOpExclusiones` (true).
  - Se modificó la llamada a `sb.rpc('reiniciar_progreso')` en `reiniciarProgreso()` para suministrar ambos parámetros booleanos elegidos en la UI.
- **index.html**:
  - Se modificó la acción `@click` del botón "Reiniciar Progreso" para levantar el modal (`mostrarResetModal = true`) con los valores por defecto.
  - Se añadió la estructura del modal interactivo con checkboxes vinculados con `x-model` a `resetOpMaestria` y `resetOpExclusiones`.
- **sw.js**:
  - Se incrementó el identificador del caché a `escalafon-v7` para forzar la actualización del caché en el navegador de los alumnos.

---

### [2026-06-05] - Feature: Botón "Ver Respuesta" sin penalización (v1.9.2) 👁️

**REQUERIMIENTOS:**
1. Agregar un botón de "Ver Respuesta" que permita al usuario ver la respuesta correcta de forma inmediata sin registrar un intento en Supabase (sin marcar como correcta/incorrecta o sumarse a repaso de fallos).
2. Permitir que el usuario avance de inmediato al hacer clic en un botón "Continuar" que sustituye a "Siguiente".

**CAMBIOS DE CÓDIGO & ARCHIVOS:**
- **src/js/app.js**:
  - Se añadió la variable de estado `modoVerRespuesta` iniciada en `false`.
  - Se implementó la función `verRespuesta()` para bloquear los botones del quiz y activar el resaltado de la opción correcta, estableciendo `modoVerRespuesta = true`.
  - Se resetea `modoVerRespuesta = false` al avanzar de pregunta en `siguientePregunta()` y al limpiar estadísticas en `resetStats()`.
- **index.html**:
  - Se agregó el botón `👁 Ver Respuesta` (icono de ojo morado) en el encabezado de la tarjeta de preguntas, visible solo si el usuario no ha contestado y no ha activado la vista previa de respuesta.
  - Se actualizó el botón inferior "Siguiente" para mostrar "Continuar" y cambiar a color morado cuando `modoVerRespuesta` está activo, permitiendo un flujo de avance limpio sin alterar estadísticas.
- **sw.js**:
  - Se incrementó el identificador del caché a `escalafon-v6` para invalidar el almacenamiento en caché del navegador y forzar la recarga del archivo `app.js` modificado.

---

### [2026-06-04] - Hotfix: Favoritas y Reinicio de Exclusiones (v1.9.1) 🔧

**REQUERIMIENTOS:**
1. Corregir el bug por el cual "Estudiar Favoritas" cargaba todo el banco en lugar de únicamente las preguntas favoritas.
2. Modificar `reiniciar_progreso` para que al reiniciar el progreso se borren también las exclusiones ("Ya me la sé"), devolviendo esas preguntas al pool general. Las favoritas se conservan intactas.

**DIAGNÓSTICO DEL BUG DE FAVORITAS:**
El error se encontraba en la función client-side `comenzarQuiz(modo, ataId)` de `src/js/app.js`. La variable `entrada` se calculaba con:
```javascript
const entrada = modo === 'repaso' ? 'fallos'
              : ataId            ? parseInt(ataId)
              : 'nuevas';
```
Cuando `modo === 'favoritas'`, ninguna condición lo capturaba, por lo que la evaluación retornaba `'nuevas'`. Esto causaba que `cargarPreguntas('nuevas')` invocara la RPC `obtener_general` en lugar de `obtener_favoritas`, cargando todo el banco.

**CAMBIOS DE CÓDIGO & ARCHIVOS:**
- **src/js/app.js**:
  - Añadido `modo === 'favoritas' ? 'favoritas'` como rama explícita en el ternario de `entrada` dentro de `comenzarQuiz`, antes de la evaluación de `ataId`. La cadena queda: `repaso → fallos` | `favoritas → favoritas` | `ataId → parseInt` | default → `nuevas`.
- **Base de Datos (Supabase SQL)** *(acción manual requerida)*:
  - Actualizar la función `reiniciar_progreso` para añadir un `DELETE FROM exclusion` filtrado por banco y usuario, además del `DELETE FROM respuestas` existente. Ver el SQL completo en el plan de implementación v1.9.1.

**DOCUMENTACIÓN ACTUALIZADA:**
- `PROJECT_CONTEXT.md`: Descripción del RPC `reiniciar_progreso` actualizada para reflejar el borrado de `exclusion`.
- `PROJECT_BRIEF.md`: Regla de "Persistencia en Reinicio" (sección G) corregida: exclusiones sí se borran, favoritas no.
- `PROJECT_AUDIT_REPORT.md`: Nuevos hallazgos registrados en sección 11.

---



**REQUERIMIENTOS:**
1. Ampliar el selector de cantidad de preguntas hasta 800 (25-50-100-200-300-400-500-600-700-800).
2. Hacer configurable el umbral de maestría (1, 2 o 3 aciertos consecutivos) para retirar una pregunta.
3. Añadir botón "Ya me la sé" (Maestría Instantánea) en el quiz con confirmación previa para no volver a mostrar la pregunta.
4. Crear sistema de "Preguntas Favoritas" (estrella en quiz, modo de estudio dedicado en Dashboard que carga todas las favoritas, desmarcado en caliente y persistencia al reiniciar progreso).

**CAMBIOS DE CÓDIGO & ARCHIVOS:**
- **index.html**:
  - Se añadió un panel de "Ajustes de Estudio" en el Dashboard para el umbral de maestría (vinculado con `v-model` a `umbralMaestria`).
  - Se actualizaron los selectores `<select>` de cantidad agregando las opciones hasta 800.
  - Se añadió la tarjeta "Preguntas Favoritas" en el grid del Dashboard (adaptando el grid a 4 columnas).
  - Se agregaron los botones de Favorito (estrella SVG interactiva) y "Ya me la sé" en la cabecera de la tarjeta de pregunta del Quiz.
  - Se actualizó el modal FAQ agregando aclaraciones del umbral de maestría, favoritos y exclusiones.
- **src/js/app.js**:
  - Se añadieron estados globals: `umbralMaestria` (se inicializa y persiste en `localStorage`), `totalFavoritasBanco` y `idsFavoritas` (Set).
  - Se actualizó `cargarStatsBanco()` para que pida favoritas e incluya `p_umbral_maestria` al llamar a `obtener_general`.
  - Se modificó `cargarPreguntas()` para soportar la carga del modo `favoritas` llamando a la nueva RPC `obtener_favoritas`, y para obtener en caliente el set de favoritas de la sesión.
  - Se implementaron los métodos `esFavorita()`, `toggleFavorita()` (eliminando/agregando a la tabla `favorita` y actualizando UI/localStorage) y `marcarComoExcluida()` (muestra diálogo de confirmación, inserta en `exclusion` de Supabase y avanza a la siguiente pregunta).

---

### [2026-06-02] - Mejoras del Motor de Quiz (v1.8) 🛠️

**REQUERIMIENTOS:**
1. Selector de cantidad de preguntas (25/50/100) en el Dashboard.
2. Repaso de Fallos sin límite (mostrar todas las falladas, `cantidad: 9999`).
3. Persistencia inmediata de respuestas sin necesidad de terminar el lote (confirmado como ya existente).
4. Fix "Pregunta 26 de 25" al terminar lote.

**CAMBIOS DE CÓDIGO & ARCHIVOS:**
- **index.html**:
  - Se añadieron selectores desplegables `<select>` en el Dashboard (Entrenamiento General y Por Categoría).
  - Se actualizó el texto del botón "Repaso Fallos" y la respuesta correspondiente en el modal FAQ.
- **src/js/app.js**:
  - Añadido el estado `cantidadPreguntas: 25` (vinculado con `v-model` en HTML).
  - Actualizado `cargarPreguntas(entrada)` para que en modo repaso solicite 9999 y en modo general pase `this.cantidadPreguntas`.
  - Fix en `siguientePregunta()`: La validación de fin de lote (`indiceActual + 1 >= preguntas.length`) se mueve a ANTES de incrementar el contador para evitar mostrar índices fuera de rango ("26 de 25").
  - Capa de protección adicional en getter `progresoLote` utilizando `Math.min()`.

---

### [2026-06-01] - Ajuste de Repaso de Fallos y Fix de Pantalla Vacía (v1.7) 🚀

**REQUERIMIENTOS:**
1. Modificar la regla de Repaso de Fallos: que respondiendo correctamente 1 sola vez en repaso la pregunta salga de repaso y vuelva al Entrenamiento General (antes requería 2 aciertos consecutivos en repaso y la pregunta desaparecía para siempre).
2. Eliminar el parpadeo de la pantalla "No se encontraron preguntas" durante 1 segundo al terminar la pregunta 25 de un lote.

**CAMBIOS DE CÓDIGO & ARCHIVOS:**
- **Base de Datos (Supabase SQL)**:
  - Se añadieron `DROP FUNCTION IF EXISTS` para limpiar las firmas previas de las funciones.
  - Se actualizaron las funciones `obtener_general` y `obtener_repaso` para que las preguntas en repaso salgan de cuarentena tras recibir 1 respuesta correcta en modo `repaso`, y para asegurar que la maestría (2 aciertos consecutivos) dependa únicamente del modo `general`.
- **index.html**:
  - Se actualizó el `x-show` del Empty State para ocultarse si el lote del quiz ya finalizó (`indiceActual >= preguntas.length`).
- **src/js/app.js**:
  - Se modificó la función `finalizarSesion()` para establecer temporalmente la bandera `cargando = true` mientras se cargan las estadísticas en segundo plano, previniendo visualizaciones inválidas.
- **PROJECT_CONTEXT.md** & **PROJECT_BRIEF.md**:
  - Se actualizaron las reglas de negocio sobre la Lógica de Aprendizaje (Doble Validación) indicando la regla del único acierto de liberación en repaso.

---

### [2026-05-28] - Proyecto Escalafón & Mejoras UX (v1.6) 🚀

**REQUERIMIENTO:**
1. Rebranding completo a "Proyecto Escalafón" (títulos, metadatos, PWA manifest, claves de almacenamiento local).
2. Botón interactivo para reiniciar el progreso de un banco de estudio.
3. Arreglar bug de "imagen fantasma" (ghost image) en transiciones de preguntas con fotos.
4. Quitar el contador de "racha" en la pantalla final de resultados y reemplazarlo por la métrica de preguntas restantes reales por aprender del banco seleccionado.
5. Diseñar un modal flotante de FAQ/Ayuda para guiar a los alumnos sobre el funcionamiento de la app.
6. Ajustar la pantalla de Login para dar mayor prominencia a la opción "Entrar como Invitado".
7. Agregar hipervínculos funcionales a `flexedwin.com` y `hello@flexedwin.com` en el footer.
8. Limpieza general del header (mostrar email del usuario o "Invitado", quitar badges redundantes).

**CAMBIOS DE CÓDIGO & ARCHIVOS:**
- ✅ **index.html**:
  - Actualizado el título de la página, descripción SEO, metatags de OpenGraph y PWA.
  - Implementado modal flotante de FAQ/Ayuda con botón disparador en la esquina inferior derecha.
  - Rediseñado login y header para mostrar email o 'Invitado' dinámicamente y hacer el login de invitado el CTA principal.
  - Añadido botón "Reiniciar Progreso" en Dashboard con confirmación de usuario.
  - Implementada reactividad de imagen con spinner/skeleton y `@load="imagenCargada = true"` para solucionar el bug de imagen fantasma.
  - Agregado contenedor en resultados mostrando `preguntasPendientes` y `totalPreguntasBanco`.
  - Footer actualizado con hipervínculos correctos y target blank.
- ✅ **app.js**:
  - Migradas todas las referencias de `b787_sesion` a `escalafon_sesion` en el almacenamiento local.
  - Añadidos estados `imagenCargada`, `mostrarAyuda`, `totalPreguntasBanco` y `preguntasMaestradasBanco`.
  - Añadida función `cargarStatsBanco(bancoId)` que consulta el recuento total de preguntas de la BD y resta la longitud de las consultas completas de `obtener_general` y `obtener_repaso` (9999 registros) para calcular el total de preguntas pendientes/maestradas.
  - Añadido getter `nombreUsuario`, `esInvitado` y `preguntasPendientes`.
  - Actualizado `seleccionarBanco` para cargar metadatos de atas y estadísticas en paralelo con `Promise.all`.
  - Modificado `siguientePregunta()` para apagar `imagenCargada = false` en transiciones de carga, reactivándolo si la siguiente pregunta no tiene imagen.
  - Convertida `finalizarSesion()` a asíncrona para refrescar las estadísticas del banco antes de pasar a la vista de final.
  - **Hotfix:** Corregida función `reiniciarProgreso()` para invocar `cargarStatsBanco()` junto a `cargarAtas()`, resolviendo un bug donde la UI visualmente no refrescaba el número de preguntas pendientes tras un reinicio exitoso en BD.

### [2026-05-29] - Hotfix Crítico: Reinicio de Progreso nunca funcionó 🔬

**DIAGNÓSTICO (Root Cause Analysis):**
Se descubrió que la función `reiniciar_progreso` en Supabase **nunca borró el progreso real**. El RPC solo actualizaba la columna `respondida_bien_seguido = 0` en la tabla `progreso`, pero `obtener_general` **no consulta la tabla `progreso` en absoluto**. La maestría de las preguntas se determina exclusivamente a partir de los últimos 2 registros de la tabla `respuestas`:
```sql
AND NOT EXISTS (
  SELECT 1 FROM (
    SELECT es_correcta FROM respuestas r
    WHERE r.pregunta_id = p.id AND r.user_id = v_user_id AND r.modo_estudio = 'general'
    ORDER BY r.created_at DESC LIMIT 2
  ) sub WHERE sub.es_correcta = true HAVING COUNT(*) = 2
)
```
Por lo tanto, actualizar `progreso` no tenía ningún efecto en lo que `obtener_general` devolvía.

**FIX APLICADO (Dos partes):**
- ✅ **Supabase (SQL):** Reescrito el RPC `reiniciar_progreso` para que acepte `p_banco_id` y `p_ata_id`, y ejecute un `DELETE FROM respuestas` filtrando por el banco del usuario. Adicionalmente mantiene el `UPDATE progreso` para consistencia.
- ✅ **app.js:** Actualizada la llamada al RPC para pasar `p_banco_id: this.bancoSeleccionado` de modo que el reset filtre únicamente el banco que el usuario está estudiando, sin tocar el historial de otros bancos.
- ✅ **manifest.json**:
  - Renombrada la PWA de "B787 Master Pro" a "Escalafón".
- ✅ **Documentación (.md)**:
  - Actualizados `PROJECT_CONTEXT.md`, `PROJECT_BRIEF.md`, `PROJECT_AUDIT_REPORT.md`, `SYSTEM_PROMPT.md` y `AI_PROJECT_LOG.md` para reflejar y consolidar todos los cambios.

---

### [2026-05-27] - Soporte Múltiples Respuestas Válidas ✔️✔️

**REQUERIMIENTO:**
Permitir que una misma pregunta acepte múltiples letras como correctas (ej. Pregunta 46 del banco AMOS que tiene dos opciones válidas).

**CAMBIOS DE CÓDIGO & BD:**
- ✅ **Base de Datos**: Se instruyó modificar el tipo de columna `correcta` de `CHAR(1)` a `TEXT` o `VARCHAR` (`ALTER TABLE preguntas ALTER COLUMN correcta TYPE TEXT;`) para admitir valores como `A,B`.
- ✅ **Frontend (`app.js` e `index.html`)**: Refactorizada la validación de `opcion.letra === preguntaActual.correcta` a `correcta.includes(seleccion)` permitiendo que cualquiera de las letras listadas en la BD valide como correcta y cambie a verde en la UI.
- ✅ **Documentación**: Esquema en `PROJECT_CONTEXT.md` actualizado.

---
### [2026-05-25] - Soporte de Imágenes y Banco AMOS 🖼️

**REQUERIMIENTO:**
Habilitar soporte para preguntas que requieran imágenes de referencia (ej. "según la imagen responda..."), específicamente para el banco de AMOS, utilizando Supabase Storage de manera profesional.

**CONFIGURACIÓN EN BD (Supabase):**
- ✅ **Tabla `preguntas`**: Agregada columna `image_url TEXT DEFAULT NULL` para guardar el nombre del archivo de la imagen.
- ✅ **Supabase Storage**: Creado el bucket público `preguntas-media`. Las imágenes se subieron directamente a la raíz de este bucket (ej: `amos_55.png`).
- ✅ **Políticas**: Cambiada la propiedad del bucket a `public: true` para habilitar el acceso público por URL sin tokens.
- ✅ **Funciones RPC**: Verificado que `obtener_general` y `obtener_repaso` utilicen `p.*` (lo cual hereda automáticamente la columna `image_url` en el resultado).

**CAMBIOS DE CÓDIGO (Frontend):**
- ✅ **Lógica en JS (`app.js`)**:
  Añadido el getter `urlImagenActiva` que detecta la presencia de `image_url` en la pregunta en pantalla y construye dinámicamente la URL pública de la imagen apuntando al bucket `preguntas-media` de Supabase.
- ✅ **Interfaz de Usuario (`index.html`)**:
  Se agregó una sección `<template x-if="urlImagenActiva">` con estilo Tailwind (`bg-slate-900/50`, bordes redondeados y centrado) justo debajo del texto de la pregunta para renderizar la imagen de referencia solo si es necesario.

**RESULTADO:**
Las preguntas con imágenes (ej: Pregunta 55 de AMOS) ahora muestran su gráfica o diagrama de referencia de forma adaptativa y fluida.

---

### [2026-05-25] - Nuevo Banco: Regulaciones Aeronáuticas 📋

**REQUERIMIENTO:**
Agregar un cuarto banco de estudio llamado "Regulaciones Aeronáuticas" con 178 preguntas distribuidas en 4 categorías: SMS, Políticas, Regulaciones y Proeficiencia. Las preguntas fueron importadas directamente a Supabase vía CSV.

**CONFIGURACIÓN EN BD (Solo Supabase, sin cambios de código):**
- ✅ **Tabla `bancos`**: Registro insertado con `id: 97bcbf1e-1a72-44d2-8b42-a34ec0ae769c`, `slug: 'regulaciones'`.
- ✅ **Tabla `atas`**: 4 categorías asignadas al banco:
  - ATA 29 → `sms` (20 preguntas)
  - ATA 30 → `politicas` (28 preguntas)
  - ATA 31 → `regulaciones` (106 preguntas)
  - ATA 32 → `proeficiencia` (24 preguntas)
- ✅ **Tabla `preguntas`**: 178 preguntas con `banco_id` correcto, IDs iniciando desde 1566.

**CAMBIOS DE CÓDIGO (Frontend):**

- ✅ **Getter `labelCategoria` añadido** (`app.js`):  
  Nuevo getter que retorna vocabulario dinámico según el `slug` del banco activo:  
  `'ingles'` → `'Tema'` | `'regulaciones'` → `'Categoría'` | default → `'Capítulo'`  
  El getter `esIngles` se mantuvo por retrocompatibilidad.

- ✅ **UI Dashboard actualizada** (`index.html`):  
  Los 3 textos del card de categorías ahora usan `labelCategoria`:  
  - Título: `'Por ' + labelCategoria` → "Por Categoría" en Regulaciones  
  - Placeholder select: `'Seleccionar ' + labelCategoria + '...'`  
  - Botón: `'Estudiar ' + labelCategoria`  

**RESULTADO:**
- El banco "Regulaciones Aeronáuticas" aparece automáticamente en la pantalla de selección.
- Las 4 categorías son seleccionables desde el Dashboard con el vocabulario correcto.
- Cero código duplicado: el sistema escala añadiendo datos en Supabase.

---

### [2026-05-20] - Auditoría de Sistema de Doble Validación 🔬

**REQUERIMIENTO:**
Verificar que el sistema de 25 preguntas aleatorias funciona correctamente y que las preguntas ya dominadas (respondidas correctamente 2 veces seguidas en modo general) efectivamente dejan de aparecer. Confirmar si el progreso es por usuario (credenciales) o por dispositivo.

**DIAGNÓSTICO EJECUTADO:**

- ✅ **Frontend (`app.js`) inocente:** El código simplemente llama a la RPC `obtener_general` con `cantidad: 25`. No hay lógica de filtrado en el cliente; toda la responsabilidad recae en el backend.
- ✅ **RPCs revisadas y correctas:** Se auditó el código fuente de `obtener_general`, `obtener_repaso` y `guardar_intento` directamente en Supabase. La lógica de "Doble Validación" (excluir preguntas con ≥ 2 aciertos consecutivos en modo `general`) está correctamente implementada en SQL.
- ✅ **Datos guardándose:** Se confirmó con query directo a la tabla `respuestas` que los intentos del usuario se están registrando correctamente (133 respuestas en general, 60 en repaso para el usuario principal).
- ✅ **Sin doble registro:** No se detectaron respuestas duplicadas (misma pregunta guardada dos veces en el mismo segundo).
- ✅ **305 preguntas ya dominadas:** El usuario principal (`dc5920a7...`) tiene 305 preguntas correctamente filtradas por el sistema. El algoritmo de doble validación está funcionando.
- ⚠️ **10 preguntas con texto duplicado en BD:** Se detectaron 10 preguntas con el mismo `texto` pero distintos `id` en la tabla `preguntas`. Probablemente ocurrió al cargar el banco de Inglés. Si ambas copias comparten el mismo `banco_id`, la misma pregunta puede aparecer dos veces en un lote de 25 y el dominar una copia no elimina la otra. **Requiere verificación y limpieza por el administrador de BD.**

**CONCLUSIÓN:**
El sistema de doble validación funciona correctamente a nivel de código (frontend y backend). La sensación de "preguntas que se repiten" reportada por el usuario probablemente se debe a las preguntas duplicadas en la BD, no a un bug en la lógica.

**ARQUITECTURA DE PROGRESO (Aclaración documentada):**

| Dato | Dónde vive | ¿Va con el usuario? |
|------|------------|---------------------|
| Historial de aciertos/fallos | Supabase (`respuestas`) | ✅ Sí, cualquier dispositivo |
| Lote activo de 25 preguntas (en curso) | `localStorage` del navegador | ❌ Solo ese dispositivo |
| Banco/vista seleccionada | `localStorage` del navegador | ❌ Solo ese dispositivo |

**USUARIOS ANÓNIMOS:**
El progreso de usuarios anónimos SÍ se guarda en Supabase bajo un UUID único generado por `signInAnonymously()`. Sin embargo, ese UUID solo persiste mientras la sesión Supabase esté en el navegador (localStorage). Si el usuario borra cookies o cambia de dispositivo, pierde acceso a su cuenta anónima y su progreso queda huérfano en la BD.

**ACCIÓN PENDIENTE (BD):**
```sql
-- Ejecutar para confirmar si los duplicados están en el mismo banco
SELECT p.id, p.texto, b.nombre as banco, b.slug
FROM preguntas p
JOIN bancos b ON b.id = p.banco_id
WHERE p.texto IN (
    SELECT texto FROM preguntas GROUP BY texto HAVING COUNT(*) > 1
)
ORDER BY p.texto, b.slug;
-- Si están en el mismo banco → eliminar duplicados con DELETE WHERE id = <id_duplicado>
```

---

### [2026-05-19] - Activación Banco de Inglés + Filtrado ATAs por Banco 🇬🇧

**REQUERIMIENTO:**
Activar el banco de Inglés Técnico (`banco_id: e434771e-36ed-4a07-b4d3-85c213b19b1e`, slug: `ingles`) reutilizando el motor de tests del B787. Las categorías del inglés están en la tabla `atas` (IDs 17-28). En la UI no debe decir "ATA/Capítulos" sino "Temas" cuando el usuario esté en este banco.

**IMPLEMENTACIÓN:**

- ✅ **`cargarAtas(bancoId)` refactorizada** (`app.js`):  
  Ahora acepta un `bancoId` opcional y aplica `.eq('banco_id', idFiltro)` antes de ejecutar el query.  
  Cada banco verá exclusivamente sus propias filas de `atas`, evitando mezcla entre B787/Inglés/AMOS.  
  Si no se recibe `bancoId`, usa `this.bancoSeleccionado` como fallback (compatibilidad hacia atrás).

- ✅ **`seleccionarBanco(id)` actualizada** (`app.js`):  
  Ahora pasa `id` explícitamente a `cargarAtas(id)` para evitar condiciones de carrera donde el estado reactivo `bancoSeleccionado` aún no se haya propagado al momento de ejecutar la query.

- ✅ **Getter `esIngles` añadido** (`app.js`):  
  Computed property que detecta si el banco activo tiene `slug === 'ingles'`.  
  Usado en la UI para renderizar condicionalmente los labels correctos sin duplicar lógica.

- ✅ **UI adaptativa en Dashboard** (`index.html`):  
  - Título de tarjeta: `x-text="esIngles ? 'Por Temas' : 'Por Capítulos'"`  
  - Placeholder select: `x-text="esIngles ? 'Seleccionar Tema...' : 'Seleccionar Capítulo...'"` 
  - Botón: `x-text="esIngles ? 'Estudiar Tema' : 'Estudiar Capítulo'"`  
  Todo condicionado al getter `esIngles`. Sin hardcoding de IDs o slugs en el HTML.

**RESULTADO:**
- El banco de Inglés ya está operativo: usa las mismas RPCs (`obtener_general`, `obtener_repaso`, `guardar_intento`) con su `banco_id` propio.
- La UI se adapta automáticamente al vocabulario correcto según el banco seleccionado.
- Para activar futuros bancos (AMOS, etc.) solo se necesita agregar datos en Supabase, sin cambios de código.

**PRECONDICIÓN DE BD:**
- La tabla `atas` debe tener columna `banco_id` (UUID, FK hacia `bancos.id`) para el filtrado.
- Las filas de inglés (IDs 17-28) deben tener `banco_id = 'e434771e-36ed-4a07-b4d3-85c213b19b1e'`.

---

### [2026-04-29] - Fix Bug F5: Bancos no aparecen al refrescar 🔄

**PROBLEMA REPORTADO:**
Al estar en la pantalla "Selecciona tu Banco de Estudio" y presionar F5/refrescar, no aparecía ningún banco. Había que hacer clic en el logo "Proyecto B787" para que volvieran a mostrarse.

**CAUSA RAÍZ:**
Race condition en el flujo de autenticación asíncrona de Supabase. En ciertos escenarios (red lenta, sesión que necesita refresco de token), `onAuthStateChange` puede disparar `SIGNED_IN` después de que `initApp()` ya configuró la vista. Si en ese momento `listaBancos` está vacío, no había ningún mecanismo para reintentarlo.

**SOLUCIÓN:**
- ✅ Añadido `this.$watch('vistaActual', ...)` en `initApp()`. Detecta reactivamente cuando el usuario llega a la vista `'inicio'` con `listaBancos.length === 0` y ejecuta `cargarBancos()` automáticamente.
- ✅ Simplificado `onAuthStateChange`: login genuino ahora usa `Promise.all([cargarBancos(), cargarAtas()])` en paralelo.
- ✅ Eliminados `console.log` de debug del listener de auth.

---

### [2026-04-29] - Auditoría Técnica Completa + Bug Fix Móvil 🔎🐛

**PROBLEMA REPORTADO:**

1. En móvil, al responder una opción (ej: letra "A" en posición 3), si la siguiente pregunta también tiene la letra "A" en la misma posición visual, el botón aparece con borde resaltado como si ya hubiera sido seleccionado.
2. Muchas veces no se podían terminar las 50 preguntas antes de cerrar el navegador, lo que obligaba a empezar un lote nuevo.

**BUGS CORREGIDOS:**

- ✅ **FIX CRÍTICO (Highlight residual en móvil):**
  - **Causa raíz:** En móvil, al hacer `touch` en un botón, el navegador le asigna el estado `:focus`. Como Alpine reutiliza los nodos del DOM al re-renderizar con el mismo `:key`, el nodo del botón conserva el `:focus` visual de la pregunta anterior.
  - **Solución triple aplicada:**
    1. `document.activeElement.blur()` en `responder()` al inicio de cada respuesta, limpiando el foco programáticamente.
    2. `@touchend="$el.blur()"` en el botón HTML para limpiar el foco inmediatamente al levantar el dedo.
    3. `outline-none focus:outline-none focus-visible:outline-none` + `button { -webkit-tap-highlight-color: transparent; }` en CSS para eliminar cualquier outline del navegador.

- ✅ **REDUCCIÓN DE LOTE (50 → 25 preguntas):**
  - Reducido `cantidad: 50` a `cantidad: 25` en las RPCs `obtener_general` y `obtener_repaso`.
  - Actualizado texto en dashboard de "50 preguntas aleatorias" a "25 preguntas aleatorias".
  - El estado se guarda en localStorage, permitiendo retomar la sesión si el navegador se cierra.

**DEUDA TÉCNICA ELIMINADA:**

- ✅ **`initApp()` optimizado:** Se eliminaron 3 llamadas redundantes a `cargarBancos()` y 2 a `cargarAtas()`. Ahora se usan en paralelo con `Promise.all()` una sola vez.
- ✅ **`logout()` corregido:** Se eliminó la llamada `localStorage.removeItem('b787_sesion')` duplicada. Ahora limpia en un array con `forEach`.
- ✅ **`obtenerTextoOpcion()` eliminada:** Función huérfana de la arquitectura anterior, nunca invocada.
- ✅ **Service Worker sincronizado:** `sw.js` ahora cachea las URLs reales de CDN que usa `index.html`. Implementa Network-first para Supabase y Cache-first para assets.
- ✅ **Alpine.js anclado a v3.14.1:** Prevenido posible breaking change por carga sin versión fija.
- ✅ **Click en logo del header:** Al hacer click en "Proyecto B787" ahora limpia el localStorage de banco/vista antes de navegar a inicio.
- ✅ **Meta tags SEO/PWA añadidos:** `description`, `theme-color`, `og:*`, `apple-mobile-web-app-capable`.

---

## BITÁCORA

### [2025-12-16] - CSS Logic Decoupling ✅

**REFACTOR COMPLETADO:**

- ✅ Eliminadas funciones `claseBoton()` y `estiloLetra()` de `app.js` (reducción de ~45 líneas)
- ✅ Migrada lógica de estilos a directivas `:class` en `index.html` (botones A, B, C, D)
- ✅ Mejora en separación de responsabilidades (UI vs Lógica de negocio)
- ✅ Estado Multi-Banco ya preparado (frontend listo, backend pendiente de migración DB)

**IMPACTO:**

- Código más mantenible: Los estilos visuales ahora se declaran en el template, no en funciones JS
- Reduce acoplamiento: Alpine.js solo maneja estado, no genera strings de CSS
- Preparación para Multi-Banco: Estructura ya soporta `bancoSeleccionado`, falta filtrado backend

**PRÓXIMOS PASOS:**

- Migración de base de datos para agregar columna `banco_id` a tabla `preguntas`
- Actualizar RPCs de Supabase para filtrar por banco seleccionado

---

### [2025-12-16] - Multi-Banco Backend Integration ✅

**IMPLEMENTACIÓN COMPLETADA:**

- ✅ Reemplazado array hardcodeado `bancos` por `listaBancos` dinámico desde BD
- ✅ Creada función `cargarBancos()` para fetch desde Supabase (tabla `bancos`)
- ✅ Actualizado `cargarPreguntas()` para pasar `p_banco_id` a RPCs
- ✅ Agregada validación: previene carga si no hay banco seleccionado
- ✅ Regla de negocio: Reset ATA al cambiar de banco
- ✅ UI actualizada: Feedback visual de selección (border azul + fondo tintado)
- ✅ Actualizado HTML: 3 referencias de `bancos` → `listaBancos`

**ESTRUCTURA DE BD REQUERIDA:**

- Tabla `bancos`: columnas `id`, `nombre`, `descripcion`, `slug`
- RPCs actualizados para aceptar parámetro `p_banco_id`

**RESULTADO:**

- Backend y frontend totalmente integrados para Multi-Banco
- El sistema ahora filtra preguntas por banco seleccionado
- Los ATAs se resetean al cambiar de contexto (previene inconsistencias)

**DOCUMENTACIÓN ACTUALIZADA:**

- ✅ `PROJECT_CONTEXT.md`: Actualizado estado actual para reflejar Multi-Banco completo y CSS desacoplado
- ✅ `PROJECT_BRIEF.md`: Marcados objetivos MVP A y B como completados

---

### [FECHA DE HOY] - INICIO DE REFACTORIZACIÓN

- Creada documentación base (Brief y Contexto).
- Objetivo inmediato: Implementar soporte para múltiples bancos de preguntas.

---

### [2025-12-17] - Double Validation UI Integration ✅

**IMPLEMENTACIÓN COMPLETADA:**

- ✅ Agregado estado `modoEstudio` a `app.js` (valores: `'general'` | `'repaso'`)
- ✅ Actualizada función `cargarPreguntas()` con bifurcación por modo:
  - **Modo General**: Llama RPC `obtener_general` con `p_banco_id`, `p_ata_id`, `cantidad`
  - **Modo Repaso**: Llama RPC `obtener_repaso` con `p_banco_id`, `cantidad`
- ✅ Implementado manejo inteligente de vacío:
  - Modo General vacío → Alert "Has completado todas las preguntas"
  - Modo Repaso vacío → Auto-switch a General + Alert "No tienes fallos pendientes"
- ✅ Actualizada función `responder()` para usar RPC `guardar_respuesta` con parámetro `p_modo_estudio`
- ✅ Agregado selector de modo en UI (tabs visuales con feedback activo)
- ✅ Actualizado getter `modoTexto` para indicar modo activo en display

**RPCS INTEGRADAS:**

- `obtener_general(p_banco_id, p_ata_id, cantidad)` - Preguntas generales con doble validación
- `obtener_repaso(p_banco_id, cantidad)` - Solo preguntas falladas pendientes
- `guardar_respuesta(p_pregunta_id, p_es_correcta, p_modo_estudio)` - Guardado con contexto de modo

**RESULTADO:**

- Sistema ahora implementa lógica de "Doble Validación" completa
- Usuario puede alternar entre estudio general y repaso de fallos visualmente
- Backend recibe contexto de modo para aplicar reglas de progresión correctas

---

### [2025-12-17] - Bank Loading & Selection Bug Fixes 🐛

**BUGS CORREGIDOS:**

- ✅ **BUG 1 - Lista de Bancos Vacía en Login Invitado**:

  - Agregado `await this.cargarBancos()` en `login()` y `loginAnonimo()`
  - Bancos ahora se cargan inmediatamente después de autenticación
  - Fix también aplicado al login con credenciales para consistencia

- ✅ **BUG 2 - "Próximamente" en B787 con Datos Disponibles**:

  - Agregados logs de depuración exhaustivos en `cargarPreguntas()`
  - Logs muestran: estado actual, parámetros enviados al RPC, respuesta recibida
  - Permite diagnóstico preciso de problemas de comunicación backend

- ✅ **REWIRING - Click en Tarjetas de Banco**:
  - Convertida `seleccionarBanco()` a función `async`
  - Ahora carga ATAs automáticamente al seleccionar banco
  - Limpia estado de preguntas viejas antes de cambiar de contexto
  - Logging agregado para rastrear el flujo de selección

**LOGS DE DEPURACIÓN AGREGADOS:**

```javascript
// En cargarPreguntas()
console.log("--- 🎯 INTENTO DE CARGA DE PREGUNTAS ---");
console.log("Estado actual:", {
  bancoSeleccionado,
  modoEstudio,
  entrada,
  modo,
});
console.log("📡 Enviando a RPC:", rpcName);
console.log("📦 Parámetros:", JSON.stringify(params, null, 2));
console.log("📥 Recibido del RPC:", { data, cantidad, error });
```

**RESULTADO:**

- Login como invitado ahora muestra bancos inmediatamente
- Flujo de selección de banco completamente funcional
- Diagnóstico de problemas backend ahora es trivial mediante consola

---

### [2025-12-17] - MAJOR REFACTOR: Batch Loading & Navigation 🚀

**ARQUITECTURA (3-TIER NAVIGATION):**

- **Inicio (Selección de Banco):** Carga inmediata de bancos disponibles sin bloquear la UI.
- **Dashboard (Configuración):** Nueva pantalla intermedia que permite elegir modo de estudio ("General" vs "Repaso" vs "Capítulos") y contexto antes de iniciar.
- **Quiz (Lotes de 50):** Se implementó carga por lotes (`cantidad: 50`) reduciendo llamadas al servidor en un 98%. Navegación interna instantánea (Client-side).

**CAMBIOS DE ESTADO:**

- **Store Global:** Renombrado `vista` a `vistaActual`. Agregados `cargando`, `rachaActual` y lógica de sesión robusta.
- **Persistencia:** Recuperación de sesión mediante `localStorage` para evitar pérdida de datos al recargar.

---

### [2025-12-17] - STABILIZATION & POLISH SPRINT (v1.0 Ready) ✨�️

**RESUMEN DE ESTABILIZACIÓN:**
Se cerró el ciclo de desarrollo con un sprint intensivo de corrección de errores críticos detectados en QA.

**1. LÓGICA CRÍTICA & BASE DE DATOS:**

- **Validación Robusta (The "Phantom" Fix):** Se reescribió `mezclarOpciones` para filtrar agresivamente opciones nulas/vacías. Ahora preguntas de True/False no muestran botones "C" y "D" fantasmas.
- **Persistencia Garantizada:** La RPC `guardar_respuesta` ahora recibe explícitamente `p_user_id` extraído no-bloqueantemente de la sesión. Manejo de errores `try/catch` implementado para asegurar continuidad incluso si falla la red.
- **Validación Directa:** Eliminadas las capas de "Mapeo Visual" propensas a error. La validación ahora compara la letra del objeto (`obj.letra`) directo contra DB.

**2. INTERFAZ DE USUARIO (UX):**

- **Flow Anti-Softlock:** Implementado sistema completo de Login/Registro en `index.html` para usuarios anónimos.
- **Feedback Adaptativo:** Colores de acierto/error intensificados (`bg-green-900`/`bg-red-900`) para mejor contraste en Dark Mode.
- **Scroll Fix:** Eliminadas restricciones de `overflow` en tarjetas de preguntas para permitir lectura cómoda en pantallas pequeñas.
- **Dashboard Contextual:** Tarjetas como "Por Capítulos" se ocultan inteligentemente si el banco seleccionado no tiene metadata (ej: Inglés).

**3. CALIDAD DE CÓDIGO:**

- **Limpieza:** Eliminación de funciones de autenticación duplicadas.
- **Logs:** Instrumentación completa de `console.log` para trazar el flujo de validación y RPCs.

**ESTADO FINAL:**

- Plataforma estable, performante y lista para despliegue productivo.

### [2025-12-17] - FEATURE: Bank Restriction & UI Polish 🚧🅰️

**REQUERIMIENTO USUARIO:**

- "Aun no he subido base de datos Inglés/AMOS, deberían salir 'Próximamente'".
- "Me gustaría que 'b787' estuviera en mayúscula (B787)".

**IMPLEMENTACIÓN:**

- **Routing Condicional (`app.js`):** `seleccionarBanco(id)` ahora verifica si el banco es `b787`.
  - Si ES `b787` -> Navega al Dashboard.
  - Si NO ES `b787` -> Navega a nueva vista `proximamente` (estado soft-lock).
- **Vista 'Próximamente' (`index.html`):** Nueva sección con diseño "Under Construction", icono 🚧 y botón para volver al inicio.
- **Tipografía (`index.html`):** Añadido `.toUpperCase()` al renderizado de `banco.slug` para forzar "B787".

---

### [2025-12-18] - Bug Hunting: Error 404 & Session Persistence 🐞

**CORRECCIONES APLICADAS:**

- ✅ **FIX RPC (Error 404):**

  - Renombrada llamada RPC de `guardar_respuesta` a `guardar_intento` en `app.js` (función `responder`).
  - Esto soluciona el error 404 al intentar guardar progreso.

- ✅ **PERSISTENCIA DE SESIÓN (Cambio de Pestaña):**

  - Implementado guardado local de `app_banco_actual` y `app_vista` en `seleccionarBanco`.
  - Modificado `initApp()` para restaurar automáticamente la sesión (Banco + Vista) si existe.
  - Esto evita que la app se reinicie al "Inicio" al recargar o cambiar de pestaña.

- ✅ **LIMPIEZA DE SESIÓN:**
  - Asegurada limpieza de `app_banco_actual` y `app_vista` al cerrar sesión o cambiar de banco manualmente.
  - Garantiza que el botón "Volver a Inicio" realmente reinicie el flujo.

**RESULTADO:**

- Experiencia de usuario más robusta y tolerante a fallos de red o recargas accidentales.
- Eliminados errores de consola por RPC inexistente.

- ✅ **FIX VISUAL (Dashboard Bloqueado):**

  - Corregida condición `x-show` en el bloque "En Construcción" (`index.html`).
  - Ahora se restringe estrictamente a `vistaActual === 'quiz'`, evitando que aparezca erróneamente en el Dashboard vacío.

- ✅ **FIX CRÍTICO (Invisible Dashboard):**

  - Restaurado el bloque HTML completo de la sección Dashboard.
  - Corregido diseño Grid y depurados botones de navegación internos.
  - Solucionado el problema donde la selección de banco llevaba a una pantalla vacía.

- ✅ **FIX LÓGICO (White Screen):**

  - Eliminados condicionales en `seleccionarBanco` que causaban redirección errónea si `preguntas.length === 0`.
  - Ahora el flujo es lineal y fuerza la vista `dashboard` tras cargar metadatos.

- ✅ **FIX SESIÓN (User Undefined):**

  - Corregida inicialización de sesión en `initApp` (`this.session = session`).
  - Implementado fallback robusto para obtener `user_id` en `responder()` (`this.session?.user?.id || this.auth.user?.id`).
  - Previene fallos en guardar progreso si la sesión se recarga.

- ✅ **FIX ZOMBIE STATE (Proximamente Loop):**
  - Eliminada cualquier lógica condicional que desviara a la vista `proximamente`.
  - Reescrita función `seleccionarBanco` para forzar explícitamente `this.vistaActual = 'dashboard'`.
  - Asegurada persistencia de la vista correcta en `localStorage`.

---

### [2026-04-24] - Fix Crítico: Recuperación de Sesión y Feedback Visual 🛡️

**BUGS CORREGIDOS:**

- ✅ **FIX CRÍTICO (Session Drop al suspender pestaña):**
  - **Problema:** Si el usuario dejaba la app en segundo plano por mucho tiempo, el SO suspendía la pestaña. Al volver, la app se recargaba y `initApp()` expulsaba intencionalmente al usuario al inicio (`vistaActual = 'inicio'`) para "evitar estados rotos", perdiendo el progreso actual del quiz.
  - **Solución:** Se habilitó `this.recuperarSesion()` en `initApp()` cuando `vistaGuardada === 'quiz'`. La app ahora detecta que estabas en medio de un test y te devuelve exactamente a la pregunta en la que ibas sin interrumpir el flujo.

- ✅ **FIX LÓGICO (Opciones no guardadas):**
  - **Problema:** La función `recuperarSesion` estaba deshabilitada porque no funcionaba bien. El problema era que `guardarEstadoLocal` no estaba guardando `this.opcionesActuales` (el orden barajado de A,B,C,D). Al restaurar, las opciones quedaban vacías y la UI se rompía.
  - **Solución:** Se actualizó `guardarEstadoLocal` para serializar `opcionesActuales` en el `localStorage` y `recuperarSesion` para restaurarlas correctamente.

- ✅ **MEJORA UX (Feedback Visual de Carga):**
  - **Problema:** Si la red estaba inestable y el usuario era expulsado al menú de inicio, al hacer clic en un banco (`seleccionarBanco`) la app se quedaba esperando la respuesta de Supabase sin mostrar ningún indicador visual de carga ("parecía que el botón no hacía nada").
  - **Solución:** Se implementó un *overlay* visual (`x-show="cargando && bancoSeleccionado === banco.id"`) con un *spinner* ("Conectando...") sobre la tarjeta del banco seleccionado en `index.html`. Ahora el usuario sabe instantáneamente que la app está procesando su petición, incluso si el internet es lento.
