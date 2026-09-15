<template>
  <div :class="['app-container', { 'auth-hidden': !isAuthenticated }]">
    <!-- Sidebar -->
    <aside :class="['sidebar', { 'sidebar-open': isSidebarOpen }]">
      <div class="logo-container">
        <img src="/src/assets/badge.png" style="width: 70%; height: auto;"></img>
      </div>


      <button @click="setView('create')" class="btn-new-notebook">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        {{ t('app.newNotebook') }}
      </button>

      <div class="nav-section">
        <div class="nav-section-title">{{ t('app.main') }}</div>
        <ul class="nav-list">
          <li @click="setView('dashboard')" :class="['nav-item', { active: currentView === 'dashboard' }]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            {{ t('app.dashboard') }}
          </li>
          <li @click="openGlobalChat" :class="['nav-item', { active: currentView === 'chat' && chatMode === 'global' }]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            {{ t('app.globalChat') }}
          </li>
          <li @click="setView('graph')" :class="['nav-item', { active: currentView === 'graph' }]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="6" r="2"></circle><circle cx="19" cy="5" r="2"></circle><circle cx="12" cy="19" r="2"></circle><line x1="7" y1="7" x2="10.5" y2="17"></line><line x1="17" y1="6" x2="13.5" y2="17"></line><line x1="7" y1="6" x2="17" y2="5"></line></svg>
            {{ t('graph.title') }}
          </li>
          <li @click="isMaterialManagerOpen = true" class="nav-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="6" rx="1"></rect><rect x="2" y="16" width="6" height="6" rx="1"></rect><rect x="16" y="16" width="6" height="6" rx="1"></rect><path d="M12 8v4M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"></path></svg>
            {{ t('app.manageMaterials') }}
          </li>
        </ul>
      </div>

      <div class="nav-section">
        <div class="nav-section-title">{{ t('app.subjects') }}</div>
        <ul class="nav-list category-list">
          <li v-for="subject in subjects" :key="subject" @click="openSubject(subject)" :class="['nav-item', { active: isSubjectActive(subject) }]">
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
        <button class="mobile-menu-btn" @click="toggleSidebar">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div class="header-search">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="search"
            :placeholder="t('app.searchPlaceholder')"
            @input="showSearchResults"
            @keydown.esc="clearSearch"
          >
          <button v-if="searchQuery" class="header-search-clear" type="button" :aria-label="t('app.clearSearch')" :title="t('app.clearSearch')" @click="clearSearch">&times;</button>
        </div>
        <div class="user-profile-container">
          <div class="user-profile" @click="toggleProfileMenu">
            {{ userName }}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div v-if="isProfileMenuOpen" class="profile-dropdown">
            <div class="dropdown-item" @click="setView('settings'); isProfileMenuOpen = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              {{ t('app.settings') }}
            </div>
            <div class="dropdown-item logout" @click="handleLogoutWithMenu">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              {{ t('app.logout') }}
            </div>
          </div>
        </div>
      </header>
      <div v-if="isSidebarOpen" class="sidebar-backdrop" @click="toggleSidebar"></div>

        <div :class="['view-container', { 'view-fullscreen': currentView === 'chat' }]">
          <transition name="page" mode="out-in">
            <div :key="currentView" style="width: 100%; height: 100%;">
             <DashboardView v-if="currentView === 'dashboard'" :searchQuery="searchQuery" :userName="userName" @selectNotebook="openNotebook" @openChat="handleDashboardOpenChat" @openSubject="openSubject" />
             <CreateNotebookView v-if="currentView === 'create'" @notebookCreated="setView('dashboard'); refreshSubjects()" />
              <NotebookDetailView v-if="currentView === 'detail'" :key="'nb-' + activeNotebookId" :notebookId="activeNotebookId" :searchQuery="searchQuery" :initialTab="pendingDetailTab" @openChat="openChat" @openFlashcards="openFlashcards" @back="setView('dashboard')" @notebookDeleted="handleNotebookDeleted" @openSubject="openSubject" />
             <SubjectView v-if="currentView === 'subject'" :key="'subject-' + activeSubject" :subject="activeSubject" :searchQuery="searchQuery" @selectNotebook="openNotebook" @openChat="openSubjectChat" />
             <!-- Keyed by chat scope so switching chats (global/subject/notebook) recreates the component and reloads its history -->
              <ChatView v-if="currentView === 'chat'" :key="(chatMode || 'notebook') + '|' + (activeSubject || '') + '|' + (activeNotebookId || '')" :notebookId="chatMode ? null : activeNotebookId" :subject="chatMode === 'subject' ? activeSubject : null" :globalMode="chatMode === 'global'" @back="handleChatBack" @openFlashcards="openFlashcards" @openQuiz="openNotebookQuiz" @openMaterial="handleGeneratedMaterial" />
             <MaterialGraphView v-if="currentView === 'graph'" @open-material="openNotebook" @open-chat="openChat" />
             <FlashcardView 
               v-if="currentView === 'flashcards'" 
               :key="'fc-' + activeNotebookId" 
               :title="activeNotebook?.title" 
               :flashcards="activeNotebook?.flashcards || []" 
               @back="setView('detail')" 
             />
             <SettingsView v-if="currentView === 'settings'" />
           </div>
         </transition>
       </div>
    </main>

    <!-- Auth Overlay / Loading -->
    <!-- Material manager modal -->
    <MaterialManager v-if="isMaterialManagerOpen" @close="isMaterialManagerOpen = false" @changed="refreshSubjects" />
    <div v-if="isAuthChecking" class="auth-loading-overlay">
      <div class="loading-spinner"></div>
    </div>
    <AuthOverlay v-else-if="!isAuthenticated || isPasswordRecovery" :recoveryMode="isPasswordRecovery" :externalError="oauthError" @authenticated="onAuthenticated" @passwordUpdated="finishPasswordRecovery" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { authService } from './services/auth'
import { dbService } from './services/db'
import { aiService } from './services/ai'
import { i18n } from './services/i18n'
import AuthOverlay from './components/AuthOverlay.vue'
import DashboardView from './components/DashboardView.vue'
import CreateNotebookView from './components/CreateNotebookView.vue'
import NotebookDetailView from './components/NotebookDetailView.vue'
import SubjectView from './components/SubjectView.vue'
import ChatView from './components/ChatView.vue'
import MaterialGraphView from './components/MaterialGraphView.vue'
import FlashcardView from './components/FlashcardView.vue'
import SettingsView from './components/SettingsView.vue'
import MaterialManager from './components/MaterialManager.vue'
import { widgetService } from './services/widget'

const isAuthChecking = ref(true)
const isAuthenticated = ref(false)
const isPasswordRecovery = ref(isRecoveryUrl())
const oauthError = ref('')
let nativeOAuthListener = null
const currentView = ref('dashboard')
const activeSubject = ref(null)
const activeNotebookId = ref(null)
const activeNotebook = ref(null)
// Tab to pre-select when opening the notebook detail view (e.g. 'quiz')
const pendingDetailTab = ref(null)
const searchQuery = ref('')
const searchInput = ref(null)
const userName = ref('')
const isProfileMenuOpen = ref(false)
const isSidebarOpen = ref(false)
const subjects = ref([])
const isMaterialManagerOpen = ref(false)
const connectionStatus = ref('offline')
const connectionStatusText = ref('Disconnected')
const t = i18n.t

// Views that show filterable notebook lists — the header search filters them in place.
// From any other view, typing in the search jumps to the dashboard where results are shown.
const searchableViews = ['dashboard', 'subject', 'detail']

const showSearchResults = () => {
  if (searchQuery.value.trim() && !searchableViews.includes(currentView.value)) {
    setView('dashboard')
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  searchInput.value?.focus()
}

const handleSearchShortcut = (event) => {
  const target = event.target
  const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable
  if (event.key === '/' && !isTyping) {
    event.preventDefault()
    searchInput.value?.focus()
  }
}

function isRecoveryUrl() {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return window.location.pathname === '/auth/reset' || query.get('type') === 'recovery' || hash.get('type') === 'recovery'
}

function finishPasswordRecovery() {
  isPasswordRecovery.value = false
  window.history.replaceState({}, '', window.location.pathname)
}

const handleInitialRoute = () => {
  const path = window.location.pathname
  
  if (path === '/' || path === '/index.html') {
    setView('dashboard')
    return
  }

  if (path === '/graph') {
    setView('graph')
    return
  }

  const notebookQuizMatch = path.match(/^\/notebooks\/([a-f0-9-]+)\/quiz$/)
  if (notebookQuizMatch) {
    openNotebookQuiz(notebookQuizMatch[1])
    return
  }

  const notebookMatch = path.match(/^\/notebooks\/([a-f0-9-]+)$/)
  if (notebookMatch) {
    openNotebook(notebookMatch[1])
    return
  }

  const notebookChatMatch = path.match(/^\/notebooks\/([a-f0-9-]+)\/chat$/)
  if (notebookChatMatch) {
    openChat(notebookChatMatch[1])
    return
  }

  const subjectMatch = path.match(/^\/subjects\/(.+)$/)
  if (subjectMatch) {
    openSubject(decodeURIComponent(subjectMatch[1]))
    return
  }

  const globalChatMatch = path === '/chat/global'
  if (globalChatMatch) {
    openGlobalChat()
    return
  }

  const subjectChatMatch = path.match(/^\/chat\/(.+)$/)
  if (subjectChatMatch) {
    openSubjectChat(decodeURIComponent(subjectChatMatch[1]))
    return
  }

  if (path === '/settings') {
    setView('settings')
    return
  }

  if (path === '/create') {
    setView('create')
    return
  }

  const flashcardMatch = path.match(/^\/notebooks\/([a-f0-9-]+)\/flashcards$/)
  if (flashcardMatch) {
    openFlashcards(flashcardMatch[1])
    return
  }

  setView('dashboard')
}

const onAuthenticated = async () => {
  const user = await authService.getCurrentUser()
  if (user) {
    try {
      const profile = await dbService.getProfile()
      userName.value = profile?.username || user.email.split('@')[0]
      // Apply the saved text model on startup. Image/vision requests remain
      // pinned inside aiService to gemma-4-31b-it.
      if (profile?.llm) {
        const llm = profile.llm
        const selectedModel = llm.provider === 'OpenAI Compatible'
          ? (llm.textboxModel?.trim() || llm.model)
          : llm.model
        if (selectedModel) {
          aiService.saveConfig({
            chatModel: selectedModel,
            ...(llm.provider === 'OpenAI Compatible'
              ? { baseUrl: llm.baseUrl, apiKey: llm.apiKey }
              : {})
          })
        }
      }

      // Apply localization settings from the profile
      if (profile?.localization) {
        if (profile.localization.interfaceLang) {
          i18n.setLang(profile.localization.interfaceLang)
        }
        if (profile.localization.llmLang) {
          aiService.saveConfig({ language: i18n.llmLangName(profile.localization.llmLang) })
        }
      }
    } catch (e) {
      userName.value = user.email.split('@')[0]
    }
    isAuthenticated.value = true
    await refreshSubjects()
    await checkAIConnection()
    handleInitialRoute()
  }
}

const handleLogout = async () => {
  await authService.signOut()
  await widgetService.clear()
  isAuthenticated.value = false
}

const handleLogoutWithMenu = async () => {
  isProfileMenuOpen.value = false
  await handleLogout()
}

const toggleProfileMenu = () => {
  isProfileMenuOpen.value = !isProfileMenuOpen.value
}

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const closeSidebar = () => {
  isSidebarOpen.value = false
}

// Chat mode: null = notebook chat, 'subject' = subject chat, 'global' = global chat
const chatMode = ref(null)

const updateUrl = (path) => {
  window.history.pushState({}, '', path)
}

const setView = (view, param = null) => {
  currentView.value = view
  let path = '/'
  if (view === 'subject') {
    activeSubject.value = param
    path = `/subjects/${encodeURIComponent(param)}`
  } else if (view === 'settings') {
    path = '/settings'
  } else if (view === 'create') {
    path = '/create'
  } else if (view === 'graph') {
    path = '/graph'
  } else if (view === 'dashboard') {
    path = '/'
  }
  updateUrl(path)
}

const openNotebook = (id) => {
  chatMode.value = null
  pendingDetailTab.value = null
  activeNotebookId.value = id
  currentView.value = 'detail'
  updateUrl(`/notebooks/${id}`)
}

// Opens the notebook detail view directly on its Quiz tab
const openNotebookQuiz = (id) => {
  if (!id) {
    console.error('No notebook ID provided to openNotebookQuiz');
    return;
  }
  chatMode.value = null
  pendingDetailTab.value = 'quiz'
  activeNotebookId.value = id
  currentView.value = 'detail'
  updateUrl(`/notebooks/${id}/quiz`)
}

const openChat = (id) => {
  chatMode.value = null
  activeNotebookId.value = id
  currentView.value = 'chat'
  updateUrl(`/notebooks/${id}/chat`)
}

const openGlobalChat = () => {
  chatMode.value = 'global'
  activeNotebookId.value = null
  activeSubject.value = null
  currentView.value = 'chat'
  updateUrl('/chat/global')
}

// Opens the subject overview page (stats + notebooks), not the chat directly
const openSubject = (subject) => {
  setView('subject', subject)
}

const openSubjectChat = (subject) => {
  const targetSubject = subject || activeSubject.value
  if (!targetSubject) {
    console.error('No subject provided to openSubjectChat');
    return;
  }
  chatMode.value = 'subject'
  activeSubject.value = targetSubject
  activeNotebookId.value = null
  currentView.value = 'chat'
  updateUrl(`/chat/${encodeURIComponent(targetSubject)}`)
}

const isSubjectActive = (subject) => {
  return activeSubject.value === subject && (currentView.value === 'subject' || (currentView.value === 'chat' && chatMode.value === 'subject'))
}

const handleDashboardOpenChat = (notebookId, subject) => {
  if (subject) {
    openSubjectChat(subject)
  } else {
    openGlobalChat()
  }
}

const handleChatBack = () => {
  if (chatMode.value) {
    setView('dashboard')
  } else {
    setView('detail')
  }
}

const handleNotebookDeleted = async () => {
  await refreshSubjects()
  currentView.value = 'dashboard'
}

const handleGeneratedMaterial = async (notebookId) => {
  await refreshSubjects()
  openNotebook(notebookId)
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
    connectionStatusText.value = aiService.config.useDemoMode ? t('app.demoMode') : t('app.aiOnline')
  } else {
    connectionStatus.value = 'offline'
    connectionStatusText.value = t('app.aiOffline')
  }
}

onMounted(async () => {
  try {
    nativeOAuthListener = await authService.initializeNativeOAuth({
      onAuthenticated: async () => {
        oauthError.value = ''
        await onAuthenticated()
      },
      onPasswordRecovery: async () => {
        oauthError.value = ''
        isPasswordRecovery.value = true
        await onAuthenticated()
      },
      onError: (error) => {
        oauthError.value = error?.message || t('auth.googleFailed')
      }
    })
    const session = await authService.checkSession()
    if (session && !isAuthenticated.value) {
      await onAuthenticated()
    }
  } finally {
    isAuthChecking.value = false
  }

  window.addEventListener('popstate', () => {
    handleInitialRoute()
  })
  window.addEventListener('keydown', handleSearchShortcut)
})

onBeforeUnmount(() => {
  nativeOAuthListener?.remove()
  window.removeEventListener('keydown', handleSearchShortcut)
})

const openFlashcards = async (id) => {
  if (!id) {
    console.error('No notebook ID provided to openFlashcards');
    alert('Error: No notebook ID found.');
    return;
  }
  activeNotebookId.value = id
  try {
    activeNotebook.value = await dbService.getNotebook(id)
    currentView.value = 'flashcards'
    updateUrl(`/notebooks/${id}/flashcards`)
  } catch (e) {
    console.error('Failed to load flashcards:', e)
    alert('Failed to load flashcards: ' + (e.message || 'Unknown error'))
    setView('dashboard')
  }
}
</script>

<style src="./style.css"></style>
