<template>
  <div class="auth-overlay">
    <div class="auth-card">
      <div class="auth-header">
        <img src="/src/assets/badge.png" :alt="t('auth.ibukiLogo')" style="width: 70%; height: auto;">
      </div>

      <template v-if="mode === 'reset'">
        <h2>{{ t('auth.resetPassword') }}</h2>
        <p class="auth-description">{{ t('auth.resetPasswordDesc') }}</p>
        <form @submit.prevent="handlePasswordUpdate">
          <div class="input-group"><label>{{ t('auth.newPassword') }}</label><input v-model="password" type="password" autocomplete="new-password" required></div>
          <div class="input-group"><label>{{ t('auth.confirmPassword') }}</label><input v-model="confirmPassword" type="password" autocomplete="new-password" required></div>
          <button type="submit" class="btn-auth-submit" :disabled="loading">{{ loading ? t('auth.processing') : t('auth.updatePassword') }}</button>
        </form>
      </template>

      <template v-else-if="mode === 'forgot'">
        <h2>{{ t('auth.forgotPassword') }}</h2>
        <p class="auth-description">{{ t('auth.forgotPasswordDesc') }}</p>
        <form @submit.prevent="handlePasswordReset">
          <div class="input-group"><label>{{ t('auth.email') }}</label><input v-model="email" type="email" :placeholder="t('auth.emailPlaceholder')" autocomplete="email" required></div>
          <button type="submit" class="btn-auth-submit" :disabled="loading">{{ loading ? t('auth.processing') : t('auth.sendResetLink') }}</button>
        </form>
        <button type="button" class="auth-text-button" :disabled="loading" @click="mode = 'login'">{{ t('auth.backToLogin') }}</button>
      </template>

      <template v-else>
        <div class="auth-tabs">
          <button type="button" @click="mode = 'login'" :class="['auth-tab', { active: mode === 'login' }]">{{ t('auth.login') }}</button>
          <button type="button" @click="mode = 'signup'" :class="['auth-tab', { active: mode === 'signup' }]">{{ t('auth.signUp') }}</button>
        </div>
        <form @submit.prevent="handleSubmit">
          <div class="input-group"><label>{{ t('auth.email') }}</label><input v-model="email" type="email" :placeholder="t('auth.emailPlaceholder')" autocomplete="email" required></div>
          <div class="input-group"><label>{{ t('auth.password') }}</label><input v-model="password" type="password" autocomplete="current-password" placeholder="••••••••" required></div>
          <button v-if="mode === 'login'" type="button" class="auth-text-button forgot-password" @click="mode = 'forgot'">{{ t('auth.forgotPassword') }}</button>
          <button type="submit" class="btn-auth-submit" :disabled="loading">{{ loading ? t('auth.processing') : (mode === 'login' ? t('auth.login') : t('auth.createAccount')) }}</button>
        </form>
        <div class="auth-divider"><span>{{ t('auth.or') }}</span></div>
        <button type="button" @click="handleGoogleSignIn" class="btn-auth-google" :disabled="loading"><img src="/src/assets/google-logo.svg" :alt="t('auth.googleLogo')" style="width: 20px; height: 20px;">{{ t('auth.google') }}</button>
      </template>

      <div v-if="message" class="auth-success">{{ message }}</div>
      <div v-if="error || externalError" class="auth-error">{{ error || externalError }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { authService } from '../services/auth'
import { i18n } from '../services/i18n'

const props = defineProps({
  recoveryMode: { type: Boolean, default: false },
  externalError: { type: String, default: '' }
})
const emit = defineEmits(['authenticated', 'passwordUpdated'])
const t = i18n.t
const mode = ref(props.recoveryMode ? 'reset' : 'login')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const message = ref('')

function clearFeedback() { error.value = ''; message.value = '' }
async function handleSubmit() {
  loading.value = true; clearFeedback()
  try {
    if (mode.value === 'login') await authService.signIn(email.value, password.value)
    else await authService.signUp(email.value, password.value)
    emit('authenticated')
  } catch (e) { error.value = e.message || t('auth.unexpectedError') }
  finally { loading.value = false }
}
async function handlePasswordReset() {
  loading.value = true; clearFeedback()
  try { await authService.sendPasswordReset(email.value); message.value = t('auth.resetLinkSent') }
  catch (e) { error.value = e.message || t('auth.resetFailed') }
  finally { loading.value = false }
}
async function handlePasswordUpdate() {
  clearFeedback()
  if (password.value !== confirmPassword.value) { error.value = t('auth.passwordMismatch'); return }
  loading.value = true
  try { await authService.updatePassword(password.value); message.value = t('auth.passwordUpdated'); emit('passwordUpdated') }
  catch (e) { error.value = e.message || t('auth.resetFailed') }
  finally { loading.value = false }
}
async function handleGoogleSignIn() {
  loading.value = true; clearFeedback()
  try { await authService.signInWithGoogle() }
  catch (e) { error.value = e.message || t('auth.googleFailed') }
  finally { loading.value = false }
}
</script>
