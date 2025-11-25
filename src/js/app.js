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
        bancos: [
            { id: 'b787', nombre: 'Técnico B787', icono: '✈️', descripcion: 'Sistemas y mantenimiento Boeing 787' },
            { id: 'ingles', nombre: 'Inglés Técnico', icono: '🇬🇧', descripcion: 'Terminología aeronáutica en inglés' },
            { id: 'amos', nombre: 'Sistema AMOS', icono: '💻', descripcion: 'Gestión de mantenimiento AMOS' }
        ],

        // --- ESTADO DEL QUIZ ---
        modo: '',
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
            return map[this.modo] || 'Estudio';
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
            const { data } = await sb.from('atas').select('id, nombre').order('id');
            if (data) this.atas = data;
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
        seleccionarBanco(id) {
            this.bancoSeleccionado = id;
            this.vista = 'menu';
            localStorage.setItem('b787_banco_actual', id);
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
            this.vista = 'cargando';
            this.mensajeCarga = 'Preparando taller...';

            // TODO: Filtrar por bancoSeleccionado cuando se implementen tablas separadas
            // const banco = this.bancoSeleccionado;

            this.modo = (entrada === 'nuevas' || entrada === 'fallos') ? entrada : 'ata';
            this.resetStats();

            try {
                let rpc = this.modo === 'fallos' ? 'repasar_falladas' : 'estudiar_preguntas';
                let params = {};

                if (this.modo === 'nuevas') {
                    params = { filtro_ata_id: null };
                } else if (this.modo === 'ata') {
                    const ataIdNumerico = parseInt(entrada);
                    params = { filtro_ata_id: ataIdNumerico };
                }

                const { data, error } = await sb.rpc(rpc, params);

                if (error) throw error;

                if (!data || data.length === 0) {
                    this.showToast('¡Todo al día! No hay preguntas pendientes.', 'info');
                    this.volverAlMenu();
                    return;
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

            // --- DIAGNÓSTICO: INTENTO DE GUARDADO ---
            console.log("📡 Intentando guardar en DB:", {
                pregunta_id: this.preguntaActual.id,
                es_correcta: esCorrecta,
                usuario: this.auth.user?.id,
                visual: letraVisual,
                real: letraReal
            });

            const { data, error } = await sb.rpc('registrar_respuesta', {
                p_pregunta_id: this.preguntaActual.id,
                es_correcta: esCorrecta
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

        // --- CLASES CSS DINÁMICAS ---
        claseBoton(letraVisual) {
            // Estado Normal: Fondo blanco, borde gris
            if (!this.bloqueado) return 'bg-white border-gray-200 shadow-sm hover:border-blue-500 hover:shadow-md cursor-pointer';

            // Traducir Visual -> Real para comparar con la respuesta correcta
            const indiceVisual = ['A', 'B', 'C', 'D'].indexOf(letraVisual);
            const letraReal = this.ordenOpciones[indiceVisual];

            const correcta = this.preguntaActual.correcta?.toUpperCase();
            const seleccionadaVisual = this.seleccionada; // La letra visual que clickeó el usuario
            
            // Para saber si ESTE botón visual corresponde a la respuesta correcta:
            // ¿La letra real detrás de este botón es la correcta?
            const esEsteBotonCorrecto = (letraReal === correcta);

            // Para saber si ESTE botón visual fue el seleccionado incorrectamente:
            // ¿Fue este el botón visual clickeado? Y ¿No era el correcto?
            const esEsteBotonSeleccionado = (letraVisual === seleccionadaVisual);

            // Respuesta Correcta (Siempre se ilumina en verde, haya sido clickeada o no)
            if (esEsteBotonCorrecto)
                return 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500';

            // Selección Incorrecta (Se ilumina en rojo si el usuario clickeó este)
            if (esEsteBotonSeleccionado && !esEsteBotonCorrecto)
                return 'bg-red-50 border-red-500 text-red-700 shake ring-1 ring-red-500';

            // Resto: Desvanecido
            return 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed';
        },

        estiloLetra(letraVisual) {
            // Traducir Visual -> Real
            const indiceVisual = ['A', 'B', 'C', 'D'].indexOf(letraVisual);
            const letraReal = this.ordenOpciones[indiceVisual];
            const correcta = this.preguntaActual.correcta?.toUpperCase();

            if (this.bloqueado) {
                if (letraReal === correcta) return 'bg-emerald-600 text-white';
                if (letraVisual === this.seleccionada) return 'bg-red-600 text-white';
                return 'bg-gray-200 text-gray-400';
            }
            // Estado Normal
            return 'bg-gray-100 text-gray-500 group-hover:bg-blue-600 group-hover:text-white';
        }
    }
}
