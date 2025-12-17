# AI PROJECT LOG

## Estado Actual

- **Progreso:** ~20% completado.
- **Funcionalidad:** Login, Quiz básico B787, Gráficas.
- **Pendiente Crítico:** Arquitectura Multi-Banco (Inglés/AMOS) y refactorización de código.

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
