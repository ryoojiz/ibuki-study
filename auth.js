/**
 * Ibuki Authentication Manager
 * Handles Supabase Auth: Login, Signup, Logout, and Session Tracking.
 */

const auth = {
    async init() {
        // Initialize Supabase Client
        this.supabase = supabase.createClient(
            window.SUPABASE_CONFIG.URL,
            window.SUPABASE_CONFIG.ANON_KEY
        );

        this.setupEventListeners();
        await this.checkSession();
    },

    async checkSession() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            this.showApp();
        } else {
            this.showAuth();
        }
    },

    setupEventListeners() {
        const authForm = document.getElementById('auth-form');
        const submitBtn = document.getElementById('auth-submit-btn');
        const logoutBtn = document.getElementById('btn-logout');

        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const isSignup = submitBtn.textContent === 'Sign Up';

            try {
                let result;
                if (isSignup) {
                    result = await this.supabase.auth.signUp({ email, password });
                } else {
                    result = await this.supabase.auth.signInWithPassword({ email, password });
                }

                if (result.error) throw result.error;

                await this.checkSession();
            } catch (error) {
                this.showError(error.message);
            }
        });

        logoutBtn.addEventListener('click', async () => {
            const { error } = await this.supabase.auth.signOut();
            if (error) alert(error.message);
            await this.checkSession();
        });
    },

    async showApp() {
        document.body.classList.remove('auth-hidden');
        document.getElementById('auth-overlay').classList.add('hidden');
    },

    async showAuth() {
        document.body.classList.add('auth-hidden');
        document.getElementById('auth-overlay').classList.remove('hidden');
    },

    showError(msg) {
        const errEl = document.getElementById('auth-error');
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
        setTimeout(() => errEl.classList.add('hidden'), 5000);
    },

    async getCurrentUser() {
        const { data: { user } } = await this.supabase.auth.getUser();
        return user;
    }
};

// Global function for tab switching in UI
window.switchAuthTab = (tab) => {
    const tabs = document.querySelectorAll('.auth-tab');
    const btn = document.getElementById('auth-submit-btn');

    tabs.forEach(t => t.classList.remove('active'));

    if (tab === 'login') {
        tabs[0].classList.add('active');
        btn.textContent = 'Login';
    } else {
        tabs[1].classList.add('active');
        btn.textContent = 'Sign Up';
    }
};

window.ibukiAuth = auth;