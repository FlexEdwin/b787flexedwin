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
    - `correcta`: Char ('A', 'B', 'C', 'D') indicando la respuesta correcta.
    - _(Probable)_ `ata_id`: FK hacia tabla `atas`.

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

## 4. Estado Actual del Proyecto

### ✅ Lo que Funciona

- **Autenticación**: Login funcional con Supabase y persistencia de sesión. Modo Invitado implementado.
- **Multi-Banco Completo**: Sistema de bancos dinámico cargado desde BD. Filtrado de preguntas por banco seleccionado mediante parámetro `p_banco_id` en RPCs. Feedback visual de selección con estados reactivos.
- **Ciclo de Quiz**: Carga de preguntas, selección de respuestas, feedback visual (verde/rojo), transición entre preguntas.
- **Lógica de Negocio**: Randomización de opciones (Fisher-Yates) para evitar memoria visual de posición. Mapeo "Visual vs Real" robusto. Reset automático de ATA al cambiar de banco.
- **Estadísticas**: Feedback inmediato de racha, correctas/incorrectas y gráfico final con Chart.js.
- **Persistencia Local**: Recuperación de sesión (si cierras el navegador en medio de un quiz) usando `localStorage`.
- **Arquitectura Limpia**: CSS lógico desacoplado de JavaScript. Estilos declarados en HTML usando directivas `:class` de Alpine.js.

### ⚠️ Deuda Técnica Restante

- **Gestión de Dependencias**: Las librerías de vendor (alpine, supabase, etc.) se bajan con `curl` en un script npm custom, en lugar de usar un bundler estándar, lo que dificulta la gestión de versiones y tree-shaking.

---

## 5. Reglas de Negocio

### Objetivo

Plataforma de estudio y certificación para técnicos de mantenimiento aeronáutico (específicamente flota Boeing 787).

### Roles de Usuario

- **Usuario Registrado**: Guarda progreso histórico en la nube (Supabase).
- **Invitado**: Acceso temporal, sin garantías de guardado a largo plazo (usa Auth anónimo).

### Mecánica de Estudio

1.  **Niveles**: El usuario escala de "Aspirante" a "Inspector / Ing." basándose en el volumen de respuestas correctas acumuladas (<50, <200, <500, 500+).
2.  **Modos de Estudio**:
    - _General_: Aleatorio global.
    - _Por ATA_: Focalizado en sistemas específicos (e.g., Eléctrico, Motor).
    - _Repaso de Fallos_: Algoritmo de repetición espaciada simple (volver a ver lo que se falló).
3.  **Anti-Memorización**: Las opciones (A, B, C, D) se barajan visualmente cada vez. El sistema sabe que si la respuesta correcta es "Valve Open", puede aparecer en la posición A hoy y en la C mañana, y valida correctamente contra la DB.

### Seguridad

- La validación de respuesta correcta ocurre en cliente (`correcta` viene en el objeto `preguntaActual`), pero el registro oficial se hace vía RPC en servidor. _Nota de auditoría: Esto permite "hacer trampas" viendo la red, pero es aceptable para una app de estudio no-oficial/autoevaluación._
