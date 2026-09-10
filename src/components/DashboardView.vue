<template>
  <div class="dashboard-view">
    <div class="dashboard-hero">
      <div class="hero-content">
        <h1>{{ t('dash.welcome', { name: userName }) }}</h1>
        <p>{{ t('dash.subtitle') }}</p>
      </div>
      <button class="btn-global-chat" @click="$emit('openChat', null)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        {{ t('dash.globalCoach') }}
      </button>
    </div>

    <div class="stats-grid">
      <template v-if="loading">
        <div v-for="i in 4" :key="i" class="stat-card skeleton">
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
            <p>{{ t('dash.totalNotebooks') }}</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">🔥</div>
          <div class="stat-info">
            <h3>{{ studyStreak.streak }}</h3>
            <p>{{ t('dash.studyStreak') }}</p>
            <span :class="['streak-status', { complete: studyStreak.studiedToday }]">
              {{ studyStreak.studiedToday ? t('dash.studiedToday') : t('dash.studyToday') }}
            </span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon teal">🏷️</div>
          <div class="stat-info">
            <h3>{{ subjects.length }}</h3>
            <p>{{ t('dash.subjects') }}</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">💬</div>
          <div class="stat-info">
            <h3>{{ totalChats }}</h3>
            <p>{{ t('dash.aiInteractions') }}</p>
          </div>
        </div>
      </template>
    </div>

    <div class="section-header">
      <h2>{{ t('dash.yourSubjects') }}</h2>
    </div>
    <div class="subjects-grid">
      <template v-if="loading">
        <div v-for="i in 3" :key="i" class="subject-card skeleton">
          <div class="skeleton-text medium"></div>
          <div class="skeleton-text long"></div>
          <div class="subject-meta">
            <div class="skeleton-text short"></div>
            <div class="skeleton-box btn-skeleton"></div>
          </div>
        </div>
      </template>
      <template v-else>
        <div v-for="subject in filteredSubjects" :key="subject" class="subject-card" @click="$emit('openSubject', subject)">
          <h3>{{ subject }}</h3>
          <p>{{ t('dash.subjectDesc') }}</p>
          <div class="subject-meta">
            <span>{{ t('dash.notebooksCount', { count: getNotebookCount(subject) }) }}</span>
            <button class="btn-chat-subject" @click.stop="$emit('openChat', null, subject)">{{ t('dash.chatAI') }}</button>
          </div>
        </div>
        <div v-if="filteredSubjects.length === 0" class="empty-state">
          <div class="empty-icon">📂</div>
          <h3>{{ t('dash.noSubjects') }}</h3>
          <p>{{ t('dash.noSubjectsDesc') }}</p>
        </div>
      </template>
    </div>

    <div class="section-header">
      <h2>{{ t('dash.recentNotebooks') }}</h2>
    </div>
    <div class="notebooks-grid">
      <template v-if="loading">
        <div v-for="i in 3" :key="i" class="notebook-card skeleton">
          <div class="notebook-tags">
            <div class="skeleton-box tag-skeleton"></div>
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
            <span class="tag tag-subject">{{ nb.subject }}</span>
            <span class="tag tag-material">{{ nb.material }}</span>
          </div>
          <h3>{{ nb.title }}</h3>
          <p class="notebook-desc">{{ nb.summary.substring(0, 120).replace(/[#*`]/g, '') }}...</p>
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
          <h3>{{ t('dash.noNotebooks') }}</h3>
          <p>{{ t('dash.noNotebooksDesc') }}</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { dbService } from '../services/db'
import { authService } from '../services/auth'
import { i18n } from '../services/i18n'
import { widgetService } from '../services/widget'

const t = i18n.t
const props = defineProps(['searchQuery', 'userName'])
const emit = defineEmits(['selectNotebook', 'openChat'])

const loading = ref(true)
const notebooks = ref([])
const totalChats = ref(0)
const studyStreak = ref({ streak: 0, studiedToday: false })

onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  try {
    notebooks.value = await dbService.getAllNotebooks()
    const [chats, streak] = await Promise.all([
      dbService.getChatHistory(),
      dbService.getStudyStreak()
    ])
    totalChats.value = chats.length
    studyStreak.value = streak
    await widgetService.sync(streak)
  } catch (e) {
    console.error('Failed to load dashboard data:', e)
  } finally {
    loading.value = false
  }
}

const subjects = computed(() => {
  return [...new Set(notebooks.value.map(n => n.subject))]
})

const filteredSubjects = computed(() => {
  if (!props.searchQuery) return subjects.value
  return subjects.value.filter(s => s.toLowerCase().includes(props.searchQuery.toLowerCase()))
})

const filteredNotebooks = computed(() => {
  if (!props.searchQuery) return notebooks.value
  const q = props.searchQuery.toLowerCase()
  return notebooks.value.filter(n => 
    n.title.toLowerCase().includes(q) || 
    n.subject.toLowerCase().includes(q) || 
    n.material.toLowerCase().includes(q) || 
    n.summary.toLowerCase().includes(q)
  )
})

const getNotebookCount = (subject) => {
  return notebooks.value.filter(n => n.subject === subject).length
}

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
</style>
