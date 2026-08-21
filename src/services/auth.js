import { supabase } from './supabase'

export const authService = {
    async checkSession() {
        const { data: { session } } = await supabase.auth.getSession()
        return session
    },

    async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        return data
    },

    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        return data
    },

    async signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        })
        if (error) throw error
        return data
    },

    async signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    },

    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser()
        return user
    }
}