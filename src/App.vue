<template>
  <div :class="['app-container', { 'auth-hidden': !isAuthenticated }]">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="logo-container">
        <img src="/src/assets/badge.png" style="width: 70%; height: auto;"></img>
      </div>


      <button @click="setView('create')" class="btn-new-notebook">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        New Notebook
      </button>

      <div class="nav-section">
        <div class="nav-section-title">Main</div>
        <ul class="nav-list">
          <li @click="setView('dashboard')" :class="['nav-item', { active: currentView === 'dashboard' }]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Dashboard
          </li>
        </ul>
      </div>

      <div class="nav-section">
        <div class="nav-section-title">Subjects</div>
        <ul class="nav-list category-list">
          <li v-for="subject in subjects" :key="subject" @click="setView('subject', subject)" :class="['nav-item', { active: currentView === 'subject' && activeSubject === subject }]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            {{ subject }}
          </li>
        </ul>
      </div>

      <div class="sidebar-footer">
        <div class="connection-status">
          <div :class="['status-dot', connectionStatus]"></div>
          {{ connectionStatusText }}
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <header class="main-header">
        <div class="header-search">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input v-model="searchQuery" type="text" placeholder="Search notebooks, subjects...">
        </div>
        <div class="user-profile-container">
          <div class="user-profile" @click="toggleProfileMenu">
            {{ userName }}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div v-if="isProfileMenuOpen" class="profile-dropdown">
            <div class="dropdown-item" @click="setView('settings'); isProfileMenuOpen = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Settings
            </div>
            <div class="dropdown-item logout" @click="handleLogoutWithMenu">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              Logout
            </div>
          </div>
        </div>
      </header>

       <div class="view-container">
         <DashboardView v-if="currentView === 'dashboard'" :searchQuery="searchQuery" :userName="userName" @selectNotebook="openNotebook" />
         <CreateNotebookView v-if="currentView === 'create'" @notebookCreated="setView('dashboard')" />
         <NotebookDetailView v-if="currentView === 'detail'" :notebookId="activeNotebookId" @openChat="openChat" />
         <ChatView v-if="currentView === 'chat'" :notebookId="activeNotebookId" @back="setView('detail')" />
         <SettingsView v-if="currentView === 'settings'" />
       </div>
    </main>

    <!-- Auth Overlay -->
    <AuthOverlay v-if="!isAuthenticated" @authenticated="onAuthenticated" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { authService } from './services/auth'
import { dbService } from './services/db'
import { aiService } from './services/ai'
import AuthOverlay from './components/AuthOverlay.vue'
import DashboardView from './components/DashboardView.vue'
import CreateNotebookView from './components/CreateNotebookView.vue'
import NotebookDetailView from './components/NotebookDetailView.vue'
import ChatView from './components/ChatView.vue'
import SettingsView from './components/SettingsView.vue'

const isAuthenticated = ref(false)
const currentView = ref('dashboard')
const activeSubject = ref(null)
const activeNotebookId = ref(null)
const searchQuery = ref('')
const userName = ref('')
const isProfileMenuOpen = ref(false)
const subjects = ref([])
const connectionStatus = ref('offline')
const connectionStatusText = ref('Disconnected')

const onAuthenticated = async () => {
  const user = await authService.getCurrentUser()
  if (user) {
    try {
      const profile = await dbService.getProfile()
      userName.value = profile?.username || user.email.split('@')[0]
    } catch (e) {
      userName.value = user.email.split('@')[0]
    }
    isAuthenticated.value = true
    await refreshSubjects()
    await checkAIConnection()
  }
}

const handleLogout = async () => {
  await authService.signOut()
  isAuthenticated.value = false
}

const handleLogoutWithMenu = async () => {
  isProfileMenuOpen.value = false
  await handleLogout()
}

const toggleProfileMenu = () => {
  isProfileMenuOpen.value = !isProfileMenuOpen.value
}

const setView = (view, param = null) => {
  currentView.value = view
  if (view === 'subject') {
    activeSubject.value = param
  }
}

const openNotebook = (id) => {
  activeNotebookId.value = id
  currentView.value = 'detail'
}

const openChat = (id) => {
  activeNotebookId.value = id
  currentView.value = 'chat'
}

const refreshSubjects = async () => {
  try {
    const notebooks = await dbService.getAllNotebooks()
    subjects.value = [...new Set(notebooks.map(n => n.subject))]
  } catch (e) {
    console.error('Failed to refresh subjects:', e)
  }
}

const checkAIConnection = async () => {
  aiService.init()
  const result = await aiService.testConnection()
  if (result.success) {
    connectionStatus.value = aiService.config.useDemoMode ? 'demo' : 'online'
    connectionStatusText.value = aiService.config.useDemoMode ? 'Demo Mode' : 'AI Online'
  } else {
    connectionStatus.value = 'offline'
    connectionStatusText.value = 'AI Offline'
  }
}

onMounted(async () => {
  const session = await authService.checkSession()
  if (session) {
    await onAuthenticated()
  }
})
</script>

<style src="./style.css"></style>