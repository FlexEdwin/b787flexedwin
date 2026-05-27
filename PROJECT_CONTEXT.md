# Auditoría Técnica del Proyecto: B787 Certification Platform

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

- `reiniciar_progreso(p_ata_id)`: Resetea historial del usuario.
- `repasar_falladas(filtro_ata_id)`: Devuelve preguntas falladas previamente.
- `estudiar_preguntas(filtro_ata_id)`: Devuelve preguntas nuevas o aleatorias.
- `registrar_respuesta(p_pregunta_id, es_correcta)`: Guarda el intento y actualiza stats.

## Esquema de Base de Datos (Snapshot)

| tablename | policyname                               | operation | roles                |
| --------- | ---------------------------------------- | --------- | -------------------- |
| progreso  | Permitir todo en progreso                | ALL       | {public}             |
| progreso  | Todo para el usuario                     | ALL       | {authenticated}      |
| progreso  | Usuarios ven y editan su propio progreso | ALL       | {public}             |
| preguntas | Acceso público a preguntas               | SELECT    | {anon,authenticated} |
| atas      | allow_anonymous_read_atas                | SELECT    | {anon}               |
| atas      | allow_authenticated_read_atas            | SELECT    | {authenticated}      |

### Reglas de Base de Datos (Respuestas)

Para soportar el algoritmo de Doble Validación, la tabla `respuestas` debe registrar el `modo_estudio` en el que se respondió ('general' o 'repaso').

**Cálculo de Estados (Vía RPC):**

- **Estado 'Retirada'**: `COUNT(consecutive_correct_general) >= 2`
- **Estado 'En Repaso'**: La última respuesta en General fue FALLO, y `COUNT(consecutive_correct_repaso) < 2`.

---

## 4. Estado Actual del Proyecto (v1.0 Candidate)

### ✅ Arquitectura & Core

- **Navegación 3-Niveles**: `Inicio (Selección)` -> `Dashboard (Config)` -> `Quiz (Estudio)`.
- **Carga Eficiente**: Implementado Batch Loading (50 preguntas/request) reduciendo latencia.
- **Validación Robusta**: Algoritmo "Direct-Check" (sin mapeo visual) que elimina falsos negativos.
- **Persistencia**: Manejo de sesión resiliente con recuperación vía `localStorage`.

### ✅ Features Completadas

- **Autenticación**: Flujo completo (Login / Invitado / Logout) con UI dedicada.
- **Multi-Banco**: Operativo para B787, Inglés, AMOS y Regulaciones Aeronáuticas.
- **Soporte de Imágenes**: Renderizado de imágenes de referencia en las preguntas (ej. AMOS) directamente desde el bucket público `preguntas-media` de Supabase Storage.
- **Feedback Visual**: UI de alto contraste para Dark Mode (`bg-green-900`/`bg-red-900`).
- **Adaptabilidad**: Dashboard se ajusta al contenido del banco (oculta ATAs si no existen).

### ⚠️ Deuda Técnica Restante

- **Bundling**: Se mantiene la política "No Build Tools" (CDN/Scripts directos), lo cual limita tree-shaking pero cumple el requerimiento de simplicidad.
- **Offline Mode**: Service Worker básico presente pero requiere estrategia de sincronización avanzada para "Offline-First" real.

---

## 5. Reglas de Negocio Actualizadas

### Objetivo

Plataforma de entrenamiento de alto rendimiento para certificación B787.

### Mecánica de Validación (Refactor 2025)

1. **Anti-Memorización**: Las opciones se barajan pero conservan su identidad (`{letra: 'B', texto: '...'}`).
2. **Validación**: Al hacer click, se compara `opcion.letra` vs `db.correcta` directamente.
3. **Persistencia**: Cada respuesta se envía a Supabase (`rpc/guardar_respuesta`) con el ID del usuario. Si falla la red, el quiz continúa, priorizando la experiencia de estudio.

### Seguridad

- Validación "Optimista" en cliente para UX instantánea.
- Validación asíncrona en servidor para registro oficial de progreso.
