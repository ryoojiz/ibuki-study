import { supabase } from './supabase'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'

const ANDROID_AUTH_CALLBACK = 'com.ibuki.study://auth/callback'
const ANDROID_RESET_CALLBACK = 'com.ibuki.study://auth/reset'

function configuredWebOrigin() {
    const configured = String(import.meta.env.VITE_SITE_URL || '').trim().replace(/\/$/, '')
    return configured || window.location.origin
}

function oauthRedirectUrl() {
    return Capacitor.isNativePlatform()
        ? ANDROID_AUTH_CALLBACK
        : `${configuredWebOrigin()}/auth/callback`
}

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
        const native = Capacitor.isNativePlatform()
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: oauthRedirectUrl(),
                skipBrowserRedirect: native
            }
        })
        if (error) throw error
        if (native) {
            if (!data?.url) throw new Error('Google sign-in did not return an authorization URL')
            await Browser.open({ url: data.url })
        }
        return data
    },

    async initializeNativeOAuth({ onAuthenticated, onPasswordRecovery, onError } = {}) {
        if (!Capacitor.isNativePlatform()) return null
        let lastHandledUrl = null

        const handleUrl = async (url) => {
            if (!url?.startsWith('com.ibuki.study://auth/') || url === lastHandledUrl) return
            lastHandledUrl = url
            try {
                const callback = new URL(url)
                const providerError = callback.searchParams.get('error_description') || callback.searchParams.get('error')
                if (providerError) throw new Error(providerError)
                const code = callback.searchParams.get('code')
                if (!code) throw new Error('Google sign-in callback did not include an authorization code')
                const { error } = await supabase.auth.exchangeCodeForSession(code)
                if (error) throw error
                await Browser.close().catch(() => {})
                if (callback.pathname === '/reset') await onPasswordRecovery?.()
                else await onAuthenticated?.()
            } catch (error) {
                await Browser.close().catch(() => {})
                onError?.(error)
            }
        }

        const listener = await App.addListener('appUrlOpen', ({ url }) => handleUrl(url))
        const launch = await App.getLaunchUrl()
        if (launch?.url) await handleUrl(launch.url)
        return listener
    },

    async sendPasswordReset(email) {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: Capacitor.isNativePlatform()
                ? ANDROID_RESET_CALLBACK
                : `${configuredWebOrigin()}/auth/reset`
        })
        if (error) throw error
        return data
    },

    async updatePassword(password) {
        const { data, error } = await supabase.auth.updateUser({ password })
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
