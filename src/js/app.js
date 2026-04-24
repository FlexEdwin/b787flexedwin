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
        vistaActual: 'cargando', // 🆕 BATCH LOADING: 'cargando' | 'login' | 'inicio' | 'dashboard' | 'quiz' | 'fin'
        cargando: false, // 🆕 STATE: Global loading indicator
        mensajeCarga: 'Iniciando sistemas...',
        auth: { email: '', password: '', user: null },
        cargandoAuth: false,
        atas: [],
        ataSeleccionado: '',

        // --- BANCOS DE PREGUNTAS ---
        bancoSeleccionado: null,
        listaBancos: [], // Populated from database via cargarBancos()


        // --- ESTADO DEL QUIZ ---
        modo: '',
        modoEstudio: 'general', // 'general' o 'repaso' - Double Validation Logic
        preguntas: [], // 🆕 BATCH: Array de 50 preguntas
        indiceActual: 0, // 🆕 BATCH: Índice dentro del lote (0-49)
        bloqueado: false,
        seleccionada: null, // Letra VISUAL seleccionada (A, B, C, D)
        ordenOpciones: ['A', 'B', 'C', 'D'], // Mapeo: Posición Visual -> Letra Real en DB
        opcionesActuales: [], // 🆕 STATE: Opciones mezcladas estáticas para evitar re-render
        mostrarSiguiente: false,
        sesionGuardada: false,
        stats: { correctas: 0, incorrectas: 0, racha: 0 },

        // --- UX / UI ---
        toast: { visible: false, mensaje: '', tipo: 'info' },
        chartInstance: null,

        // --- GETTERS COMPUTADOS ---
        get preguntaActual() {
            return this.preguntas[this.indiceActual]; // 🆕 BATCH: Getter dinámico
        },
        get modoTexto() {
            const map = { 'nuevas': 'Estudio General', 'ata': 'Por Categoría', 'fallos': 'Repaso de Fallos' };
            const modoDisplay = this.modoEstudio === 'repaso' ? ' (Repaso)' : ' (General)';
            return (map[this.modo] || 'Estudio') + modoDisplay;
        },
        get progresoLote() {// 🆕 BATCH: Progreso del lote actual
            if (!this.preguntas.length) return 'Sin preguntas';
            return `Pregunta ${this.indiceActual + 1} de ${this.preguntas.length}`;
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

        // --- CICLO DE VIDA ---
        async initApp() {
            console.log("� Iniciando App...");
            this.checkLocalStorage();

            // 1. Verificar Sesión
            const { data: { session } } = await sb.auth.getSession();
            
            if (session) {
                console.log("✅ Usuario detectado. Cargando datos...");
                this.session = session; // 🆕 SESSION FIX
                this.auth.user = session.user; // Redundancia
                this.cargando = true; // Show spinner while loading initial data
                try {
                    await this.cargarAtas();
                    await this.cargarBancos();
                    
                    // Restaurar sesión persistente
                    const bancoGuardado = localStorage.getItem('app_banco_actual');
                    const vistaGuardada = localStorage.getItem('app_vista');
                    
                    if (bancoGuardado && this.session) {
                        console.log("♻️ Restaurando sesión anterior...");
                        await this.cargarBancos(); // Asegura que existan los bancos primero
                        this.bancoSeleccionado = bancoGuardado;
                        await this.cargarAtas(); // Carga dependencias
                        
                        if (vistaGuardada === 'dashboard') {
                            this.vistaActual = 'dashboard';
                        } else if (vistaGuardada === 'quiz') {
                            this.recuperarSesion();
                        } else {
                            this.vistaActual = 'inicio';
                        }
                    } else {
                        // Lógica normal de inicio
                        await this.cargarBancos();
                    }
                } catch (e) {
                    console.error("Error cargando datos iniciales:", e);
                } finally {
                    this.cargando = false;
                }
            } else {
                console.log("👻 Usuario anónimo o no logueado");
                this.vistaActual = 'login';
            }
            
            // Escuchar cambios de auth (Logout/Login/Token Refresh)
            sb.auth.onAuthStateChange(async (event, session) => {
                console.log("🔄 Auth Change:", event);

                if (event === 'SIGNED_IN' && session) {
                    // ✅ FIX v1.2: Distinguir login real de refresco de token.
                    // Si el usuario YA estaba autenticado (auth.user existe),
                    // este SIGNED_IN es un refresco automático del JWT → NO redirigir.
                    const esLoginReal = !this.auth.user;

                    // Siempre actualizar la sesión en memoria para que los RPCs
                    // sigan funcionando con el token renovado.
                    this.auth.user = session.user;
                    this.session = session; // ← clave: mantener sesión actualizada

                    if (esLoginReal) {
                        // Login genuino: navegar a inicio y cargar datos
                        console.log("✅ Login real detectado → navegando a inicio.");
                        this.vistaActual = 'inicio';
                        await this.cargarBancos();
                        await this.cargarAtas();
                    } else {
                        // Refresco de token silencioso: NO interrumpir al usuario
                        console.log("🔄 Token renovado silenciosamente — sesión preservada, no se redirige.");
                    }

                } else if (event === 'TOKEN_REFRESHED' && session) {
                    // Supabase también dispara TOKEN_REFRESHED en algunos flujos.
                    // Solo actualizar la sesión en memoria, nunca redirigir.
                    this.auth.user = session.user;
                    this.session = session;
                    console.log("🔄 TOKEN_REFRESHED → sesión actualizada silenciosamente.");

                } else if (event === 'SIGNED_OUT') {
                    this.auth.user = null;
                    this.session = null;
                    this.vistaActual = 'login';
                }
            });
        },

        // --- GESTIÓN DE DATOS ---
async cargarAtas() {
    try {
        const { data, error } = await sb.from('atas').select('id, nombre').order('id');
        
        if (error) {
            console.error('⚠️ Error cargando ATAs:', error);
            this.atas = []; // Fallback a array vacío
            return;
        }
        
        // 🛡️ Protección contra data null/undefined
        if (data && Array.isArray(data)) {
            this.atas = data;
            console.log('✅ ATAs cargados:', data.length);
        } else {
            this.atas = [];
            console.warn('⚠️ No se recibieron ATAs del backend');
        }
    } catch (e) {
        console.error('❌ Error fatal cargando ATAs:', e);
        this.atas = []; // Siempre tener un array válido
    }
},

        async cargarBancos() {
            this.cargando = true;
            try {
                const { data, error } = await sb.from('bancos').select('id, nombre, descripcion, slug').order('nombre');
                if (error) throw error;
                if (data) {
                    this.listaBancos = data;
                    console.log('✅ Bancos cargados:', data.length);
                }
            } catch (e) {
                console.error('❌ Error cargando bancos:', e);
                this.showToast('Error cargando bancos de preguntas', 'error');
                this.listaBancos = []; // Fallback to empty array
            } finally {
                this.cargando = false;
            }
        },

        checkLocalStorage() {
            this.sesionGuardada = !!localStorage.getItem('b787_sesion');
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
                await this.cargarBancos(); // 🐛 FIX: Load banks immediately after login
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
                await this.cargarBancos(); // 🐛 FIX: Load banks immediately after login
                this.vistaActual = 'inicio';
                this.showToast("Modo Invitado Activado", 'info');
            }
        },

        async logout() {
            await sb.auth.signOut();
            this.auth.user = null;
            localStorage.removeItem('b787_sesion');
            localStorage.removeItem('b787_sesion');
            localStorage.removeItem('app_banco_actual');
            localStorage.removeItem('app_vista');
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
                // Llamada al RPC. Si quieres resetear solo un ATA, pasarías { p_ata_id: 29 }
                const { error } = await sb.rpc('reiniciar_progreso', { p_ata_id: null });

                if (error) throw error;

                // Limpiar estado local
                this.preguntas = [];
                this.resetStats();
                
                this.showToast("¡Progreso reiniciado! A empezar de cero.", 'info');
                
                // Recargar datos frescos
                await this.cargarAtas(); 
                this.vistaActual = 'dashboard';

            } catch (e) {
                console.error(e);
                this.showToast("Error al reiniciar", 'error');
                this.vistaActual = 'dashboard';
            }
        },

        // --- SELECCIÓN DE BANCO ---
    async seleccionarBanco(id) {
        console.log("📍 FORZANDO VISTA DASHBOARD para banco:", id);
        this.cargando = true;
        this.bancoSeleccionado = id;
        
        // Persistencia
        localStorage.setItem('app_banco_actual', id);
        localStorage.setItem('app_vista', 'dashboard');

        try {
            await this.cargarAtas();
        } catch (e) { console.error(e); }

        // AQUÍ ESTÁ LA CLAVE: Asignación directa sin condiciones
        this.vistaActual = 'dashboard'; 
        
        this.cargando = false;
        console.log("✅ Vista actual es ahora:", this.vistaActual);
    },

        cambiarBanco() {
            this.vistaActual = 'inicio';
            this.ataSeleccionado = '';
            localStorage.removeItem('app_banco_actual');
            localStorage.removeItem('app_vista');
        },

// 🆕 BATCH: Nueva función para iniciar quiz con configuración
async comenzarQuiz(modo, ataId = null) {
    console.log('🎬 Iniciando quiz:', { modo, ataId });
    this.cargando = true;
    
    // Setup mode
    this.modoEstudio = modo === 'repaso' ? 'repaso' : 'general';
    
    // Setup ATA filter if provided
    if (ataId) {
        this.ataSeleccionado = ataId;
    }
    
    // Load batch (mode determines which RPC to call)
    const entrada = modo === 'repaso' ? 'fallos' : 
                    ataId ? parseInt(ataId) : 'nuevas';
    
    await this.cargarPreguntas(entrada);
    
    // Navigate to quiz if questions were loaded
    if (this.preguntas.length > 0) {
        this.vistaActual = 'quiz';
        console.log('✅ Quiz iniciado con', this.preguntas.length, 'preguntas');
    }
    this.cargando = false;
},

// 🆕 BATCH: Función para volver al dashboard
volverAlDashboard() {
    console.log('🔙 Volviendo al dashboard');
    this.vistaActual = 'dashboard';
    this.preguntas = [];
    this.indiceActual = 0;
    this.resetStats();
},



        // --- LÓGICA DEL QUIZ ---
        recuperarSesion() {
            try {
                const saved = JSON.parse(localStorage.getItem('b787_sesion'));
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
                localStorage.removeItem('b787_sesion'); 
                this.vistaActual = 'inicio'; 
            }
        },

        async cargarPreguntas(entrada) {
            console.log('--- 🎯 INTENTO DE CARGA DE PREGUNTAS ---');
            console.log('Estado actual:', { 
                bancoSeleccionado: this.bancoSeleccionado,
                modoEstudio: this.modoEstudio,
                entrada: entrada,
                modo: this.modo
            });

            this.vistaActual = 'cargando';
            this.cargando = true;
            this.mensajeCarga = 'Preparando taller...';

            // 🛡️ VALIDATION: Ensure a bank is selected
            if (!this.bancoSeleccionado) {
                console.error('❌ No hay banco seleccionado');
                this.showToast('Por favor, selecciona un banco primero', 'error');
                this.showToast('Por favor, selecciona un banco primero', 'error');
                this.vistaActual = 'inicio';
                this.cargando = false;
                return;
            }

            this.modo = (entrada === 'nuevas' || entrada === 'fallos') ? entrada : 'ata';
            this.resetStats();

            try {
                let rpcName, params;

                // 🎯 DOBLE VALIDACIÓN: Bifurcación por Modo de Estudio
        if (this.modoEstudio === 'repaso') {
            // CASO 1: Modo Repaso - Usar obtener_repaso
            rpcName = 'obtener_repaso';
            params = { 
                p_banco_id: this.bancoSeleccionado,
                cantidad: 50 // 🆕 BATCH: 50 preguntas por lote
            };
        } else {
            // CASO 2: Modo General - Usar obtener_general
            rpcName = 'obtener_general';
            params = { 
                p_banco_id: this.bancoSeleccionado,
                p_ata_id: null, // Can be set for ATA filtering
                cantidad: 50 // 🆕 BATCH: 50 preguntas por lote
            };

                    // Si el usuario seleccionó un ATA específico
                    if (this.modo === 'ata') {
                        params.p_ata_id = parseInt(entrada);
                    }
                }

                console.log('📡 Enviando a RPC:', rpcName);
                console.log('📦 Parámetros:', JSON.stringify(params, null, 2));
                
                const { data, error } = await sb.rpc(rpcName, params);

                console.log('📥 Recibido del RPC:', { 
                    data: data, 
                    cantidad: data?.length || 0,
                    error: error 
                });

                if (error) {
                    console.error('❌ Error del backend:', error);
                    throw error;
                }

                // 🚫 MANEJO DE VACÍO: Diferentes estrategias según el modo
                if (!data || data.length === 0) {
                    if (this.modoEstudio === 'repaso') {
                        // No hay fallos pendientes - AUTO-SWITCH a modo general
                        alert('¡Excelente! No tienes fallos pendientes.');
                        this.modoEstudio = 'general';
                        // Reintentar en modo general
                        return this.cargarPreguntas(entrada);
                    } else {
                        // Modo general vacío - Todo maestrado
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

            // 1. NORMALIZACIÓN Y DIAGNÓSTICO
            const seleccion = String(letra).trim().toUpperCase();
            const correcta = String(this.preguntaActual.correcta).trim().toUpperCase();
            const esCorrecta = seleccion === correcta;

            console.log('🔍 Validando:', { 
                seleccion: seleccion, 
                correctaDB: correcta, 
                esCorrecta: esCorrecta,
                preguntaID: this.preguntaActual.id
            });

            // 💾 2. PERSISTENCIA ROBUSTA (Fall-safes)
            try {
                const uid = this.session?.user?.id || this.auth.user?.id; // 🆕 USER UNDEFINED FIX
                
                // Intentamos guardar, pero si falla no detenemos el quiz
                await sb.rpc('guardar_intento', {
                    p_pregunta_id: this.preguntaActual.id,
                    p_es_correcta: esCorrecta,
                    p_modo_estudio: this.modoEstudio,
                    p_user_id: uid 
                });
                console.log('💾 Respuesta guardada en DB');
            } catch (e) {
                console.error('⚠️ Error no bloqueante guardando respuesta:', e);
                // RPC Error 404/500 ignorado para continuidad del usuario
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

        // 🆕 BATCH: Navegación dentro del lote (client-side)
        siguientePregunta() {
            // Reset visual states
            this.bloqueado = false;
            this.seleccionada = null;
            this.mostrarSiguiente = false;
            
            // Navigate to next question
            this.indiceActual++;
            
            // 🎯 Check if batch is complete
            if (this.indiceActual >= this.preguntas.length) {
                const stats = `¡Lote completado!\n\nHas respondido ${this.preguntas.length} preguntas.\n\n✅ Correctas: ${this.stats.correctas}\n❌ Incorrectas: ${this.stats.incorrectas}\n🎯 Racha: ${this.stats.racha}`;
                alert(stats);
                this.volverAlDashboard();
                return;
            }
            
            // Shuffle options for next question
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
        mezclarOpciones(retornar = false) {
            // 1. Obtener opciones crudas FILTRANDO VACÍAS
            // IMPORTANTE: Mantenemos la letra ORIGINAL de la DB (A,B,C,D)
            const raw = [
                { letra: 'A', texto: this.preguntaActual.opcion_a },
                { letra: 'B', texto: this.preguntaActual.opcion_b },
                { letra: 'C', texto: this.preguntaActual.opcion_c },
                { letra: 'D', texto: this.preguntaActual.opcion_d }
            ].filter(o => o.texto && o.texto.trim() !== '' && o.texto !== 'null');

            // 2. Barajar directamente el array de objetos
            for (let i = raw.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [raw[i], raw[j]] = [raw[j], raw[i]];
            }
            
            // 3. Asignar directamente (Sin re-mapeo visual A,B,C,D)
            // Esto significa que los botones mostrarán su letra real (ej: C, A, B)
            this.opcionesActuales = raw;

            if (retornar) return raw;
        },

        guardarEstadoLocal() {
            localStorage.setItem('b787_sesion', JSON.stringify({
                preguntas: this.preguntas,
                indiceActual: this.indiceActual,
                stats: this.stats,
                modo: this.modo,
                ordenOpciones: this.ordenOpciones, // Guardamos el orden actual (retrocompatibilidad)
                opcionesActuales: this.opcionesActuales // Guardamos opciones mezcladas
            }));
        },

        finalizarSesion() {
            this.vistaActual = 'fin';
            localStorage.removeItem('b787_sesion');
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

        showToast(msg, tipo) {
            this.toast = { visible: true, mensaje: msg, tipo };
            setTimeout(() => this.toast.visible = false, 3000);
        },

        obtenerTextoOpcion(letraVisual) {
            if (!this.preguntaActual) return '';
            // Traducir Visual -> Real
            const indiceVisual = ['A', 'B', 'C', 'D'].indexOf(letraVisual);
            const letraReal = this.ordenOpciones[indiceVisual];
            return this.preguntaActual['opcion_' + letraReal.toLowerCase()];
        },

        // --- CSS Logic moved to HTML :class directives ---
        // claseBoton() and estiloLetra() removed - see index.html button :class bindings
    }
}


