<template>
  <div class="dashboard-view">
    <div class="dashboard-hero">
      <div class="hero-content">
        <h1>Welcome back, {{ userName }}!</h1>
        <p>Your personal knowledge base is ready. Continue where you left off or start a new study session.</p>
      </div>
      <button class="btn-global-chat" @click="$emit('openChat', null)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        Global Coach
      </button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📚</div>
        <div class="stat-info">
          <h3>{{ notebooks.length }}</h3>
          <p>Total Notebooks</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon teal">🏷️</div>
        <div class="stat-info">
          <h3>{{ subjects.length }}</h3>
          <p>Subjects</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">💬</div>
        <div class="stat-info">
          <h3>{{ totalChats }}</h3>
          <p>AI Interactions</p>
        </div>
      </div>
    </div>

    <div class="section-header">
      <h2>Your Subjects</h2>
    </div>
    <div class="subjects-grid">
      <div v-for="subject in filteredSubjects" :key="subject" class="subject-card" @click="handleSubjectClick(subject)">
        <h3>{{ subject }}</h3>
        <p>Explore all notebooks and AI chats for this subject.</p>
        <div class="subject-meta">
          <span>{{ getNotebookCount(subject) }} Notebooks</span>
          <button class="btn-chat-subject" @click.stop="$emit('openChat', null, subject)">Chat AI</button>
        </div>
      </div>
      <div v-if="filteredSubjects.length === 0" class="empty-state">
        <div class="empty-icon">📂</div>
        <h3>No subjects found</h3>
        <p>Start by creating your first notebook!</p>
      </div>
    </div>

    <div class="section-header">
      <h2>Recent Notebooks</h2>
    </div>
    <div class="notebooks-grid">
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
        <h3>No notebooks found</h3>
        <p>Try a different search term or create a new one.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { dbService } from '../services/db'
import { authService } from '../services/auth'

const props = defineProps(['searchQuery', 'userName'])
const emit = defineEmits(['selectNotebook', 'openChat'])

const notebooks = ref([])
const totalChats = ref(0)

onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  try {
    notebooks.value = await dbService.getAllNotebooks()
    const chats = await dbService.getChatHistory()
    totalChats.value = chats.length
  } catch (e) {
    console.error('Failed to load dashboard data:', e)
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

const handleSubjectClick = (subject) => {
  // Logic handled by btn-chat-subject and emit
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