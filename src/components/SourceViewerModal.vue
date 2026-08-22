<template>
  <div class="svm-overlay" @click.self="$emit('close')">
    <div class="svm-modal">
      <div class="svm-header">
        <div class="svm-heading">
          <div class="svm-title">
            <span class="svm-num">[{{ cite.num }}]</span>
            {{ source ? source.name : 'Unknown source' }}
          </div>
          <div class="svm-sub" v-if="source">from notebook "{{ source.notebookTitle }}"</div>
        </div>
        <div class="svm-header-actions">
          <a
            v-if="source && source.url"
            :href="source.url"
            target="_blank"
            rel="noopener"
            class="svm-open-original"
          >
            Open original
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
          <button @click="$emit('close')" class="svm-close-btn" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <div class="svm-body" ref="bodyEl">
        <div v-if="loading" class="svm-loading">
          <div class="svm-spinner"></div>
          Loading source...
        </div>

        <template v-else>
          <img v-if="isImage && !imageError" :src="imageSrc" class="svm-image" alt="Source material" @error="imageError = true" />

          <div v-if="isImage && imageError" class="svm-empty">
            Could not load this image. The storage bucket may be unavailable or the file was moved.
            <a v-if="source && source.url" :href="source.url" target="_blank" rel="noopener">Try opening it directly</a>
          </div>

          <div v-if="!isImage && highlightedHtml" class="svm-text" v-html="highlightedHtml"></div>

          <div v-if="!isImage && !highlightedHtml" class="svm-empty">
            Source content is not available for highlighting.
            <span v-if="source && source.url">You can still open the original file.</span>
          </div>

          <div v-if="cite.quote" class="svm-quote-chip">
            <span class="svm-quote-label">AI cited</span>
            <span class="svm-quote-text">"{{ cite.quote }}"<template v-if="cite.page"> (page {{ cite.page }})</template></span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { citationsService } from '../services/citations'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + pdfjsLib.version + '/pdf.worker.min.js'

const NL = String.fromCharCode(10)

const props = defineProps(['cite'])
const emit = defineEmits(['close'])

const loading = ref(true)
const highlightedHtml = ref('')
const bodyEl = ref(null)
const imageError = ref(false)

const source = computed(() => props.cite?.source || null)
const isImage = computed(() => source.value?.type === 'image')
const imageSrc = computed(() => source.value?.url || source.value?.content || '')

// Re-extract text (with [Page N] markers) from a stored PDF file URL
const extractPdfTextFromUrl = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch PDF (' + res.status + ')')
  const buf = await res.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  let out = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    out += '[Page ' + i + '] ' + tc.items.map(it => it.str).join(' ') + NL + NL
  }
  return out
}

// Escape, fuzzy-highlight the quoted passage, then make page markers anchorable
const buildHighlighted = (text, quote) => {
  const esc = citationsService.escapeHtml(text)
  if (!quote) return esc
  const range = citationsService.findQuoteRange(esc, citationsService.escapeHtml(quote))
  if (!range) return esc
  return (
    esc.slice(0, range.start) +
    '<mark class="cite-mark">' +
    esc.slice(range.start, range.end) +
    '</mark>' +
    esc.slice(range.end)
  )
}

const scrollToTarget = () => {
  const el = bodyEl.value
  if (!el) return
  let target = el.querySelector('.cite-mark')
  if (!target && props.cite.page) {
    target = el.querySelector('.svm-page-marker[data-page="' + props.cite.page + '"]')
  }
  if (target) {
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    target.classList.add('cite-flash')
  }
}

const onKeydown = (e) => {
  if (e.key === 'Escape') emit('close')
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)

  const src = source.value
  if (!src || src.type === 'image') {
    loading.value = false
    return
  }

  try {
    let text = src.content || ''
    if (!text && src.url) {
      if (src.type === 'pdf') {
        text = await extractPdfTextFromUrl(src.url)
      } else {
        const res = await fetch(src.url)
        if (res.ok) text = await res.text()
      }
    }
    if (text) {
      let html = buildHighlighted(text, props.cite.quote)
      html = html.replace(/\[Page (\d+)\]/g, '<span class="svm-page-marker" data-page="$1">[Page $1]</span>')
      highlightedHtml.value = html
    }
  } catch (e) {
    console.error('Failed to load source content:', e)
  }

  loading.value = false
  await nextTick()
  scrollToTarget()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.svm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.svm-modal {
  width: min(820px, 100%);
  height: min(78vh, 720px);
  background: var(--bg-dark, #0b0b14);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
}

.svm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-light);
  background: rgba(0, 0, 0, 0.25);
}

.svm-heading {
  min-width: 0;
}

.svm-title {
  color: white;
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.svm-num {
  color: var(--accent-primary);
  margin-right: 0.35rem;
}

.svm-sub {
  color: var(--text-secondary);
  font-size: 0.78rem;
  margin-top: 0.15rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.svm-header-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

.svm-open-original {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.8rem;
  text-decoration: none;
  border: 1px solid var(--border-light);
  padding: 0.4rem 0.7rem;
  border-radius: 8px;
  transition: all 0.2s;
}

.svm-open-original:hover {
  color: white;
  border-color: var(--accent-primary);
}

.svm-close-btn {
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.svm-close-btn:hover {
  color: white;
  border-color: var(--danger-color, #ef4444);
}

.svm-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  position: relative;
}

.svm-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  height: 100%;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.svm-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border-light);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: svm-spin 0.8s linear infinite;
}

@keyframes svm-spin {
  to { transform: rotate(360deg); }
}

.svm-image {
  max-width: 100%;
  max-height: calc(100% - 70px);
  object-fit: contain;
  border-radius: 12px;
  display: block;
  margin: 0 auto;
  border: 1px solid var(--border-light);
}

.svm-text {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary, #e5e7eb);
  font-size: 0.9rem;
  line-height: 1.75;
  font-family: var(--font-body, inherit);
}

.svm-text :deep(.svm-page-marker) {
  display: inline-block;
  color: var(--accent-primary);
  font-weight: 700;
  font-size: 0.75rem;
  margin: 0.75rem 0 0.25rem;
  opacity: 0.85;
}

.svm-empty {
  color: var(--text-secondary);
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 2rem 0;
  text-align: center;
}

.svm-empty a {
  color: var(--accent-primary);
  text-decoration: underline;
}

.svm-quote-chip {
  position: sticky;
  bottom: 0;
  margin-top: 1rem;
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  background: rgba(141, 30, 227, 0.12);
  border: 1px solid rgba(141, 30, 227, 0.35);
  border-radius: 10px;
  padding: 0.6rem 0.9rem;
  font-size: 0.82rem;
  color: var(--text-primary, #e5e7eb);
}

.svm-quote-label {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent-primary);
}

.svm-quote-text {
  font-style: italic;
}
</style>