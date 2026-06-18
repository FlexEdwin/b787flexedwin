# Auditoría Técnica del Proyecto: Proyecto Escalafón

Este documento recoge el estado actual, arquitectura y reglas de negocio del proyecto, generado tras un análisis exhaustivo del código fuente.

## 1. Stack Tecnológico Exacto

### Core & Frontend

- **Lenguaje**: HTML5, Vanilla JavaScript (ES6+).
- **Framework JS**: **Alpine.js v3.13.3** (Manejo de estado reactivo y directivas en el DOM).
- **Estilos**: **Tailwind CSS v3.4.1** (Compilado vía CLI).
- **Bundler**: No se utiliza bundler complejo (Webpack/Vite para build final no observado en scripts, uso directo de CLI y CDN).

### Librerías Clave (Client-side)

- **Supabase JS v2**: Cliente para interactuar con Backend as a Service.
- **Chart.js**: Visualización de gráficas de rendimiento (Doughnut charts).
- **Canvas Confetti**: Animaciones de celebración.

### Backend & base de Datos

- **Plataforma**: **Supabase** (PostgreSQL + Auth + Edge Functions/RPCs).
- **Autenticación**: Supabase Auth (Email/Password y Anonymous Sign-in).

### Infraestructura Local

- Service Worker (`sw.js`): Existe un archivo base para PWA, aunque en `app.js` hay lógica para desregistrarlo en modo desarrollo.
- Manifest (`manifest.json`): Configuración basica de PWA.

---

## 2. Arquitectura de Carpetas

La estructura del proyecto es plana y orientada a prototipado rápido o SPA ligera.

```text
/ (Raíz)
├── index.html              # Punto de entrada único (Single Page Application). Contiene todo el markup y templates Alpine.js.
├── index_original_backup.html # Backup de versión anterior.
├── index_professional.html   # Variante visual (posiblemente deprecated o A/B test).
├── package.json            # Scripts de NPM y dependencias de desarrollo (Tailwind).
├── tailwind.config.js      # Configuración del sistema de diseño.
├── manifest.json           # Definición PWA.
├── sw.js                   # Service Worker (Cache strategy).
├── output.css              # CSS compilado final para producción/dev.
├── ...librerías.js         # (alpine.js, supabase.js, etc.) Descargadas localmente vía script.
└── src/
    ├── input.css           # Punto de entrada de Tailwind (Directivas @tailwind).
    └── js/
        └── app.js          # Lógica de negocio principal. Contiene el estado global de Alpine.js (Store).
```

---

## 3. Base de Datos (Inferida del Código)

Basado en las llamadas RPC y consultas `sb.from()` en `src/js/app.js`, este es el esquema relacional aparente:

### Tablas

1.  **`atas`**

    - `id`: Identificador numérico (e.g., 29 para hidráulica).
    - `nombre`: Descripción del capítulo ATA.
    - _Uso_: Poblado en dropdown de selección de módulos.

2.  **`preguntas`** (Estructura inferida)

    - `id`: UUID o Int.
    - `numero`: Identificador legible para el usuario.
    - `texto`: Enunciado de la pregunta.
    - `opcion_a`, `opcion_b`, `opcion_c`, `opcion_d`: Textos de las respuestas.
    - `correcta`: TEXT o VARCHAR. Indica la/las opciones correctas (ej. 'A' o 'A,B' para múltiples válidas).
    - `image_url`: TEXT (opcional). Nombre de la imagen en Supabase Storage.
    - _(Probable)_ `ata_id`: FK hacia tabla `atas`.
    - _(Probable)_ `banco_id`: FK hacia tabla `bancos`.

3.  **`respuestas`** (Inferida por lógica de stats)
    - No consultada directamente, pero gestionada a través de RPCs para guardar historial de usuario, aciertos y fallos.

### Stored Procedures (RPCs)

El backend delega lógica compleja a funciones de base de datos para seguridad y encapsulamiento:

- `reiniciar_progreso(p_banco_id, p_ata_id, p_reiniciar_maestria, p_reiniciar_exclusiones)`: Reinicia de forma selectiva el progreso del usuario borrando sus registros de `respuestas` (si `p_reiniciar_maestria` es TRUE) y/o borrando sus registros de `exclusion` (si `p_reiniciar_exclusiones` es TRUE). Las preguntas favoritas (`favorita`) nunca se borran. Filtra por banco activo (`p_banco_id`) y opcionalmente por ATA.
- `obtener_general(p_banco_id, p_ata_id, cantidad, p_umbral_maestria)`: Devuelve preguntas aleatorias excluyendo las dominadas (maestradas según el umbral configurado), excluidas ("Ya me la sé") y en repaso (cuarentena).
- `obtener_repaso(p_banco_id, cantidad)`: Devuelve preguntas falladas que se encuentran en cuarentena (repaso), excluyendo las marcadas con "Ya me la sé".
- `obtener_favoritas(p_banco_id, cantidad)`: Devuelve todas las preguntas marcadas como favoritas del banco activo para el usuario actual.
- `guardar_intento(p_pregunta_id, p_es_correcta, p_modo_estudio, p_user_id)`: Guarda el intento de respuesta del usuario en la tabla `respuestas`.

## Esquema de Base de Datos (Snapshot)

| tablename | policyname                               | operation | roles                |
| --------- | ---------------------------------------- | --------- | -------------------- |
| progreso  | Permitir todo en progreso                | ALL       | {public}             |
| progreso  | Todo para el usuario                     | ALL       | {authenticated}      |
| progreso  | Usuarios ven y editan su propio progreso | ALL       | {public}             |
| preguntas | Acceso público a preguntas               | SELECT    | {anon,authenticated} |
| atas      | allow_anonymous_read_atas                | SELECT    | {anon}               |
| atas      | allow_authenticated_read_atas            | SELECT    | {authenticated}      |
| favorita  | Permitir todo a usuarios en sus favoritas | ALL       | {public}             |
| exclusion | Permitir todo a usuarios en sus exclusiones| ALL     | {public}             |

### Reglas de Base de Datos (Respuestas)

Para soportar el algoritmo de repetición espaciada y doble validación, la tabla `respuestas` registra el `modo_estudio` en el que se respondió ('general' o 'repaso').

**Cálculo de Estados (Vía RPC):**

- **Estado 'Excluida'** (Maestría Instantánea): Pregunta registrada en la tabla `exclusion`. Nunca volverá a aparecer en las sesiones de estudio general ni de repaso.
- **Estado 'Favorita'**: Pregunta registrada en la tabla `favorita`. Permite al alumno estudiar este set por separado. Es persistente y no se borra al reiniciar progreso.
- **Estado 'Retirada'** (Maestrada): `COUNT(consecutive_correct_general) >= p_umbral_maestria`. El usuario debe acertar la pregunta consecutivamente las veces indicadas en su configuración de maestría (1, 2 o 3 veces seguidas) para retirarla del pool general de estudio.
- **Estado 'En Repaso'** (Cuarentena): La última respuesta en General fue FALLO, y no se ha respondido correctamente en Repaso todavía (es decir, r.modo_estudio = 'repaso' y r.es_correcta = true después de dicho fallo). Responderla bien una vez la libera del repaso y la devuelve al entrenamiento general.

---

## 4. Estado Actual del Proyecto (v1.9.5 Estable)

### ✅ Arquitectura & Core

- **Navegación 3-Niveles**: `Inicio (Selección)` -> `Dashboard (Config)` -> `Quiz (Estudio)`.
- **Carga Eficiente**: Implementado Batch Loading variable (25/50/100 preguntas por request) y Repaso Ilimitado reduciendo latencia y mejorando control de estudio.
- **Validación Robusta**: Algoritmo "Direct-Check" (sin mapeo visual) que elimina falsos negativos.
- **Persistencia**: Manejo de sesión resiliente con recuperación vía `localStorage` utilizando prefijos dedicados (`escalafon_sesion`).

### ✅ Features Completadas

- **Autenticación**: Flujo completo con UI dedicada (se destaca la opción "Entrar como Invitado" y se limpia el header según el tipo de usuario).
- **Multi-Banco**: Operativo para B787, Inglés, AMOS y Regulaciones Aeronáuticas.
- **Soporte de Imágenes**: Renderizado adaptativo de imágenes desde el bucket `preguntas-media` de Supabase Storage.
- **Fix "Imagen Fantasma" (Ghost Image)**: Control de transición de imágenes con estado `imagenCargada` y skeleton loading para evitar visualización incorrecta durante conexiones lentas.
- **Reinicio de Progreso Configurable**: Modal interactivo nativo que permite al usuario decidir si desea reiniciar la Maestría/Progreso general y/o las Exclusiones ("Ya me la sé"), manteniendo las Favoritas intactas.
- **Estadísticas de Aprendizaje Reales**: Visualización del progreso real ("X preguntas por aprender de Y") en lugar del contador de racha tradicional en la pantalla de resultados.
- **Panel de Ayuda / FAQ**: Modal flotante disponible en toda la aplicación para explicar de forma interactiva las mecánicas de estudio, sincronización y doble validación.
- **Feedback Visual y Enlaces**: Footer dinámico con enlaces interactivos a `flexedwin.com` y correo de soporte `hello@flexedwin.com`.
- **Visualización sin Penalización ("Ver Respuesta")**: Botón que ilumina la respuesta correcta en verde, bloquea la selección e intercambia el botón inferior por "Continuar" para avanzar sin registrar intentos en Supabase ni alterar las estadísticas del lote.
- **Auto-Recarga de Estadísticas**: Refresco reactivo y en segundo plano de las estadísticas de avance del banco al cancelar, salir o pausar una sesión de Quiz, eliminando desfases sin recargas manuales (F5).

### ⚠️ Deuda Técnica Restante

- **Bundling**: Se mantiene la política "No Build Tools" (CDN/Scripts directos), lo cual limita tree-shaking pero cumple el requerimiento de simplicidad.
- **Offline Mode**: Service Worker cachea activos de CDN estables pero requiere estrategia de sincronización avanzada para "Offline-First" real.

---

## 5. Reglas de Negocio Actualizadas

### Objetivo

Plataforma de entrenamiento de alto rendimiento para certificaciones técnicas.

### Mecánica de Validación

1. **Anti-Memorización**: Las opciones se barajan pero conservan su identidad (`{letra: 'B', texto: '...'}`).
2. **Validación**: Al hacer click, se compara `opcion.letra` vs `db.correcta` directamente. Soporta múltiples letras correctas (ej. `A,B`).
3. **Persistencia**: Cada respuesta se envía a Supabase (`rpc/guardar_intento`) con el ID del usuario. Si falla la red, el quiz continúa, priorizando la experiencia de estudio.
4. **Ver Respuesta sin Penalización**: Si el usuario usa el botón `👁 Ver Respuesta`, se resalta la opción correcta y se bloquean las opciones para evitar respuestas posteriores. Al avanzar (usando el botón "Continuar"), no se envía ningún intento de respuesta a Supabase (`rpc/guardar_intento`), por lo que la pregunta no cuenta como acierto ni fallo, ni entra en repaso.

### Lógica de Progreso y Estadísticas del Banco (v1.8)

1. **Total de Preguntas del Banco**: Cantidad de preguntas asociadas al `banco_id` activo.
2. **Preguntas por Aprender (Pendientes)**: Suma de las preguntas devueltas por `obtener_general(9999)` (no dominadas) y `obtener_repaso(9999)` (en repaso por fallos).
3. **Preguntas Dominadas (Maestradas)**: Calculadas como `Total del Banco - Preguntas por Aprender`. Esto representa el progreso real del usuario.
4. **Reinicio de Progreso**: El usuario puede limpiar su progreso del banco actual llamando a `reiniciar_progreso(p_banco_id, p_ata_id, p_reiniciar_maestria, p_reiniciar_exclusiones)` vía RPC. El RPC borra de manera condicional los registros de la tabla `respuestas` y/o `exclusion` según la selección del usuario en el modal. Las favoritas nunca se eliminan.

### Seguridad

- Validación "Optimista" en cliente para UX instantánea.
- Validación asíncrona en servidor para registro oficial de progreso.
- Visualización de email/nombre personalizada en header según sesión (soporta usuarios anónimos/invitados).
