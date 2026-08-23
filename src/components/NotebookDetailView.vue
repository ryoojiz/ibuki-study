<template>
  <div class="detail-layout">
    <div class="notebook-content-panel">
      <button @click="$emit('back')" class="btn-back" style="display: inline-flex; align-items: center; gap: 0.4rem; align-self: flex-start; background: transparent; border: 1px solid var(--border-light); color: var(--text-secondary); padding: 0.45rem 0.8rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem; margin-bottom: 0.75rem;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        {{ t('detail.backToDashboard') }}
      </button>
      <div class="tabs-header">
        <button
          @click="activeTab = 'summary'"
          :class="['tab-btn', { active: activeTab === 'summary' }]"
        >
          {{ t('detail.summary') }}
        </button>
        <button
          @click="activeTab = 'transcription'"
          :class="['tab-btn', { active: activeTab === 'transcription' }]"
        >
          {{ t('detail.transcription') }}
        </button>
        <button
          @click="activeTab = 'sources'"
          :class="['tab-btn', { active: activeTab === 'sources' }]"
        >
          {{ t('detail.sources') }}
        </button>
        <button
          @click="activeTab = 'quiz'"
          :class="['tab-btn', { active: activeTab === 'quiz' }]"
        >
          {{ t('detail.quiz') }}
        </button>
      </div>

      <div class="tab-content">
        <div v-if="activeTab === 'summary'" class="summary-container">
          <div class="rendered-content" v-html="summaryView.html" @click="onContentClick($event, summaryView.refs)"></div>

          <!-- Reference footer: numbered details of everything cited above -->
          <div v-if="summaryView.refs.length" class="citation-footer">
            <div class="citation-footer-title">{{ t('detail.sources') }}</div>
            <button
              v-for="cite in summaryView.refs"
              :key="cite.num"
              class="citation-footer-item"
              :disabled="!cite.source"
              @click="openSource(cite)"
            >
              <span class="cf-num">[{{ cite.num }}]</span>
              <span class="cf-body">
                <span class="cf-name">{{ cite.source ? cite.source.name : t('detail.unknownSource') }}</span>
                <span class="cf-meta" v-if="cite.source">{{ cite.source.notebookTitle }}<template v-if="cite.page"> &middot; {{ t('detail.page', { n: cite.page }) }}</template></span>
                <span class="cf-quote" v-if="cite.quote">&ldquo;{{ cite.quote }}&rdquo;</span>
              </span>
            </button>
          </div>
        </div>

        <div v-else-if="activeTab === 'transcription'" class="transcription-container">
          <div class="rendered-content" v-html="transcriptionView.html" @click="onContentClick($event, transcriptionView.refs)"></div>

          <div v-if="transcriptionView.refs.length" class="citation-footer">
            <div class="citation-footer-title">{{ t('detail.sources') }}</div>
            <button
              v-for="cite in transcriptionView.refs"
              :key="cite.num"
              class="citation-footer-item"
              :disabled="!cite.source"
              @click="openSource(cite)"
            >
              <span class="cf-num">[{{ cite.num }}]</span>
              <span class="cf-body">
                <span class="cf-name">{{ cite.source ? cite.source.name : t('detail.unknownSource') }}</span>
                <span class="cf-meta" v-if="cite.source">{{ cite.source.notebookTitle }}<template v-if="cite.page"> &middot; {{ t('detail.page', { n: cite.page }) }}</template></span>
                <span class="cf-quote" v-if="cite.quote">&ldquo;{{ cite.quote }}&rdquo;</span>
              </span>
            </button>
          </div>
        </div>

        <div v-else-if="activeTab === 'quiz'" class="quiz-tab-container">
          <QuizPanel :notebook-id="notebookId" :title="notebook?.title" />
        </div>

        <div v-else-if="activeTab === 'sources'" class="sources-gallery">
          <div v-for="(src, index) in notebook?.sources" :key="index" class="gallery-card">
            <div style="padding: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); border-bottom: 1px solid var(--border-light)">
              {{ t('detail.sourceNum', { n: index + 1 }) }}
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
        <h2>{{ t('detail.notebookInfo') }}</h2>
        <div class="input-group">
          <label>{{ t('detail.title') }}</label>
          <div style="color: white; font-weight: 600">{{ notebook?.title }}</div>
        </div>
        <div class="input-group">
          <label>{{ t('detail.subject') }}</label>
          <div class="crumb-row">
            <template v-if="breadcrumb.length">
              <span v-for="(seg, i) in breadcrumb" :key="i" class="crumb-seg" :class="{ clickable: i === 0 }" @click="i === 0 && $emit('openSubject', seg)">
                {{ seg }}<span v-if="i < breadcrumb.length - 1" class="crumb-sep">›</span>
              </span>
            </template>
            <span v-else style="color: var(--text-muted)">—</span>
          </div>
        </div>
        <div class="input-group">
          <label>{{ t('detail.material') }}</label>
          <MaterialPicker :model-value="notebook?.material_id || null" @update:modelValue="onMaterialPicked" />
        </div>

        <div style="margin-top: auto; display: flex; flex-direction: column; gap: 0.75rem">
          <button 
            v-if="notebook?.flashcards && notebook.flashcards.length" 
            @click="$emit('openFlashcards', notebook.id)" 
            class="btn-analyze" 
            style="width: 100%; background: var(--accent-gradient)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            {{ t('detail.studyFlashcards') }}
          </button>
          <button @click="$emit('openChat', notebook.id)" class="btn-analyze" style="width: 100%">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            {{ t('detail.discuss') }}
          </button>
          <button @click="handleDelete" class="btn-delete-notebook" style="width: 100%">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            {{ t('detail.deleteNotebook') }}
          </button>
        </div>
      </div>
    </div>

    <SourceViewerModal v-if="activeCite" :cite="activeCite" @close="activeCite = null" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { dbService } from '../services/db'
import { citationsService } from '../services/citations'
import { i18n } from '../services/i18n'
import SourceViewerModal from './SourceViewerModal.vue'
import QuizPanel from './QuizPanel.vue'
import MaterialPicker from './MaterialPicker.vue'
import { materialsService } from '../services/materials'

const t = i18n.t
const props = defineProps(['notebookId', 'initialTab'])
const emit = defineEmits(['notebookDeleted', 'openChat', 'openFlashcards', 'back', 'openSubject'])
const notebook = ref(null)
const activeTab = ref(props.initialTab || 'summary')
const activeCite = ref(null)

// ---- Materials tree (picker + breadcrumb) ----------------------------------
const materialsFlat = ref([])
const materialIndex = computed(() => materialsService.indexById(materialsFlat.value))
const breadcrumb = computed(() => {
  const id = notebook.value?.material_id
  if (id) {
    const names = materialsService.getPathNames(materialIndex.value, id)
    if (names.length) return names
  }
  return notebook.value?.subject ? [notebook.value.subject] : []
})

const onMaterialPicked = async (materialId) => {
  try {
    await dbService.assignNotebooksToMaterial([props.notebookId], materialId, materialIndex.value)
    notebook.value = await dbService.getNotebook(props.notebookId)
  } catch (e) {
    console.error('Failed to assign material:', e)
  }
}

// Numbered [1]..[N] registry of this notebook's sources
const sourceRegistry = computed(() =>
  citationsService.buildSourceRegistry(notebook.value ? [notebook.value] : [])
)

const summaryView = computed(() =>
  citationsService.renderMarkdownWithCitations(notebook.value?.summary, sourceRegistry.value)
)

const transcriptionView = computed(() =>
  citationsService.renderMarkdownWithCitations(notebook.value?.transcription, sourceRegistry.value)
)

onMounted(async () => {
  try {
    dbService.getMaterials().then(m => { materialsFlat.value = m }).catch(() => {})
    notebook.value = await dbService.getNotebook(props.notebookId)
  } catch (e) {
    console.error('Failed to load notebook details:', e)
  }
})

const handleDelete = async () => {
  if (!notebook.value) return
  if (!confirm(t('detail.deleteConfirm', { title: notebook.value.title }))) return

  try {
    await dbService.deleteNotebook(props.notebookId)
    alert(t('detail.deleted'))
    emit('notebookDeleted')
  } catch (e) {
    alert(t('detail.deleteFailed', { message: e.message }))
  }
}

// Event delegation: clicks on .cite-ref pills inside rendered HTML
const onContentClick = (event, refs) => {
  const el = event.target.closest('.cite-ref')
  if (!el || el.classList.contains('cite-ref-missing')) return
  const num = parseInt(el.dataset.citeNum, 10)
  const cite = refs.find(r => r.num === num)
  if (cite && cite.source) openSource(cite)
}

const openSource = (cite) => {
  activeCite.value = cite
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
.crumb-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem;
  color: white;
  font-size: 0.9rem;
}
.crumb-seg.clickable { cursor: pointer; }
.crumb-seg.clickable:hover { color: #a5b4fc; text-decoration: underline; }
.crumb-sep { margin: 0 0.3rem; color: var(--text-muted); }
</style>
