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
        vista: 'cargando',
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
        preguntas: [],
        indiceActual: 0,
        bloqueado: false,
        seleccionada: null, // Letra VISUAL seleccionada (A, B, C, D)
        ordenOpciones: ['A', 'B', 'C', 'D'], // Mapeo: Posición Visual -> Letra Real en DB
        mostrarSiguiente: false,
        sesionGuardada: false,
        stats: { correctas: 0, incorrectas: 0, racha: 0 },

        // --- UX / UI ---
        toast: { visible: false, mensaje: '', tipo: 'info' },
        chartInstance: null,

        // --- GETTERS COMPUTADOS ---
        get preguntaActual() {
            return this.preguntas[this.indiceActual];
        },
        get modoTexto() {
            const map = { 'nuevas': 'Estudio General', 'ata': 'Por Categoría', 'fallos': 'Repaso de Fallos' };
            const modoDisplay = this.modoEstudio === 'repaso' ? ' (Repaso)' : ' (General)';
            return (map[this.modo] || 'Estudio') + modoDisplay;
        },
        get progresoPorcentaje() {
            return this.preguntas.length ? ((this.indiceActual + 1) / this.preguntas.length) * 100 : 0;
        },
        get porcentajeAcierto() {
            const total = this.stats.correctas + this.stats.incorrectas;
            return total === 0 ? 0 : Math.round((this.stats.correctas / total) * 100);
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
            this.checkLocalStorage();

            // ============================================================
            // 🚧 MODO DESARROLLO (LIMPIEZA DE CACHÉ)
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for(let registration of registrations) {
                        registration.unregister();
                        console.log('🧹 Service Worker eliminado: Modo Desarrollo Activo');
                    }
                });
            }
            // ============================================================

            try {
                const { data } = await sb.auth.getSession();
                if (data.session) {
                    this.auth.user = data.session.user;
                    await this.cargarAtas();
                    await this.cargarBancos(); // 🆕 Load banks from database
                    // Restaurar banco si existe
                    const bancoGuardado = localStorage.getItem('b787_banco_actual');
                    if (bancoGuardado) {
                        this.bancoSeleccionado = bancoGuardado;
                        this.vista = 'menu';
                    } else {
                        this.vista = 'seleccion_banco';
                    }
                } else {
                    this.vista = 'login';
                }
            } catch (e) {
                this.showToast("Modo Offline / Error de Red", 'error');
                this.vista = 'login';
            }
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
                this.vista = 'seleccion_banco';
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
                this.vista = 'seleccion_banco';
                this.showToast("Modo Invitado Activado", 'info');
            }
        },

        async logout() {
            await sb.auth.signOut();
            this.auth.user = null;
            localStorage.removeItem('b787_sesion');
            localStorage.removeItem('b787_banco_actual');
            this.vista = 'login';
        },

        async reiniciarProgreso() {
            // 1. Preguntar confirmación (Es una acción destructiva)
            if (!confirm("⚠️ ¿Estás seguro?\n\nEsto reiniciará tu nivel de 'Aspirante' y todas las preguntas volverán a aparecer en el Estudio General.\n\nNo se borrará tu historial de errores, solo tu racha de aciertos.")) {
                return;
            }

            this.vista = 'cargando';
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
                this.vista = 'menu';

            } catch (e) {
                console.error(e);
                this.showToast("Error al reiniciar", 'error');
                this.vista = 'menu';
            }
        },

        // --- SELECCIÓN DE BANCO ---
async seleccionarBanco(id) {
    console.log('👆 Click en Banco ID:', id);
    
    // 1. Actualizar Estado
    this.bancoSeleccionado = id;
    this.ataSeleccionado = ''; // Reset ATA al cambiar banco
    this.preguntas = []; // Limpiar preguntas viejas visualmente
    localStorage.setItem('b787_banco_actual', id);
    
    // 2. Cargar Dependencias (NO BLOQUEANTE)
    console.log('📊 Intentando cargar ATAs para banco:', id);
    try {
        await this.cargarAtas();
    } catch (error) {
        console.error('⚠️ Error no bloqueante cargando ATAs:', error);
        // Continuar igualmente - ATAs son opcionales para modo general
    }
    
    // 3. Navegar al Menú
    this.vista = 'menu';
    
    // 4. 🎯 CRÍTICO: Cargar preguntas automáticamente en modo general
    console.log('🚀 Auto-cargando preguntas en modo:', this.modoEstudio);
    try {
        await this.cargarPreguntas('nuevas');
    } catch (error) {
        console.error('❌ Error cargando preguntas iniciales:', error);
        // El usuario puede reintentar manualmente desde el menú
    }
},

        cambiarBanco() {
            this.vista = 'seleccion_banco';
            this.ataSeleccionado = '';
        },

        // --- LÓGICA DEL QUIZ ---
        recuperarSesion() {
            try {
                const saved = JSON.parse(localStorage.getItem('b787_sesion'));
                if (saved) {
                    this.preguntas = saved.preguntas;
                    this.indiceActual = saved.indiceActual;
                    this.stats = saved.stats;
                    this.modo = saved.modo;
                    // Recuperar el orden de opciones guardado o generar uno nuevo si no existe (retrocompatibilidad)
                    this.ordenOpciones = saved.ordenOpciones || this.mezclarOpciones(true); 
                    this.vista = 'quiz';
                }
            } catch (e) { localStorage.removeItem('b787_sesion'); }
        },

        async cargarPreguntas(entrada) {
            console.log('--- 🎯 INTENTO DE CARGA DE PREGUNTAS ---');
            console.log('Estado actual:', { 
                bancoSeleccionado: this.bancoSeleccionado,
                modoEstudio: this.modoEstudio,
                entrada: entrada,
                modo: this.modo
            });

            this.vista = 'cargando';
            this.mensajeCarga = 'Preparando taller...';

            // 🛡️ VALIDATION: Ensure a bank is selected
            if (!this.bancoSeleccionado) {
                console.error('❌ No hay banco seleccionado');
                this.showToast('Por favor, selecciona un banco primero', 'error');
                this.vista = 'seleccion_banco';
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
                        cantidad: 1 
                    };
                } else {
                    // CASO 2: Modo General - Usar obtener_general
                    rpcName = 'obtener_general';
                    params = { 
                        p_banco_id: this.bancoSeleccionado,
                        p_ata_id: null, // Can be set for ATA filtering
                        cantidad: 1 
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
                this.vista = 'quiz';

            } catch (e) {
                console.error(e);
                this.showToast('Error cargando preguntas', 'error');
                this.volverAlMenu();
            }
        },

        async responder(letraVisual) {
            if (this.bloqueado) return;
            this.bloqueado = true;
            this.seleccionada = letraVisual;

            // TRADUCCIÓN: Letra Visual (Botón Clickeado) -> Letra Real (DB)
            // Ejemplo: Si ordenOpciones es ['C', 'A', 'D', 'B']
            // Click en botón 0 ('A') -> Real 'C'
            const indiceVisual = ['A', 'B', 'C', 'D'].indexOf(letraVisual);
            const letraReal = this.ordenOpciones[indiceVisual];

            const esCorrecta = letraReal === this.preguntaActual.correcta;

            // --- ACTUALIZACIÓN VISUAL ---
            if (esCorrecta) {
                this.stats.correctas++;
                this.stats.racha++;
            } else {
                this.stats.incorrectas++;
                this.stats.racha = 0;
            }

            // --- GUARDADO CON DOBLE VALIDACIÓN ---
            console.log("📡 Guardando respuesta en DB:", {
                pregunta_id: this.preguntaActual.id,
                es_correcta: esCorrecta,
                modo_estudio: this.modoEstudio,
                usuario: this.auth.user?.id,
                visual: letraVisual,
                real: letraReal
            });

            const { data, error } = await sb.rpc('guardar_respuesta', {
                p_pregunta_id: this.preguntaActual.id,
                p_es_correcta: esCorrecta,
                p_modo_estudio: this.modoEstudio // 🎯 KEY: Envía el modo de estudio
            });

            if (error) {
                console.error("❌ ERROR FATAL DE SUPABASE:", error);
                this.showToast("Error guardando progreso: " + error.message, 'error');
            } else {
                console.log("✅ Guardado exitoso en Supabase");
            }
            // ------------------------------------------

            this.guardarEstadoLocal();

            if (esCorrecta) {
                setTimeout(() => this.siguientePregunta(), 1000);
            } else {
                this.mostrarSiguiente = true;
            }
        },

        siguientePregunta() {
            if (this.indiceActual < this.preguntas.length - 1) {
                this.indiceActual++;
                this.bloqueado = false;
                this.seleccionada = null;
                this.mostrarSiguiente = false;
                this.mezclarOpciones(); // Mezclar para la siguiente
                this.guardarEstadoLocal();
            } else {
                this.finalizarSesion();
            }
        },

        handleTeclado(e) {
            if (this.vista !== 'quiz') return;
            if (this.mostrarSiguiente && e.key === 'Enter') return this.siguientePregunta();
            if (this.bloqueado) return;

            const key = e.key.toUpperCase();
            if (['A', 'B', 'C', 'D'].includes(key)) this.responder(key);
        },

        // --- UTILIDADES Y AUXILIARES ---
        mezclarOpciones(retornar = false) {
            // Algoritmo Fisher-Yates para mezclar ['A', 'B', 'C', 'D']
            const opciones = ['A', 'B', 'C', 'D'];
            for (let i = opciones.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [opciones[i], opciones[j]] = [opciones[j], opciones[i]];
            }
            
            if (retornar) return opciones;
            this.ordenOpciones = opciones;
        },

        guardarEstadoLocal() {
            localStorage.setItem('b787_sesion', JSON.stringify({
                preguntas: this.preguntas,
                indiceActual: this.indiceActual,
                stats: this.stats,
                modo: this.modo,
                ordenOpciones: this.ordenOpciones // Guardamos el orden actual
            }));
        },

        finalizarSesion() {
            this.vista = 'fin';
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
            if (this.vista === 'fin') this.resetStats();
            this.preguntas = [];
            this.vista = 'menu';
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
