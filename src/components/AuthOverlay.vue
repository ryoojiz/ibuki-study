<template>
  <div class="auth-overlay">
    <div class="auth-card">
      <div class="auth-header">
        <img src="/src/assets/badge.png" alt="Ibuki Logo" style="width: 70%; height: auto;">
      </div>

      <div class="auth-tabs">
        <button 
          type="button"
          @click="authMode = 'login'" 
          :class="['auth-tab', { active: authMode === 'login' }]"
        >
          Login
        </button>
        <button 
          type="button"
          @click="authMode = 'signup'" 
          :class="['auth-tab', { active: authMode === 'signup' }]"
        >
          Sign Up
        </button>
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="input-group">
          <label>Email Address</label>
          <input v-model="email" type="email" placeholder="name@example.com" required>
        </div>
        <div class="input-group">
          <label>Password</label>
          <input v-model="password" type="password" placeholder="••••••••" required>
        </div>
        
        <button type="submit" class="btn-auth-submit" :disabled="loading">
          {{ loading ? 'Processing...' : (authMode === 'login' ? 'Login' : 'Create Account') }}
        </button>
      </form>

      <div class="auth-divider">
        <span>or</span>
      </div>

      <button type="button" @click="handleGoogleSignIn" class="btn-auth-google" :disabled="loading">
        <img src="/src/assets/google-logo.svg" alt="Google Logo" style="width: 20px; height: 20px;">
        Continue with Google
      </button>

      <div v-if="error" class="auth-error">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { authService } from '../services/auth'

const emit = defineEmits(['authenticated'])

const authMode = ref('login')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

onMounted(() => {
  console.log('AuthOverlay mounted')
})

const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  
  try {
    if (authMode.value === 'login') {
      await authService.signIn(email.value, password.value)
    } else {
      await authService.signUp(email.value, password.value)
    }
    emit('authenticated')
  } catch (e) {
    error.value = e.message || 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

const handleGoogleSignIn = async () => {
  console.log('Google sign-in clicked')
  loading.value = true
  error.value = ''
  try {
    await authService.signInWithGoogle()
  } catch (e) {
    error.value = e.message || 'Google sign-in failed'
  } finally {
    loading.value = false
  }
}
</script>