<template>
  <div class="dashboard-view">
    <div class="dashboard-hero">
      <div class="hero-content">
        <h1>{{ subject }}</h1>
        <p>{{ t('subject.subtitle') }}</p>
      </div>
      <button class="btn-global-chat" @click="$emit('openChat')">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        {{ t('subject.chatAI') }}
      </button>
    </div>

    <div class="tabs-header subject-tabs">
      <button
        @click="activeTab = 'notebooks'"
        :class="['tab-btn', { active: activeTab === 'notebooks' }]"
      >
        {{ t('subject.tabNotebooks') }}
      </button>
      <button
        @click="activeTab = 'quiz'"
        :class="['tab-btn', { active: activeTab === 'quiz' }]"
      >
        {{ t('subject.tabQuiz') }}
      </button>
    </div>

    <template v-if="activeTab === 'notebooks'">
    <div class="stats-grid">
      <template v-if="loading">
        <div v-for="i in 3" :key="i" class="stat-card skeleton">
          <div class="stat-icon skeleton-box"></div>
          <div class="stat-info">
            <div class="skeleton-text short"></div>
            <div class="skeleton-text long"></div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="stat-card">
          <div class="stat-icon">📚</div>
          <div class="stat-info">
            <h3>{{ notebooks.length }}</h3>
            <p>{{ t('subject.notebooks') }}</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon teal">🏷️</div>
          <div class="stat-info">
            <h3>{{ materials.length }}</h3>
            <p>{{ t('subject.materials') }}</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">📄</div>
          <div class="stat-info">
            <h3>{{ totalSources }}</h3>
            <p>{{ t('subject.sources') }}</p>
          </div>
        </div>
      </template>
    </div>

    <div class="section-header">
      <h2>{{ t('subject.notebooks') }}</h2>
    </div>
    <div class="notebooks-grid">
      <template v-if="loading">
        <div v-for="i in 3" :key="i" class="notebook-card skeleton">
          <div class="notebook-tags">
            <div class="skeleton-box tag-skeleton"></div>
          </div>
          <div class="skeleton-text medium"></div>
          <div class="skeleton-text long"></div>
          <div class="notebook-footer">
            <div class="skeleton-box short-skeleton"></div>
            <div class="skeleton-text short"></div>
          </div>
        </div>
      </template>
      <template v-else>
        <div v-for="nb in filteredNotebooks" :key="nb.id" class="notebook-card" @click="$emit('selectNotebook', nb.id)">
          <div class="notebook-tags">
            <span class="tag tag-material">{{ nb.material }}</span>
          </div>
          <h3>{{ nb.title }}</h3>
          <p class="notebook-desc">{{ (nb.summary || '').substring(0, 120).replace(/[#*`]/g, '') }}...</p>
          <div class="notebook-footer">
            <div class="source-badges">
              <div class="badge-count">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                {{ nb.sources?.length || 0 }}
              </div>
            </div>
            <span>{{ formatDate(nb.updated_at) }}</span>
          </div>
        </div>
        <div v-if="filteredNotebooks.length === 0" class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>{{ searchQuery ? t('dash.noNotebooks') : t('subject.noNotebooks') }}</h3>
          <p>{{ searchQuery ? t('dash.noNotebooksDesc') : t('subject.noNotebooksDesc', { subject }) }}</p>
        </div>
      </template>
    </div>

    <!-- Future subject sections (e.g., Assignments) can be added here as additional section blocks -->
    </template>

    <div v-else-if="activeTab === 'quiz'" class="subject-quiz-container">
      <QuizPanel :subject="subject" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { dbService } from '../services/db'
import { i18n } from '../services/i18n'
import QuizPanel from './QuizPanel.vue'

const t = i18n.t
const props = defineProps(['subject', 'searchQuery'])
const emit = defineEmits(['selectNotebook', 'openChat'])

const loading = ref(true)
const notebooks = ref([])
const activeTab = ref('notebooks')

onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  try {
    notebooks.value = await dbService.getNotebooksBySubject(props.subject)
  } catch (e) {
    console.error('Failed to load subject notebooks:', e)
  } finally {
    loading.value = false
  }
}

const filteredNotebooks = computed(() => {
  const q = String(props.searchQuery || '').trim().toLocaleLowerCase()
  if (!q) return notebooks.value
  return notebooks.value.filter(n =>
    [n.title, n.subject, n.material, n.summary]
      .some(value => String(value || '').toLocaleLowerCase().includes(q))
  )
})

const materials = computed(() => {
  return [...new Set(notebooks.value.map(n => n.material).filter(Boolean))]
})

const totalSources = computed(() => {
  return notebooks.value.reduce((sum, n) => sum + (n.sources?.length || 0), 0)
})

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.dashboard-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}
.hero-content h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}
.subject-tabs {
  margin-bottom: 1.5rem;
}
.subject-quiz-container {
  max-width: 860px;
}
</style>
