<template>
  <div class="settings-container">
    <h1>Settings</h1>
    
    <section class="settings-section">
      <h2>Profile Management</h2>
      <div class="settings-field">
        <label for="username">Username</label>
        <div class="field-input-group">
          <input 
            id="username" 
            v-model="profile.username" 
            type="text" 
            placeholder="Enter your username"
          />
          <button @click="saveProfile" :disabled="saving" class="btn-save">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <h2>Preferences</h2>
      <div class="settings-field">
        <label class="checkbox-field">
          <input type="checkbox" v-model="profile.preferences.notifications" @change="savePreferences" />
          Enable Notifications
        </label>
      </div>
      <div class="settings-field">
        <label class="checkbox-field">
          <input type="checkbox" v-model="profile.preferences.darkMode" @change="savePreferences" />
          Dark Mode
        </label>
      </div>
    </section>

    <div v-if="message" :class="['settings-message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { dbService } from '../services/db'

const profile = ref({
  username: '',
  preferences: {
    notifications: true,
    darkMode: false
  }
})
const saving = ref(false)
const message = ref('')
const messageType = ref('success')

const loadProfile = async () => {
  try {
    const data = await dbService.getProfile()
    if (data) {
      profile.value.username = data.username || ''
      profile.value.preferences = { ...profile.value.preferences, ...data.preferences }
    }
  } catch (e) {
    console.error('Failed to load profile:', e)
  }
}

const saveProfile = async () => {
  saving.value = true
  message.value = ''
  try {
    await dbService.updateProfile({ username: profile.value.username })
    message.value = 'Username updated successfully!'
    messageType.value = 'success'
  } catch (e) {
    message.value = 'Failed to update username.'
    messageType.value = 'error'
  } finally {
    saving.value = false
  }
}

const savePreferences = async () => {
  try {
    await dbService.updateProfile({ preferences: profile.value.preferences })
    message.value = 'Preferences saved!'
    messageType.value = 'success'
  } catch (e) {
    message.value = 'Failed to save preferences.'
    messageType.value = 'error'
  }
}

onMounted(loadProfile)
</script>

<style scoped>
.settings-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.settings-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--bg-secondary, #f9f9f9);
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.settings-section h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-size: 1.25rem;
  color: var(--text-main, #333);
}

.settings-field {
  margin-bottom: 1.25rem;
}

.settings-field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.field-input-group {
  display: flex;
  gap: 0.5rem;
}

.field-input-group input {
  flex: 1;
  padding: 0.6rem;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.btn-save {
  padding: 0.6rem 1.2rem;
  background: var(--primary-color, #4a90e2);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-weight: normal !important;
}

.settings-message {
  text-align: center;
  padding: 1rem;
  border-radius: 6px;
  margin-top: 1rem;
}

.settings-message.success {
  background: #e6fffa;
  color: #2c7a7b;
}

.settings-message.error {
  background: #fff5f5;
  color: #c53030;
}
</style>