# PROJECT_BRIEF.md: B787 & Aviation Tech Certification Platform

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

El sistema debe dejar de ser "B787-céntrico" en su arquitectura y soportar tres bancos de preguntas independientes:

1.  **B787**: Sistemas, ATAs, Procedimientos.
2.  **Inglés Técnico**: Terminología aeronáutica.
3.  **AMOS**: Uso del software de gestión de mantenimiento.

> **Estado:** ✅ Implementado. Bancos se cargan dinámicamente desde tabla `bancos` en Supabase. RPCs filtran preguntas por `p_banco_id`. UI proporciona feedback visual de selección.

### B. Refactorización y Profesionalización ✅ **COMPLETADO**

- **Limpieza de Código**: ✅ Eliminados comentarios `TODO`, estandarizada nomenclatura.
- **Desacople UI/Lógica**: ✅ Clases de estilos movidas a directivas `:class` en HTML. Eliminadas funciones `claseBoton()` y `estiloLetra()`.
- **Corrección de Textos**: ⏳ Pendiente de revisión final.

### C. Gestión de Contenidos ⏳ **PARCIAL**

- **Ingesta**: La carga de datos se mantendrá vía **CSV/Importación directa a Supabase** (no se desarrollará panel de admin en el MVP).
- **Estructura**: ✅ La base de datos es agnóstica al contenido (estructura flexible para 3 bancos implementada).

---

## 4. Reglas de Negocio

### 4.1. Mecánica de Estudio

1.  **Selección de Contexto**: El usuario elige Banco -> Modo (Aleatorio, Por Capítulo/ATA, Repaso Fallos).
2.  **Anti-Memoria**: Las opciones de respuesta se barajan aleatoriamente en cada visualización.
3.  **Feedback Inmediato**: Validación visual (Verde/Rojo) instantánea tras seleccionar.

### 4.2. Progresión y Gamificación

- **Rangos**: Mantener el sistema de rangos (Aspirante -> Inspector) basado en el volumen histórico de aciertos.
- **Historial**: El progreso se guarda por usuario autenticado.

### 4.3. Seguridad

- **Validación**: Se acepta la validación en el lado del cliente (Client-side) para reducir latencia y costes de servidor.
- **Integridad**: Se asume que el usuario no hará trampas (revisar consola) ya que el incentivo es el auto-aprendizaje honesto.

### 4.4 Lógica de Aprendizaje (Algoritmo de Doble Validación)

1.  **Modo General (Maestría)**:

    - Objetivo: Retirar preguntas del mazo activo.
    - Criterio de Retiro: 2 respuestas correctas _consecutivas_ en modo General.
    - Penalización: Un fallo reinicia el contador de aciertos a 0 y envía la pregunta a "Repaso".

2.  **Modo Repaso (Cuarentena)**:
    - Objetivo: Devolver preguntas al mazo General.
    - Criterio de Alta: 2 respuestas correctas _consecutivas_ en modo Repaso.
    - Dinámica: Una pregunta en repaso NO aparece en General hasta que se gradúa.

---

## 5. Arquitectura Técnica

### Stack Tecnológico (Confirmado)

- **Frontend**: HTML5 + Tailwind CSS + Alpine.js (Sin bundlers complejos).
- **Backend**: Supabase (PostgreSQL + Auth).
- **Infraestructura**: PWA (Service Worker para cacheo de assets, aunque la data requiere conexión online para sincronizar progreso).

### Modelo de Datos (Conceptual)

Se requiere una migración para añadir la columna `banco_id` o `categoria` a las tablas principales:

- `bancos`: { id, nombre (B787, Inglés, AMOS), descripcion }
- `preguntas`: { ..., banco_id, ... }
- `atas/categorias`: { ..., banco_id, ... }

---

## 6. Definición de Éxito

El proyecto se considerará exitoso cuando:

1.  El usuario pueda loguearse y elegir cualquiera de los 3 bancos.
2.  Pueda completar una ronda de 20 preguntas de "AMOS" y ver sus estadísticas actualizadas.
3.  El código fuente esté limpio, comentado profesionalmente y sin "hardcoding" de estilos en el JS.
