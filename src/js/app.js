// --- CONFIGURACIÓN SUPABASE ---
// REEMPLAZA CON TUS CREDENCIALES REALES
const SUPABASE_URL = 'https://kvqstfjvvnmwgutckdev.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cXN0Zmp2dm5td2d1dGNrZGV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjY2MjIsImV4cCI6MjA3OTE0MjYyMn0.i2Q2XpaV3MUhLDwrnXqaJI1a-G2cM74fr0W4HRo6RI0';

// Inicialización del cliente (usando la librería global window.supabase)
const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function app() {
    return {
        // --- ESTADO GLOBAL ---
        vistaActual: 'cargando', // Estados posibles: 'cargando' | 'login' | 'inicio' | 'dashboard' | 'quiz' | 'fin'
        cargando: false,           // Indicador global de carga
        mensajeCarga: 'Iniciando sistemas...',
        auth: { email: '', password: '', user: null },
        cargandoAuth: false,
        atas: [],
        ataSeleccionado: '',

        // --- BANCOS DE PREGUNTAS ---
        bancoSeleccionado: null,
        listaBancos: [], // Poblado desde la base de datos vía cargarBancos()

        // --- ESTADO DEL QUIZ ---
        modo: '',
        modoEstudio: 'general', // 'general' o 'repaso' — Lógica de Doble Validación
        cantidadPreguntas: 25,   // Cantidad de preguntas por sesión (25, 50 o 100). Configurable desde el Dashboard.
        preguntas: [],           // Lote activo de preguntas (cantidad variable)
        indiceActual: 0,         // Índice dentro del lote
        bloqueado: false,
        seleccionada: null,      // Letra seleccionada visualmente (A, B, C, D)
        ordenOpciones: ['A', 'B', 'C', 'D'], // Mapeo: Posición Visual → Letra real en BD
        opcionesActuales: [],    // Opciones barajadas estáticas para evitar re-render
        mostrarSiguiente: false,
        sesionGuardada: false,
        stats: { correctas: 0, incorrectas: 0, racha: 0 },

        // --- UX / UI ---
        toast: { visible: false, mensaje: '', tipo: 'info' },
        chartInstance: null,
        imagenCargada: true,  // Controla visibilidad de la imagen: false mientras carga, true cuando lista
        mostrarAyuda: false,   // Estado del modal de FAQ

        // --- STATS DEL BANCO ---
        totalPreguntasBanco: 0,
        preguntasMaestradasBanco: 0,

        // --- GETTERS COMPUTADOS ---
        get preguntaActual() {
            return this.preguntas[this.indiceActual]; // Getter dinámico: apunta al índice actual del lote
        },
        get modoTexto() {
            const map = { 'nuevas': 'Estudio General', 'ata': 'Por Categoría', 'fallos': 'Repaso de Fallos' };
            const modoDisplay = this.modoEstudio === 'repaso' ? ' (Repaso)' : ' (General)';
            return (map[this.modo] || 'Estudio') + modoDisplay;
        },
        get urlImagenActiva() {
            if (!this.preguntaActual || !this.preguntaActual.image_url) return null;
            // Construimos la URL: [SupabaseURL]/storage/v1/object/public/[Bucket]/[NombreImagen]
            const bucketName = 'preguntas-media'; 
            return `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${this.preguntaActual.image_url}`;
        },
        // Retorna el vocabulario correcto de categoría según el banco activo:
        // 'ingles' → 'Tema' | 'regulaciones' → 'Categoría' | default → 'Capítulo'
        get labelCategoria() {
            const banco = this.listaBancos.find(b => b.id === this.bancoSeleccionado);
            const slug = banco?.slug || '';
            if (slug === 'ingles') return 'Tema';
            if (slug === 'regulaciones') return 'Categoría';
            return 'Capítulo';
        },
        // Retrocompatibilidad: getter esIngles conservado para no romper templates existentes
        get esIngles() {
            const banco = this.listaBancos.find(b => b.id === this.bancoSeleccionado);
            return banco?.slug === 'ingles';
        },
        // Progreso legible del lote actual para mostrar en la barra superior del quiz
        get progresoLote() {
            if (!this.preguntas.length) return 'Sin preguntas';
            const actual = Math.min(this.indiceActual + 1, this.preguntas.length);
            return `Pregunta ${actual} de ${this.preguntas.length}`;
        },
        get progresoPorcentaje() {
            return this.preguntas.length ? ((this.indiceActual + 1) / this.preguntas.length) * 100 : 0;
        },
        get porcentajeAcierto() {
            const total = this.stats.correctas + this.stats.incorrectas;
            return total === 0 ? 0 : Math.round((this.stats.correctas / total) * 100);
        },
        get rachaActual() {
            return this.stats ? this.stats.racha : 0; 
        },
        get fallosSesion() {
            return this.stats ? this.stats.incorrectas : 0; 
        },
        get nivelUsuario() {
            const score = this.stats.correctas;
            if (score < 50) return 'Aspirante';
            if (score < 200) return 'Técnico Nivel 1';
            if (score < 500) return 'Técnico Nivel 2';
            return 'Inspector / Ing.';
        },
        // Nombre visible en el header: muestra 'Invitado', el alias del email o 'Usuario'
        get nombreUsuario() {
            if (!this.auth.user) return '';
            if (this.auth.user.is_anonymous) return 'Invitado';
            const email = this.auth.user.email || '';
            if (email) return email.split('@')[0];
            return 'Usuario';
        },
        get esInvitado() {
            return this.auth.user?.is_anonymous === true;
        },
        // Preguntas pendientes de maestría en el banco activo (nunca negativo)
        get preguntasPendientes() {
            return Math.max(0, this.totalPreguntasBanco - this.preguntasMaestradasBanco);
        },

        // --- CICLO DE VIDA ---
        async initApp() {
            this.checkLocalStorage();

            // 1. Verificar Sesión
            const { data: { session } } = await sb.auth.getSession();
            
            if (session) {
                this.session = session;
                this.auth.user = session.user;
                this.cargando = true;
                try {
                    // ✅ Carga única: evitar llamadas redundantes
                    await Promise.all([this.cargarAtas(), this.cargarBancos()]);
                    
                    // Restaurar sesión persistente si aplica
                    const bancoGuardado = localStorage.getItem('app_banco_actual');
                    const vistaGuardada = localStorage.getItem('app_vista');
                    
                    if (bancoGuardado) {
                        this.bancoSeleccionado = bancoGuardado;
                        
                        if (vistaGuardada === 'dashboard') {
                            this.vistaActual = 'dashboard';
                        } else if (vistaGuardada === 'quiz') {
                            this.recuperarSesion();
                        } else {
                            this.vistaActual = 'inicio';
                        }
                    } else {
                        this.vistaActual = 'inicio';
                    }
                } catch (e) {
                    console.error('Error cargando datos iniciales:', e);
                    this.vistaActual = 'inicio';
                } finally {
                    this.cargando = false;
                }
            } else {
                this.vistaActual = 'login';
            }

            // ✅ FIX F5: Watcher reactivo de seguridad.
            // Si por cualquier motivo el usuario llega a 'inicio' con listaBancos vacío
            // (race condition de auth asíncrona, fallo de red, etc.), recarga automáticamente.
            this.$watch('vistaActual', async (val) => {
                if (val === 'inicio' && this.listaBancos.length === 0 && !this.cargando) {
                    await this.cargarBancos();
                }
            });

            // Escuchar cambios de auth (Logout/Login/Token Refresh)
            sb.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    // Distinguir login real de refresco silencioso del JWT.
                    const esLoginReal = !this.auth.user;
                    this.auth.user = session.user;
                    this.session   = session;

                    if (esLoginReal) {
                        // Login genuino desde pantalla de login → cargar y navegar.
                        this.vistaActual = 'inicio';
                        await Promise.all([this.cargarBancos(), this.cargarAtas()]);
                    }
                    // Si NO es login real (refresco de token) → $watch cubre el caso
                    // donde listaBancos pudiera estar vacío.

                } else if (event === 'TOKEN_REFRESHED' && session) {
                    // Sólo actualizar token en memoria, sin redirigir.
                    this.auth.user = session.user;
                    this.session   = session;

                } else if (event === 'SIGNED_OUT') {
                    this.auth.user = null;
                    this.session   = null;
                    this.vistaActual = 'login';
                }
            });
        },

        // --- GESTIÓN DE DATOS ---

        // Carga los ATAs/Temas/Categorías del banco activo.
        // Filtra por banco_id para que cada banco muestre solo sus propias categorías.
        // Acepta un bancoId explícito para no depender de reactividad asíncrona del estado.
        async cargarAtas(bancoId = null) {
            const idFiltro = bancoId || this.bancoSeleccionado;
            try {
                let query = sb.from('atas').select('id, nombre').order('id');

                if (idFiltro) {
                    query = query.eq('banco_id', idFiltro);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('Error cargando ATAs:', error);
                    this.atas = [];
                    return;
                }

                this.atas = (data && Array.isArray(data)) ? data : [];

            } catch (e) {
                console.error('Error fatal cargando ATAs:', e);
                this.atas = [];
            }
        },

        async cargarBancos() {
            this.cargando = true;
            try {
                const { data, error } = await sb.from('bancos').select('id, nombre, descripcion, slug').order('nombre');
                if (error) throw error;
                if (data) this.listaBancos = data;
            } catch (e) {
                console.error('Error cargando bancos:', e);
                this.showToast('Error cargando bancos de preguntas', 'error');
                this.listaBancos = [];
            } finally {
                this.cargando = false;
            }
        },

        checkLocalStorage() {
            this.sesionGuardada = !!localStorage.getItem('escalafon_sesion');
        },

        // --- AUTENTICACIÓN ---
        async login() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(this.auth.email)) return this.showToast("Email inválido", 'error');
            if (this.auth.password.length < 6) return this.showToast("Contraseña muy corta", 'error');

            this.cargandoAuth = true;
            const { data, error } = await sb.auth.signInWithPassword({
                email: this.auth.email,
                password: this.auth.password
            });
            this.cargandoAuth = false;

            if (error) {
                this.showToast("Credenciales incorrectas", 'error');
            } else {
                this.auth.user = data.user;
                await this.cargarAtas();
                await this.cargarBancos(); // Carga bancos inmediatamente tras login
                this.vistaActual = 'inicio';
            }
        },

        async loginAnonimo() {
            this.cargandoAuth = true;
            const { data, error } = await sb.auth.signInAnonymously();
            this.cargandoAuth = false;

            if (error) {
                this.showToast("Error al entrar como invitado", 'error');
            } else {
                this.auth.user = data.user;
                await this.cargarAtas();
                await this.cargarBancos(); // Carga bancos inmediatamente tras login anónimo
                this.vistaActual = 'inicio';
                this.showToast("Modo Invitado Activado", 'info');
            }
        },

        async logout() {
            await sb.auth.signOut();
            this.auth.user = null;
            this.session = null;
            this.bancoSeleccionado = null;
            this.preguntas = [];
            ['escalafon_sesion', 'app_banco_actual', 'app_vista'].forEach(k => localStorage.removeItem(k));
            this.vistaActual = 'login';
        },

        async reiniciarProgreso() {
            // 1. Preguntar confirmación (Es una acción destructiva)
            if (!confirm("⚠️ ¿Estás seguro?\n\nEsto reiniciará tu nivel de 'Aspirante' y todas las preguntas volverán a aparecer en el Estudio General.\n\nNo se borrará tu historial de errores, solo tu racha de aciertos.")) {
                return;
            }

            this.vistaActual = 'cargando';
            this.mensajeCarga = 'Reiniciando sistemas...';

            try {
                // CRÍTICO: El RPC ahora borra de 'respuestas' (que es lo que realmente
                // controla la maestría en obtener_general), filtrado por banco activo.
                const { error } = await sb.rpc('reiniciar_progreso', {
                    p_banco_id: this.bancoSeleccionado,
                    p_ata_id: null
                });

                if (error) throw error;

                // Limpiar estado local
                this.preguntas = [];
                this.resetStats();
                
                this.showToast("¡Progreso reiniciado! A empezar de cero.", 'info');
                
                // Recargar datos frescos
                await Promise.all([
                    this.cargarAtas(),
                    this.cargarStatsBanco(this.bancoSeleccionado)
                ]);
                this.vistaActual = 'dashboard';

            } catch (e) {
                console.error(e);
                this.showToast("Error al reiniciar", 'error');
                this.vistaActual = 'dashboard';
            }
        },

        // --- SELECCIÓN DE BANCO ---

        // Navega al dashboard del banco seleccionado cargando sus categorías y estadísticas.
        // Pasa el id explícitamente para no depender de reactividad asíncrona del estado.
        async seleccionarBanco(id) {
            this.cargando = true;
            this.bancoSeleccionado = id;

            localStorage.setItem('app_banco_actual', id);
            localStorage.setItem('app_vista', 'dashboard');

            try {
                await Promise.all([
                    this.cargarAtas(id),
                    this.cargarStatsBanco(id)
                ]);
            } catch (e) { console.error('Error seleccionando banco:', e); }

            this.vistaActual = 'dashboard';
            this.cargando = false;
        },

        cambiarBanco() {
            this.vistaActual = 'inicio';
            this.ataSeleccionado = '';
            localStorage.removeItem('app_banco_actual');
            localStorage.removeItem('app_vista');
        },

        // Inicia el quiz según el modo elegido (general, ata, repaso).
        // Determina la RPC correcta y navega al quiz si hay preguntas disponibles.
        async comenzarQuiz(modo, ataId = null) {
            this.cargando = true;
            this.modoEstudio = modo === 'repaso' ? 'repaso' : 'general';

            if (ataId) this.ataSeleccionado = ataId;

            const entrada = modo === 'repaso' ? 'fallos'
                          : ataId            ? parseInt(ataId)
                          : 'nuevas';

            await this.cargarPreguntas(entrada);

            if (this.preguntas.length > 0) this.vistaActual = 'quiz';
            this.cargando = false;
        },

        // Cancela el quiz activo y regresa al dashboard limpiando el estado del lote.
        volverAlDashboard() {
            this.vistaActual = 'dashboard';
            this.preguntas = [];
            this.indiceActual = 0;
            this.resetStats();
        },



        // --- LÓGICA DEL QUIZ ---
        recuperarSesion() {
            try {
                const saved = JSON.parse(localStorage.getItem('escalafon_sesion'));
                if (saved && saved.preguntas && saved.preguntas.length > 0) {
                    this.preguntas = saved.preguntas;
                    this.indiceActual = saved.indiceActual || 0;
                    this.stats = saved.stats || { correctas: 0, incorrectas: 0, racha: 0 };
                    this.modo = saved.modo || 'general';
                    
                    if (saved.opcionesActuales) {
                        this.opcionesActuales = saved.opcionesActuales;
                    } else {
                        // Retrocompatibilidad para sesiones antiguas
                        this.ordenOpciones = saved.ordenOpciones || ['A','B','C','D'];
                        this.mezclarOpciones();
                    }
                    this.vistaActual = 'quiz';
                } else {
                    this.vistaActual = 'inicio'; // Fallback si no hay preguntas válidas
                }
            } catch (e) { 
                localStorage.removeItem('escalafon_sesion'); 
                this.vistaActual = 'inicio'; 
            }
        },

        // Carga un lote de 25 preguntas desde Supabase según el modo y banco activos.
        // Bifurca entre obtener_general y obtener_repaso según la Doble Validación.
        async cargarPreguntas(entrada) {
            this.vistaActual = 'cargando';
            this.cargando = true;
            this.mensajeCarga = 'Preparando taller...';

            // Validación: asegurar que haya un banco seleccionado antes de llamar al backend
            if (!this.bancoSeleccionado) {
                console.error('No hay banco seleccionado');
                this.showToast('Por favor, selecciona un banco primero', 'error');
                this.vistaActual = 'inicio';
                this.cargando = false;
                return;
            }

            this.modo = (entrada === 'nuevas' || entrada === 'fallos') ? entrada : 'ata';
            this.resetStats();

            try {
                let rpcName, params;

                // Bifurcación por Modo de Estudio (Doble Validación)
                if (this.modoEstudio === 'repaso') {
                    rpcName = 'obtener_repaso';
                    params = {
                        p_banco_id: this.bancoSeleccionado,
                        cantidad: 9999 // Sin límite: traer TODAS las preguntas falladas pendientes
                    };
                } else {
                    rpcName = 'obtener_general';
                    params = {
                        p_banco_id: this.bancoSeleccionado,
                        p_ata_id: null,
                        cantidad: this.cantidadPreguntas
                    };
                    // Si el usuario seleccionó un ATA específico, filtrar por él
                    if (this.modo === 'ata') {
                        params.p_ata_id = parseInt(entrada);
                    }
                }

                const { data, error } = await sb.rpc(rpcName, params);

                if (error) {
                    console.error('Error del backend RPC:', error);
                    throw error;
                }

                // Manejo de resultado vacío: estrategia diferente según el modo
                if (!data || data.length === 0) {
                    if (this.modoEstudio === 'repaso') {
                        // No hay fallos pendientes → auto-switch a modo general
                        alert('¡Excelente! No tienes fallos pendientes.');
                        this.modoEstudio = 'general';
                        return this.cargarPreguntas(entrada);
                    } else {
                        // Modo general vacío → todo el banco está maestrado
                        alert('¡Increíble! Has completado todas las preguntas disponibles. Revisa tus fallos o resetea el progreso.');
                        this.volverAlMenu();
                        return;
                    }
                }

                this.preguntas = data;
                this.indiceActual = 0;
                this.mezclarOpciones(); // Mezclar para la primera pregunta
                this.guardarEstadoLocal();
                this.vistaActual = 'quiz';

            } catch (e) {
                console.error(e);
                this.showToast('Error cargando preguntas', 'error');
                this.volverAlMenu();
            } finally {
                this.cargando = false;
            }
        },

        async responder(letra) {
            if (this.bloqueado) return;
            this.bloqueado = true;
            this.seleccionada = letra;

            // Liberar el foco del botón pulsado para evitar highlight residual
            // en la siguiente pregunta cuando la misma letra aparece en la misma posición (fix móvil).
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }

            // 1. NORMALIZACIÓN Y DIAGNÓSTICO
            const seleccion = String(letra).trim().toUpperCase();
            const correcta = String(this.preguntaActual.correcta).trim().toUpperCase();
            // Soporta respuestas múltiples en BD, ej: "A,B" o "AB"
            const esCorrecta = correcta.includes(seleccion);

            // 2. PERSISTENCIA ROBUSTA: guarda el intento en Supabase de forma no bloqueante.
            // Si la red falla, el quiz continúa sin interrumpir la experiencia del usuario.
            try {
                const uid = this.session?.user?.id || this.auth.user?.id;
                await sb.rpc('guardar_intento', {
                    p_pregunta_id: this.preguntaActual.id,
                    p_es_correcta: esCorrecta,
                    p_modo_estudio: this.modoEstudio,
                    p_user_id: uid
                });
            } catch (e) {
                console.error('Error no bloqueante al guardar respuesta:', e);
            }

            // 3. ACTUALIZACIÓN VISUAL (ESTADO)
            if (esCorrecta) {
                this.stats.correctas++;
                this.stats.racha++;
            } else {
                this.stats.incorrectas++;
                this.stats.racha = 0;
            }

            this.guardarEstadoLocal();

            // 4. NAVEGACIÓN
            if (esCorrecta) {
                setTimeout(() => this.siguientePregunta(), 1000);
            } else {
                this.mostrarSiguiente = true;
            }
        },

        // Navega a la siguiente pregunta del lote (client-side).
        // Resetea estados visuales, aplica fix anti-ghost de imagen y baraja las opciones.
        siguientePregunta() {
            this.bloqueado = false;
            this.seleccionada = null;
            this.mostrarSiguiente = false;
            this.imagenCargada = false; // Ocultar imagen anterior inmediatamente (fix ghost image)

            // Verificar fin de lote ANTES de incrementar para evitar mostrar "Pregunta 26 de 25"
            if (this.indiceActual + 1 >= this.preguntas.length) {
                this.finalizarSesion();
                return;
            }

            this.indiceActual++;

            // Si la siguiente pregunta no tiene imagen, marcar como cargada de inmediato
            if (!this.preguntas[this.indiceActual]?.image_url) {
                this.imagenCargada = true;
            }

            this.mezclarOpciones();
            this.guardarEstadoLocal();
        },

        handleTeclado(e) {
            if (this.vistaActual !== 'quiz') return;
            if (this.mostrarSiguiente && e.key === 'Enter') return this.siguientePregunta();
            if (this.bloqueado) return;

            const key = e.key.toUpperCase();
            if (['A', 'B', 'C', 'D'].includes(key)) this.responder(key);
        },

        // --- UTILIDADES Y AUXILIARES ---

        // Baraja las opciones de la pregunta actual usando el algoritmo Fisher-Yates.
        // Conserva la letra ORIGINAL de la BD (A, B, C, D) para validación directa.
        // Los botones muestran la letra real sin re-mapeo visual para evitar falsos negativos.
        mezclarOpciones(retornar = false) {
            const raw = [
                { letra: 'A', texto: this.preguntaActual.opcion_a },
                { letra: 'B', texto: this.preguntaActual.opcion_b },
                { letra: 'C', texto: this.preguntaActual.opcion_c },
                { letra: 'D', texto: this.preguntaActual.opcion_d }
            ].filter(o => o.texto && o.texto.trim() !== '' && o.texto !== 'null');

            for (let i = raw.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [raw[i], raw[j]] = [raw[j], raw[i]];
            }

            this.opcionesActuales = raw;
            if (retornar) return raw;
        },

        guardarEstadoLocal() {
            localStorage.setItem('escalafon_sesion', JSON.stringify({
                preguntas: this.preguntas,
                indiceActual: this.indiceActual,
                stats: this.stats,
                modo: this.modo,
                ordenOpciones: this.ordenOpciones, // Guardamos el orden actual (retrocompatibilidad)
                opcionesActuales: this.opcionesActuales // Guardamos opciones mezcladas
            }));
        },

        async finalizarSesion() {
            this.cargando = true;
            // 🆕 Cargar stats actualizadas del banco antes de mostrar resultados
            try {
                await this.cargarStatsBanco(this.bancoSeleccionado);
            } catch(e) { console.error('Stats refresh error:', e); }

            this.cargando = false;
            this.vistaActual = 'fin';
            localStorage.removeItem('escalafon_sesion');
            this.sesionGuardada = false;

            if (this.porcentajeAcierto >= 80 && window.confetti) {
                const duration = 3000;
                const end = Date.now() + duration;
                (function frame() {
                    confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 } });
                    confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 } });
                    if (Date.now() < end) requestAnimationFrame(frame);
                }());
            }

            this.$nextTick(() => this.renderChart());
        },

        renderChart() {
            const ctx = document.getElementById('chartResultados');
            if (!ctx || !window.Chart) return;

            if (this.chartInstance) this.chartInstance.destroy();

            this.chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Correctas', 'Incorrectas'],
                    datasets: [{
                        data: [this.stats.correctas, this.stats.incorrectas],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    cutout: '75%',
                    plugins: { legend: { display: false } }
                }
            });
        },

        pausarQuiz() {
            this.guardarEstadoLocal();
            this.sesionGuardada = true;
            this.volverAlMenu();
        },

        volverAlMenu() {
            if (this.vistaActual === 'fin') this.resetStats();
            this.preguntas = [];
            this.vistaActual = 'dashboard';
            this.ataSeleccionado = '';
        },

        resetStats() {
            this.stats = { correctas: 0, incorrectas: 0, racha: 0 };
            this.bloqueado = false;
            this.seleccionada = null;
            this.mostrarSiguiente = false;
        },

        // Calcula las estadísticas de progreso del banco activo:
        //   - totalPreguntasBanco: conteo exacto de preguntas en la BD.
        //   - preguntasMaestradasBanco: total menos (pendientes general + pendientes repaso).
        // Usa cantidad:9999 para obtener todos los registros pendientes sin límite de lote.
        async cargarStatsBanco(bancoId) {
            if (!bancoId) return;
            try {
                // 1. Total de preguntas del banco
                const { count: total, error: errTotal } = await sb
                    .from('preguntas')
                    .select('id', { count: 'exact', head: true })
                    .eq('banco_id', bancoId);

                if (errTotal) throw errTotal;
                this.totalPreguntasBanco = total || 0;

                // 2. Preguntas pendientes en modo general (no dominadas)
                const { data: pendGen, error: errGen } = await sb.rpc('obtener_general', {
                    p_banco_id: bancoId,
                    p_ata_id: null,
                    cantidad: 9999
                });
                if (errGen) throw errGen;

                // 3. Preguntas en cuarentena (falladas aún no liberadas del repaso)
                const { data: pendRep, error: errRep } = await sb.rpc('obtener_repaso', {
                    p_banco_id: bancoId,
                    cantidad: 9999
                });
                if (errRep) throw errRep;

                const cantPendientes = (pendGen?.length || 0) + (pendRep?.length || 0);
                this.preguntasMaestradasBanco = this.totalPreguntasBanco - cantPendientes;

            } catch (e) {
                console.error('Error cargando estadísticas del banco:', e);
            }
        },

        showToast(msg, tipo) {
            this.toast = { visible: true, mensaje: msg, tipo };
            setTimeout(() => this.toast.visible = false, 3000);
        },

        // --- CSS Logic moved to HTML :class directives ---
        // claseBoton() and estiloLetra() removed - see index.html button :class bindings
    }
}


