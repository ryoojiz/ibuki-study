<template>
  <div class="detail-layout">
    <div class="notebook-content-panel">
      <div class="tabs-header">
        <button 
          @click="activeTab = 'summary'" 
          :class="['tab-btn', { active: activeTab === 'summary' }]"
        >
          Summary
        </button>
        <button 
          @click="activeTab = 'transcription'" 
          :class="['tab-btn', { active: activeTab === 'transcription' }]"
        >
          Transcription
        </button>
        <button 
          @click="activeTab = 'sources'" 
          :class="['tab-btn', { active: activeTab === 'sources' }]"
        >
          Sources
        </button>
      </div>

      <div class="tab-content">
        <div v-if="activeTab === 'summary'" class="summary-container">
          <div v-html="renderMarkdown(notebook?.summary)"></div>
        </div>

        <div v-else-if="activeTab === 'transcription'" class="transcription-container">
          <div v-html="renderMarkdown(notebook?.transcription)"></div>
        </div>

        <div v-else-if="activeTab === 'sources'" class="sources-gallery">
          <div v-for="(src, index) in notebook?.sources" :key="index" class="gallery-card">
            <div style="padding: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); border-bottom: 1px solid var(--border-light)">
              Source #{{ index + 1 }}
            </div>
            <div style="padding: 1rem; text-align: center; font-size: 0.9rem">
              <a v-if="src.url" :href="src.url" target="_blank" style="color: var(--text-primary); text-decoration: underline">
                {{ src.name }}
              </a>
              <span v-else>{{ src.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="detail-sidebar">
      <div class="creator-panel" style="height: 100%">
        <h2>Notebook Info</h2>
        <div class="input-group">
          <label>Title</label>
          <div style="color: white; font-weight: 600">{{ notebook?.title }}</div>
        </div>
        <div class="input-group">
          <label>Subject</label>
          <div style="color: white">{{ notebook?.subject }}</div>
        </div>
        <div class="input-group">
          <label>Material</label>
          <div style="color: white">{{ notebook?.material }}</div>
        </div>
        
        <div style="margin-top: auto; display: flex; flex-direction: column; gap: 0.75rem">
          <button @click="$emit('openChat', notebook.id)" class="btn-analyze" style="width: 100%">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            Discuss this Material
          </button>
          <button @click="handleDelete" class="btn-delete-notebook" style="width: 100%">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Delete Notebook
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { dbService } from '../services/db'

const props = defineProps(['notebookId'])
const emit = defineEmits(['notebookDeleted', 'openChat'])
const notebook = ref(null)
const activeTab = ref('summary')

onMounted(async () => {
  try {
    notebook.value = await dbService.getNotebook(props.notebookId)
  } catch (e) {
    console.error('Failed to load notebook details:', e)
  }
})

const handleDelete = async () => {
  if (!notebook.value) return
  if (!confirm(`Are you sure you want to delete "${notebook.value.title}"? This action cannot be undone.`)) return
  
  try {
    await dbService.deleteNotebook(props.notebookId)
    alert('Notebook deleted successfully')
    emit('notebookDeleted')
  } catch (e) {
    alert('Failed to delete notebook: ' + e.message)
  }
}

const renderMarkdown = (text) => {
  if (!text) return ''
  
  // Simple regex-based markdown converter to match original app's behavior
  let html = text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/\[Source (\d+)(, Page \d+)?\]/g, (match, sourceNum) => {
      const sourceIndex = parseInt(sourceNum) - 1;
      const source = notebook.value?.sources?.[sourceIndex];
      if (source && source.url) {
        return `<a href="${source.url}" target="_blank" class="citation-link">${match}</a>`;
      }
      return match;
    })

  if (!html.startsWith('<p>')) html = '<p>' + html + '</p>';
  
  // Wrap <li> in <ul>
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  // Fix double <ul>
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  return html
}
</script>

<style scoped>
.detail-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.transcription-container {
  line-height: 1.6;
  font-family: var(--font-body);
}
.btn-delete-notebook {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: transparent;
  border: 1px solid var(--danger-color);
  color: var(--danger-color);
  padding: 0.8rem;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-delete-notebook:hover {
  background: var(--danger-color);
  color: white;
}
</style>