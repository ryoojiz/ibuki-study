<template>
  <div class="settings-container">
    <h1>{{ t('settings.title') }}</h1>

    <!-- Tab navigation (reusing tab styles from NotebookDetailView) -->
    <div class="tabs-header">
      <button @click="activeTab='general'"    :class="['tab-btn', { active: activeTab==='general' }]">{{ t('settings.general') }}</button>
      <button @click="activeTab='llm'"       :class="['tab-btn', { active: activeTab==='llm' }]">{{ t('settings.llm') }}</button>
      <button @click="activeTab='appearance'" :class="['tab-btn', { active: activeTab==='appearance' }]">{{ t('settings.appearance') }}</button>
      <button @click="activeTab='subjects'"   :class="['tab-btn', { active: activeTab==='subjects' }]">{{ t('settings.subjects') }}</button>
      <button @click="activeTab='behaviour'"  :class="['tab-btn', { active: activeTab==='behaviour' }]">{{ t('settings.behaviour') }}</button>
      <button @click="activeTab='localization'" :class="['tab-btn', { active: activeTab==='localization' }]">{{ t('settings.localization') }}</button>
      <button @click="activeTab='other'"      :class="['tab-btn', { active: activeTab==='other' }]">{{ t('settings.other') }}</button>
    </div>

    <div class="tab-content">
      <!-- General Tab -->
      <section v-if="activeTab==='general'" class="settings-section">
        <h2>{{ t('settings.profileManagement') }}</h2>
        <div class="settings-field">
          <label for="username">{{ t('settings.username') }}</label>
          <div class="field-input-group">
            <input id="username" v-model="profile.username" type="text" :placeholder="t('settings.usernamePlaceholder')" />
            <button @click="saveGeneral" :disabled="saving" class="btn-save">
              {{ saving ? t('settings.saving') : t('settings.save') }}
            </button>
          </div>
        </div>
      </section>

      <!-- LLM Tab -->
      <section v-else-if="activeTab==='llm'" class="settings-section">
        <h2>{{ t('settings.llmSettings') }}</h2>
        <div class="settings-field">
          <label>{{ t('settings.provider') }}</label>
          <select v-model="llm.provider">
            <option value="Ibuki">Ibuki</option>
            <option value="OpenAI Compatible">OpenAI Compatible</option>
          </select>
        </div>
        <div class="settings-field">
          <label>{{ t('settings.model') }}</label>
          <select v-model="llm.model">
            <option v-for="model in availableModels" :key="model.id" :value="model.id">{{ model.name }}</option>
          </select>
        </div>
        <!-- Advanced accordion -->
        <details class="accordion">
          <summary>{{ t('settings.advanced') }}</summary>
          <div class="settings-field" v-if="llm.provider === 'OpenAI Compatible'">
            <label>{{ t('settings.baseUrl') }}</label>
            <input v-model="llm.baseUrl" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="settings-field" v-if="llm.provider === 'OpenAI Compatible'">
            <label>{{ t('settings.apiKey') }}</label>
            <input v-model="llm.apiKey" type="password" placeholder="sk-..." />
          </div>
          <div class="settings-field" v-if="llm.provider === 'OpenAI Compatible'">
            <label>{{ t('settings.textboxModel') }}</label>
            <input v-model="llm.textboxModel" placeholder="gpt-3.5-turbo" />
          </div>
        </details>
        <button @click="saveLLM" :disabled="saving" class="btn-save">
          {{ saving ? t('settings.saving') : t('settings.saveLlm') }}
        </button>
      </section>

      <!-- Appearance Tab -->
      <section v-else-if="activeTab==='appearance'" class="settings-section">
        <h2>{{ t('settings.appearanceTitle') }}</h2>
        <div class="settings-field">
          <label class="checkbox-field">
            <input type="checkbox" v-model="appearance.darkMode" @change="saveAppearance" />
            {{ t('settings.darkMode') }}
          </label>
        </div>
        <div class="settings-field">
          <label>{{ t('settings.primaryColour') }}</label>
          <input type="color" v-model="appearance.primaryColor" />
        </div>
        <button @click="saveAppearance" :disabled="saving" class="btn-save">
          {{ saving ? t('settings.saving') : t('settings.saveAppearance') }}
        </button>
      </section>

      <!-- Subjects Tab -->
      <section v-else-if="activeTab==='subjects'" class="settings-section">
        <h2>{{ t('settings.subjectsTitle') }}</h2>
        <div class="settings-field" v-for="(sub, idx) in subjects" :key="idx">
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <span>{{ sub }}</span>
            <button @click="removeSubject(idx)" class="btn-remove">✕</button>
          </div>
        </div>
        <div class="settings-field">
          <label>{{ t('settings.newSubject') }}</label>
          <div class="field-input-group">
            <input v-model="newSubject" :placeholder="t('settings.subjectName')" />
            <button @click="addSubject" class="btn-save">{{ t('settings.add') }}</button>
          </div>
        </div>
        <button @click="saveSubjects" :disabled="saving" class="btn-save">{{ t('settings.saveSubjects') }}</button>
      </section>

      <!-- Behaviour Tab -->
      <section v-else-if="activeTab==='behaviour'" class="settings-section">
        <h2>{{ t('settings.behaviourTitle') }}</h2>
        <div class="settings-field">
          <label class="checkbox-field">
            <input type="checkbox" v-model="behaviour.autoSummarise" />
            {{ t('settings.autoSummarise') }}
          </label>
        </div>
        <div class="settings-field">
          <label class="checkbox-field">
            <input type="checkbox" v-model="behaviour.chatFeedback" />
            {{ t('settings.chatFeedback') }}
          </label>
        </div>
        <button @click="saveBehaviour" :disabled="saving" class="btn-save">{{ t('settings.saveBehaviour') }}</button>
      </section>

      <!-- Localization Tab -->
      <section v-else-if="activeTab==='localization'" class="settings-section">
        <h2>{{ t('settings.localizationTitle') }}</h2>
        <div class="settings-field">
          <label>{{ t('settings.interfaceLang') }}</label>
          <select v-model="localization.interfaceLang">
            <option v-for="(name, code) in LANGUAGES" :key="code" :value="code">{{ name }}</option>
          </select>
        </div>
        <div class="settings-field">
          <label>{{ t('settings.llmLang') }}</label>
          <select v-model="localization.llmLang">
            <option v-for="(name, code) in LANGUAGES" :key="code" :value="code">{{ name }}</option>
          </select>
        </div>
        <button @click="saveLocalization" :disabled="saving" class="btn-save">{{ t('settings.saveLocalization') }}</button>
      </section>

      <!-- Other Tab -->
      <section v-else-if="activeTab==='other'" class="settings-section">
        <h2>{{ t('settings.otherTitle') }}</h2>
        <p>{{ t('settings.otherDesc') }}</p>
      </section>
    </div>

    <div v-if="message" :class="['settings-message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { dbService } from '../services/db'
import { aiService } from '../services/ai'
import { i18n, LANGUAGES } from '../services/i18n'

const t = i18n.t

// Core refs
const activeTab = ref('general')
const saving = ref(false)
const message = ref('')
const messageType = ref('success')

// Profile (General)
const profile = ref({ username: '' })

// LLM
const llm = ref({
  provider: 'Ibuki',
  model: '',
  baseUrl: '',
  apiKey: '',
  textboxModel: ''
})
const availableModels = computed(() => {
  if (llm.value.provider === 'Ibuki') {
    return [
      { id: 'gemma-4-31b-it', name: 'Ibuki Base' },
      { id: 'gpt-oss:120b', name: 'Ibuki Advanced' }
    ]
  }
  // OpenAI Compatible
  return [
    { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo' },
    { id: 'gpt-4', name: 'gpt-4' }
  ]
})

// Appearance
const appearance = ref({ darkMode: false, primaryColor: '#4a90e2' })

// Subjects
const subjects = ref([])
const newSubject = ref('')

// Behaviour
const behaviour = ref({ autoSummarise: true, chatFeedback: false })

// Localization
const localization = ref({ interfaceLang: 'en', llmLang: 'en' })

// Load everything from profile
const loadProfile = async () => {
  try {
    const data = await dbService.getProfile()
    if (data) {
      profile.value.username = data.username || ''
      // Merge nested objects safely
      if (data.preferences) {
        appearance.value.darkMode = data.preferences.darkMode ?? appearance.value.darkMode
      }
      if (data.llm) {
        llm.value = { ...llm.value, ...data.llm }
      }
      if (data.appearance) {
        appearance.value = { ...appearance.value, ...data.appearance }
      }
      if (Array.isArray(data.subjects)) subjects.value = data.subjects
      if (data.behaviour) behaviour.value = { ...behaviour.value, ...data.behaviour }
      if (data.localization) localization.value = { ...localization.value, ...data.localization }
    }
  } catch (e) {
    console.error('Failed to load profile:', e)
  }
}

// Save functions – each updates the relevant slice of the profile.
const saveGeneral = async () => {
  saving.value = true
  message.value = ''
  try {
    await dbService.updateProfile({ username: profile.value.username })
    message.value = t('settings.usernameSaved')
    messageType.value = 'success'
  } catch (e) {
    message.value = t('settings.usernameFailed')
    messageType.value = 'error'
  } finally { saving.value = false }
}

const saveLLM = async () => {
  saving.value = true
  message.value = ''
  try {
    await dbService.updateProfile({ llm: llm.value })
    const selectedModel = llm.value.provider === 'OpenAI Compatible'
      ? (llm.value.textboxModel.trim() || llm.value.model)
      : llm.value.model
    aiService.saveConfig({
      chatModel: selectedModel || aiService.config.chatModel,
      ...(llm.value.provider === 'OpenAI Compatible'
        ? { baseUrl: llm.value.baseUrl, apiKey: llm.value.apiKey }
        : {})
    })
    message.value = t('settings.llmSaved')
    messageType.value = 'success'
  } catch (e) {
    message.value = t('settings.llmFailed')
    messageType.value = 'error'
  } finally { saving.value = false }
}

const saveAppearance = async () => {
  saving.value = true
  message.value = ''
  try {
    await dbService.updateProfile({ appearance: appearance.value })
    message.value = t('settings.appearanceSaved')
    messageType.value = 'success'
  } catch (e) {
    message.value = t('settings.appearanceFailed')
    messageType.value = 'error'
  } finally { saving.value = false }
}

const addSubject = () => {
  const trimmed = newSubject.value.trim()
  if (trimmed && !subjects.value.includes(trimmed)) {
    subjects.value.push(trimmed)
    newSubject.value = ''
  }
}

const removeSubject = (idx) => {
  subjects.value.splice(idx, 1)
}

const saveSubjects = async () => {
  saving.value = true
  message.value = ''
  try {
    await dbService.updateProfile({ subjects: subjects.value })
    message.value = t('settings.subjectsSaved')
    messageType.value = 'success'
  } catch (e) {
    message.value = t('settings.subjectsFailed')
    messageType.value = 'error'
  } finally { saving.value = false }
}

const saveBehaviour = async () => {
  saving.value = true
  message.value = ''
  try {
    await dbService.updateProfile({ behaviour: behaviour.value })
    message.value = t('settings.behaviourSaved')
    messageType.value = 'success'
  } catch (e) {
    message.value = t('settings.behaviourFailed')
    messageType.value = 'error'
  } finally { saving.value = false }
}

const saveLocalization = async () => {
  saving.value = true
  message.value = ''
  try {
    await dbService.updateProfile({ localization: localization.value })
    // Apply the interface language immediately
    i18n.setLang(localization.value.interfaceLang)
    // Sync the LLM language to the AI service
    aiService.saveConfig({ language: i18n.llmLangName(localization.value.llmLang) })
    message.value = t('settings.localizationSaved')
    messageType.value = 'success'
  } catch (e) {
    message.value = t('settings.localizationFailed')
    messageType.value = 'error'
  } finally { saving.value = false }
}

onMounted(loadProfile)
</script>

<style scoped>
 .settings-container {
   max-width: 800px;
   margin: 0 auto;
   padding: 2rem;
  /* Center title and give it prominence */
  text-align: left;
 }

 .tabs-header {
   display: flex;
   flex-wrap: wrap;
   gap: 0.5rem;
   margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 0.5rem;
 }

 .settings-section {
   margin-bottom: 2rem;
   padding: 1.5rem;
   background: var(--bg-dark, #f9f9f9);
   border-radius: 12px;
  /* Subtle lift on hover */
}


 .settings-section h2 {
   margin-top: 0;
   margin-bottom: 1.5rem;
   font-size: 1.25rem;
   color: var(--text-title);
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

 .field-input-group input,
 .settings-field select,
 .settings-field input[type="color"] {
   flex: 1;
   padding: 0.6rem;
   border: 1px solid #ddd;
   border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
 }

/* Focus styles for inputs */
.field-input-group input:focus,
.settings-field select:focus,
.settings-field input[type="color"]:focus {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

 .btn-save {
   padding: 0.6rem 1.2rem;
   background: var(--accent-primary);
   color: white;
   border: none;
   border-radius: 6px;
   cursor: pointer;
   transition: opacity 0.2s;
  box-shadow: var(--shadow-sm);
 }

 .btn-save:disabled {
   opacity: 0.6;
   cursor: not-allowed;
 }

/* Hover effect for save button */
.btn-save:hover:not(:disabled) {
  opacity: 0.9;
}

 .btn-remove {
   background: transparent;
   border: none;
   color: var(--danger-color, #e53e3e);
   cursor: pointer;
   font-size: 1rem;
 }

/* Hover effect for remove */
.btn-remove:hover {
  color: var(--danger-color);
  opacity: 0.8;
}

 .checkbox-field {
   display: flex;
   align-items: center;
   gap: 0.75rem;
   cursor: pointer;
   font-weight: normal !important;
 }

/* Tab button overrides for this component */
.tabs-header .tab-btn {
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  padding: 0.4rem 0.8rem;
  transition: background 0.2s ease, color 0.2s ease;
}

.tabs-header .tab-btn:hover {
  background: var(--bg-card-hover);
}

.tabs-header .tab-btn.active {
  background: var(--accent-primary);
  color: white;
}

 .settings-message {
   text-align: center;
   padding: 1rem;
   border-radius: 6px;
   margin-top: 1rem;
  font-weight: 500;
 }

 .settings-message.success { background: #e6fffa; color: #2c7a7b; }
 .settings-message.error { background: #fff5f5; color: #c53030; }

 details.accordion { margin-top: 1rem; }

/* Smooth transition for accordion */
details.accordion[open] {
  animation: fadeIn 0.2s ease-out forwards;
}

/* Style the summary arrow */
details.accordion > summary {
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

details.accordion > summary::marker {
  color: var(--accent-primary);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>