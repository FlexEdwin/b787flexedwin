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

        // --- ESTADO DEL QUIZ ---
        modo: '',
        preguntas: [],
        indiceActual: 0,
        bloqueado: false,
        seleccionada: null,
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
            if (score < 10) return 'Trainee';
            if (score < 50) return 'Certified Tech';
            return 'Senior Inspector';
        },

        // --- CICLO DE VIDA ---
        async initApp() {
            this.checkLocalStorage();

            // ⚠️ DEVELOPMENT MODE: Service Worker DISABLED to prevent caching
            // This ensures you see live code updates immediately during development
            // TO RE-ENABLE FOR PRODUCTION: Uncomment the lines below
            
            // Unregister any existing Service Workers
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(registration => registration.unregister());
                });
            }

            // Registro PWA (Si existe el archivo sw.js en la raíz)
            // if ('serviceWorker' in navigator) {
            //     navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Error:', err));
            // }

            try {
                const { data } = await sb.auth.getSession();
                if (data.session) {
                    this.auth.user = data.session.user;
                    await this.cargarAtas();
                    this.vista = 'menu';
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
                this.vista = 'menu';
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
                this.vista = 'menu';
                this.showToast("Modo Invitado Activado", 'info');
            }
        },

        async logout() {
            await sb.auth.signOut();
            this.auth.user = null;
            localStorage.removeItem('b787_sesion');
            this.vista = 'login';
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
                    this.vista = 'quiz';
                }
            } catch (e) { localStorage.removeItem('b787_sesion'); }
        },

        async cargarPreguntas(entrada) {
            this.vista = 'cargando';
            this.mensajeCarga = 'Descargando datos de vuelo...';

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
                this.guardarEstadoLocal();
                this.vista = 'quiz';

            } catch (e) {
                console.error(e);
                this.showToast('Error cargando preguntas', 'error');
                this.volverAlMenu();
            }
        },

        async responder(letra) {
            if (this.bloqueado) return;
            this.bloqueado = true;
            this.seleccionada = letra;

            const esCorrecta = letra === this.preguntaActual.correcta;

            if (esCorrecta) {
                this.stats.correctas++;
                this.stats.racha++;
                // Confetti cada 5 aciertos seguidos
                if (this.stats.racha > 0 && this.stats.racha % 5 === 0) {
                    if (window.confetti) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                }
            } else {
                this.stats.incorrectas++;
                this.stats.racha = 0;
                if (navigator.vibrate) navigator.vibrate(200);
            }

            // Envío a Supabase (Optimistic UI)
            sb.rpc('registrar_respuesta', {
                p_pregunta_id: this.preguntaActual.id,
                es_correcta: esCorrecta
            });

            this.guardarEstadoLocal();

            // Lógica de avance híbrida
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
        guardarEstadoLocal() {
            localStorage.setItem('b787_sesion', JSON.stringify({
                preguntas: this.preguntas,
                indiceActual: this.indiceActual,
                stats: this.stats,
                modo: this.modo
            }));
        },

        finalizarSesion() {
            this.vista = 'fin';
            localStorage.removeItem('b787_sesion');
            this.sesionGuardada = false;

            // Confetti final si aprobó
            if (this.porcentajeAcierto >= 80 && window.confetti) {
                const duration = 3000;
                const end = Date.now() + duration;
                (function frame() {
                    confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 } });
                    confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 } });
                    if (Date.now() < end) requestAnimationFrame(frame);
                }());
            }

            // Renderizar Gráfico
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

        obtenerTextoOpcion(letra) {
            return this.preguntaActual ? this.preguntaActual['opcion_' + letra.toLowerCase()] : '';
        },

        // --- CLASES CSS DINÁMICAS ---
        claseBoton(letra) {
            if (!this.bloqueado) return 'border-slate-700 bg-slate-800/50 hover:bg-slate-700 hover:border-blue-500 hover:ring-1 hover:ring-blue-500 cursor-pointer';

            if (letra === this.preguntaActual.correcta)
                return 'bg-emerald-500/10 border-emerald-500 text-emerald-400 ring-1 ring-emerald-500';

            if (letra === this.seleccionada && letra !== this.preguntaActual.correcta)
                return 'bg-red-500/10 border-red-500 text-red-400 shake ring-1 ring-red-500';

            return 'border-slate-800 opacity-30 cursor-not-allowed';
        },

        estiloLetra(letra) {
            if (this.bloqueado) {
                if (letra === this.preguntaActual.correcta) return 'bg-emerald-500 text-slate-900';
                if (letra === this.seleccionada) return 'bg-red-500 text-white';
                return 'bg-slate-700 text-slate-500';
            }
            return 'bg-slate-700 text-slate-400 group-hover:bg-blue-500 group-hover:text-white';
        }
    }
}