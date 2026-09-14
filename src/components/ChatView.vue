<template>
  <div class="chat-container">
    <div class="chat-main">
      <div class="chat-header">
        <div class="chat-title">
          <button @click="$emit('back')" class="btn-back">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <div>
            <h2>{{ t('chat.coach') }}</h2>
            <p v-if="subject">{{ t('chat.gettingUpToSpeedSubject', { subject }) }}</p>
            <p v-else-if="notebook">{{ t('chat.gettingUpToSpeedNotebook', { title: notebook?.title }) }}</p>
            <p v-else>{{ t('chat.acrossAll') }}</p>
          </div>
        </div>
        <div class="chat-header-actions">
          <button @click="toggleCtxSidebar" :class="['btn-panel-toggle', { active: isCtxOpen }]" :title="t('ctx.toggle')">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>
          </button>
          <button @click="clearHistory" class="btn-clear-chat">
            {{ t('chat.clearHistory') }}
          </button>
        </div>
      </div>

      <div v-if="selectionDirty" class="ctx-changed-banner">
        <span>{{ t('ctx.changedNotice') }}</span>
        <button @click="selectionDirty = false">&times;</button>
      </div>

      <div class="chat-messages" ref="chatWindow">
        <div v-for="(msg, index) in messages" :key="index" :class="['message-wrapper', msg.sender === 'user' ? 'user-msg' : 'ai-msg']">
          <div class="message-bubble">
            <div class="message-content" @click="onBubbleClick($event, parseMessage(msg).refs)">
              <template v-if="msg.sender === 'ai'">
                <template v-for="(chunk, cIdx) in parseMessage(msg).chunks" :key="cIdx">
                  <template v-if="chunk.type === 'text'">
                    <div
                      v-for="(line, lIdx) in splitHtmlIntoLines(chunk.content)"
                      :key="lIdx"
                      class="fade-in-line"
                      :style="{ animationDelay: `${(cIdx * 2 + lIdx) * 0.15}s` }"
                      v-html="line"
                    ></div>
                  </template>
                  <details
                    v-else-if="chunk.type === 'thinking'"
                    class="thinking-block"
                    :open="isThinkingOpen && index === messages.length - 1"
                  >
                    <summary>{{ t('chat.thinking') || 'Thinking...' }}</summary>
                    <div class="thinking-content">{{ chunk.content }}</div>
                  </details>
                    <ToolCall
                     v-else-if="chunk.type === 'tool'"
                     :tool="chunk.tool"
                    :params="chunk.params"
                    :notebookId="props.notebookId"
                    :source-message="findTriggeringMessage(index)"
                    :onAction="handleToolAction"
                     @openFlashcards="e => $emit('openFlashcards', e)"
                     @openQuiz="e => $emit('openQuiz', e)"
                   />
                </template>
              </template>
              <template v-else>
                <div v-if="msg.meta?.attachments?.length" class="chat-attachments">
                  <a v-for="attachment in msg.meta.attachments" :key="attachment.url" :href="attachment.url" target="_blank" rel="noopener">
                    <img :src="attachment.url" :alt="attachment.name">
                  </a>
                </div>
                <div v-html="citationsService.renderMarkdownWithCitations(msg.text, sourceRegistry).html"></div>
              </template>
              <!-- Sources accordion: shown only for AI messages with citations -->
              <details v-if="msg.sender === 'ai' && parseMessage(msg).refs.length" class="citation-accordion">
                <summary class="citation-accordion-title">{{ t('chat.sources') }}</summary>
                <div class="citation-footer">
                  <button
                    v-for="cite in parseMessage(msg).refs"
                    :key="cite.num"
                    class="citation-footer-item"
                    :disabled="!cite.source"
                    @click="openSource(cite)"
                  >
                    <span class="cf-num">[{{ cite.num }}]</span>
                    <span class="cf-body">
                      <span class="cf-name">{{ cite.source ? cite.source.name : t('chat.unknownSource') }}</span>
                      <span class="cf-meta" v-if="cite.source">{{ cite.source.notebookTitle }}<template v-if="cite.page"> &middot; {{ t('chat.page', { n: cite.page }) }}</template></span>
                      <span class="cf-quote" v-if="cite.quote">&ldquo;{{ cite.quote }}&rdquo;</span>
                    </span>
                  </button>
                </div>
              </details>
            </div>
          </div>
        </div>
        <div v-if="isTyping" class="message-wrapper ai-msg">
          <div class="message-bubble typing">
            <div class="typing-dots"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>

      <div class="chat-input-area">
        <div v-if="pendingAttachments.length" class="pending-attachments">
          <div v-for="(attachment, index) in pendingAttachments" :key="attachment.preview" class="pending-attachment">
            <img :src="attachment.preview" :alt="attachment.name">
            <button type="button" @click="removeAttachment(index)" :aria-label="t('chat.removeImage')">×</button>
          </div>
        </div>
        <form @submit.prevent="sendMessage" class="chat-form">
          <input ref="imageInput" type="file" accept="image/*" multiple class="hidden" @change="selectImages">
          <button type="button" class="btn-attach" :title="t('chat.attachImage')" :disabled="isTyping" @click="imageInput?.click()">+</button>
          <input
            v-model="userInput"
            type="text"
            :placeholder="t('chat.placeholder')"
            :disabled="isTyping"
          >
          <button type="submit" :disabled="(!userInput.trim() && !pendingAttachments.length) || isTyping">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 2"></polygon></svg>
          </button>
        </form>
      </div>

      <div v-if="materialPreview" class="material-preview-backdrop">
        <div class="material-preview" role="dialog" aria-modal="true">
          <h3>{{ t('chat.materialPreview') }}</h3>
          <label>{{ t('create.title') }}<input v-model="materialPreview.title"></label>
          <label>{{ t('create.subject') }}<input v-model="materialPreview.subject"></label>
          <label>{{ t('create.material') }}<input v-model="materialPreview.material"></label>
          <label>{{ t('create.summaryMarkdown') }}<textarea v-model="materialPreview.summary"></textarea></label>
          <label>{{ t('create.transcription') }}<textarea v-model="materialPreview.transcription"></textarea></label>
          <p v-if="materialSaveError" class="generation-error">{{ materialSaveError }}</p>
          <div class="preview-actions">
            <button @click="materialPreview = null">{{ t('common.cancel') }}</button>
            <button :disabled="isSavingMaterial" @click="saveGeneratedMaterial">{{ isSavingMaterial ? t('chat.savingMaterial') : t('common.save') }}</button>
          </div>
        </div>
      </div>

      <SourceViewerModal v-if="activeCite" :cite="activeCite" @close="activeCite = null" />
    </div>

    <transition name="ctx-slide">
      <ChatContextSidebar
        v-if="isCtxOpen"
        class="chat-ctx-sidebar"
        :tree="materialsTree"
        :grouped-notebooks="groupedNotebooks"
        :all-notebooks="allNotebooks"
        :selected-ids="selectedIds"
        @update:selectedIds="onSelectionChange"
        @close="toggleCtxSidebar"
      />
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { dbService } from '../services/db'
import { aiService } from '../services/ai'
import { citationsService } from '../services/citations'
import { materialsService } from '../services/materials'
import { pdfService } from '../services/pdf'
import { i18n } from '../services/i18n'
import SourceViewerModal from './SourceViewerModal.vue'
import ToolCall from './ToolCall.vue'
import ChatContextSidebar from './ChatContextSidebar.vue'

const t = i18n.t
const NL = String.fromCharCode(10)

const props = defineProps(['notebookId', 'subject', 'globalMode'])
const emit = defineEmits(['back', 'openFlashcards', 'openQuiz', 'openMaterial'])
const notebook = ref(null)
const messages = ref([])
const userInput = ref('')
const isTyping = ref(false)
const isThinkingOpen = ref(false)
const chatWindow = ref(null)
const imageInput = ref(null)
const pendingAttachments = ref([])
const materialPreview = ref(null)
const isSavingMaterial = ref(false)
const materialSaveError = ref('')

// ---- Materials tree + selection state -------------------------------------
const materialsFlat = ref([])
const materialsTree = computed(() => materialsService.buildTree(materialsFlat.value))
const allNotebooks = ref([])
const groupedNotebooks = computed(() => materialsService.groupNotebooksByMaterial(allNotebooks.value))

// Selection = Set of notebook ids included in context/citations
const selectedIds = ref(new Set())
// Sidebar visibility (persisted per scope)
const isCtxOpen = ref(true)
// Shows a notice when the selection changed mid-conversation
const selectionDirty = ref(false)

// Unique storage scope per chat mode: notebook id, subject namespace, or global
const chatScopeId = computed(() => {
  if (props.subject) return `subject:${props.subject}`
  if (props.globalMode) return 'global_chat'
  return props.notebookId
})

const ctxStorageKey = computed(() => `ibuki_chat_ctx::${chatScopeId.value}`)
const sidebarStorageKey = computed(() => `ibuki_chat_sidebar::${chatScopeId.value}`)

// Registry of every source visible to this chat, rebuilt reactively from the
// current selection ([1]..[N] shared by the LLM prompt and the renderer).
const sourceRegistry = computed(() =>
  citationsService.buildSourceRegistry(selectedNotebooks.value)
)

const selectedNotebooks = computed(() =>
  allNotebooks.value.filter(nb => selectedIds.value.has(nb.id))
)

function persistSelection() {
  try {
    localStorage.setItem(ctxStorageKey.value, JSON.stringify([...selectedIds.value]))
  } catch (e) { /* ignore quota errors */ }
}

function onSelectionChange(nextSet) {
  const changed = nextSet.size !== selectedIds.value.size ||
    [...nextSet].some(id => !selectedIds.value.has(id))
  selectedIds.value = nextSet
  persistSelection()
  if (changed && messages.value.length > 0) selectionDirty.value = true
}

function toggleCtxSidebar() {
  isCtxOpen.value = !isCtxOpen.value
  try {
    localStorage.setItem(sidebarStorageKey.value, JSON.stringify(isCtxOpen.value))
  } catch (e) { /* ignore */ }
}

/** Compute default selection for this scope. */
const computeDefaultSelection = () => {
  if (props.notebookId) {
    // Notebook chat: pre-check this notebook's own branch entry
    return new Set(
      allNotebooks.value.filter(nb => nb.id === props.notebookId).map(nb => nb.id)
    )
  }
  if (props.subject) {
    return new Set(
      allNotebooks.value.filter(nb => nb.subject === props.subject).map(nb => nb.id)
    )
  }
  return new Set(allNotebooks.value.map(nb => nb.id))
}

onMounted(async () => {
  try {
    // Restore sidebar visibility preference
    try {
      const savedOpen = localStorage.getItem(sidebarStorageKey.value)
      if (savedOpen !== null) isCtxOpen.value = JSON.parse(savedOpen)
    } catch (e) { /* ignore */ }

    // Load the full tree + notebooks in EVERY mode so the selector can pull
    // in extra material branches regardless of the chat's origin.
    const [mats, nbs] = await Promise.all([
      dbService.getMaterials().catch(() => []),
      dbService.getAllNotebooks()
    ])
    materialsFlat.value = mats
    allNotebooks.value = nbs

    if (props.notebookId) {
      notebook.value = nbs.find(nb => nb.id === props.notebookId) || null
    }

    // Restore persisted selection (filtered to existing notebooks), else default
    let restored = null
    try {
      const raw = localStorage.getItem(ctxStorageKey.value)
      if (raw) restored = new Set(JSON.parse(raw))
    } catch (e) { /* ignore */ }
    const validIds = new Set(nbs.map(nb => nb.id))
    if (restored && restored.size > 0) {
      selectedIds.value = new Set([...restored].filter(id => validIds.has(id)))
    }
    if (selectedIds.value.size === 0) {
      selectedIds.value = computeDefaultSelection()
    }

    await loadHistory()
  } catch (e) {
    console.error('Failed to initialize chat:', e)
  }
})

const loadHistory = async () => {
  const history = await dbService.getChatHistory(chatScopeId.value)
  messages.value = history.map(m => ({
    sender: m.role === 'user' ? 'user' : 'ai',
    text: m.content,
    meta: m.meta || null
  }))
  scrollToBottom()
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatWindow.value) {
    chatWindow.value.scrollTop = chatWindow.value.scrollHeight
  }
}

/**
 * Effective registry for rendering a specific message: historical messages
 * were answered against the registry snapshot stored in chats.meta, so old
 * citation numbers stay correct even after the user changes the selection.
 */
const registryFor = (msg) => {
  const snap = msg?.meta?.sources
  if (Array.isArray(snap) && snap.length) {
    return snap.map(s => ({
      ...s,
      content: sourceRegistry.value.find(r => r.num === s.num)?.content ?? s.content ?? null
    }))
  }
  return sourceRegistry.value
}

// Build the factual context block sent to the LLM (from SELECTED notebooks only)
const buildContextText = () => {
  const notebookBlock = (nb) => {
    const nums = sourceRegistry.value
      .filter(r => r.notebookId === nb.id)
      .map(r => '[' + r.num + '] ' + r.name)
    return (
      '--- Notebook: "' + nb.title + '" ---' + NL +
      'Sources: ' + (nums.length ? nums.join(', ') : 'none') + NL +
      'Summary: ' + (nb.summary || '') + NL +
      'Transcription: ' + (nb.transcription || '')
    )
  }

  const list = selectedNotebooks.value
  if (!list.length) return ''

  if (props.globalMode) {
    return list
      .map(nb => {
        const meta = 'Notebook: "' + nb.title + '" (Subject: ' + nb.subject + ', Topic: ' + nb.material + ')'
        return notebookBlock(nb) + NL + meta
      })
      .join(NL + NL + '=====' + NL + NL)
      .slice(0, 30000)
  }
  return list.map(notebookBlock).join(NL + NL + '=====' + NL + NL)
}

const selectImages = (event) => {
  const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/'))
  pendingAttachments.value.push(...files.map(file => ({
    file,
    name: file.name,
    preview: URL.createObjectURL(file)
  })))
  event.target.value = ''
}

const removeAttachment = (index) => {
  const [removed] = pendingAttachments.value.splice(index, 1)
  if (removed?.preview) URL.revokeObjectURL(removed.preview)
}

const findTriggeringMessage = (assistantIndex) => {
  for (let index = assistantIndex - 1; index >= 0; index--) {
    if (messages.value[index].sender === 'user') return messages.value[index]
  }
  return null
}

const sendMessage = async () => {
  const text = userInput.value.trim()
  if ((!text && !pendingAttachments.value.length) || isTyping.value) return

  let attachments = []
  try {
    attachments = await Promise.all(pendingAttachments.value.map(item => dbService.uploadChatImage(item.file)))
  } catch (e) {
    console.error('Failed to upload chat image:', e)
    alert(t('chat.imageUploadFailed', { message: e.message || 'unknown error' }))
    return
  }

  pendingAttachments.value.forEach(item => URL.revokeObjectURL(item.preview))
  pendingAttachments.value = []
  userInput.value = ''
  const userMsg = { sender: 'user', text, meta: { attachments } }
  messages.value.push(userMsg)

  try {
    await dbService.saveChatMessage({
      notebookId: chatScopeId.value,
      role: 'user',
      content: text,
      meta: { attachments }
    })
  } catch (e) {
    console.error('Failed to persist user message:', e)
  }

  scrollToBottom()
  isTyping.value = true

  const contextText = buildContextText()

  const aiMsgIndex = messages.value.length
  messages.value.push({ sender: 'ai', text: '' })
  let aiResponseText = ''

  const chatTitle = props.subject ? props.subject : (notebook.value?.title || t('chat.allNotebooks'))
  const chatType = props.subject ? t('chat.subjectAssistant') : (props.globalMode ? t('chat.globalStudyAssistant') : t('chat.notebook'))

  // Snapshot of the registry at send time -> stored with the assistant
  // message so its citations keep resolving after selection changes.
  const registrySnapshot = sourceRegistry.value.map(r => ({
    num: r.num,
    name: r.name,
    type: r.type,
    url: r.url,
    notebookTitle: r.notebookTitle
  }))

  try {
    isThinkingOpen.value = true;

    let streamingBuffer = '';
    let lastCommitTime = Date.now();
    const COMMIT_THRESHOLD = 60; // characters
    const HEARTBEAT_MS = 300;    // ms

    const commitToState = (textToCommit) => {
      if (!textToCommit) return;
      // Append committed text to the message in state
      messages.value[aiMsgIndex].text += textToCommit;
      scrollToBottom();
    };

    const checkAndCommit = (force = false) => {
      const now = Date.now();
      const hasNewline = streamingBuffer.includes('\n');
      const exceedsThreshold = streamingBuffer.length >= COMMIT_THRESHOLD;
      const heartbeatPassed = (now - lastCommitTime) >= HEARTBEAT_MS;

      if (force || hasNewline || exceedsThreshold || heartbeatPassed) {
        if (hasNewline && !force) {
          // Commit up to the last newline to keep structural integrity
          const lastNewlineIndex = streamingBuffer.lastIndexOf('\n');
          const toCommit = streamingBuffer.slice(0, lastNewlineIndex + 1);
          streamingBuffer = streamingBuffer.slice(lastNewlineIndex + 1);
          commitToState(toCommit);
        } else {
          // Commit everything
          commitToState(streamingBuffer);
          streamingBuffer = '';
        }
        lastCommitTime = now;
      }
    };

    await aiService.chat(
      messages.value.map(m => ({ sender: m.sender, text: m.text, attachments: m.meta?.attachments || [] })),
      chatTitle,
      chatType,
      contextText,
      (chunk) => {
        // aiService.chat returns the FULL accumulated text so far
        // We need to find the delta (newly added text)
        const delta = chunk.slice(aiResponseText.length);
        aiResponseText = chunk;

        streamingBuffer += delta;
        checkAndCommit();
      },
      sourceRegistry.value
    )

    // Final flush
    checkAndCommit(true);

    if (!aiResponseText || !aiResponseText.trim()) {
      messages.value[aiMsgIndex] = {
        sender: 'ai',
        text: t('chat.emptyResponse')
      }
    } else {
      messages.value[aiMsgIndex].meta = { sources: registrySnapshot }
      try {
        await dbService.saveChatMessage({
          notebookId: chatScopeId.value,
          role: 'assistant',
          content: aiResponseText,
          meta: { sources: registrySnapshot }
        })
      } catch (saveErr) {
        console.error('Failed to persist assistant message:', saveErr)
      }
    }

    selectionDirty.value = false

  } catch (e) {
    console.error('Chat error:', e)
    messages.value[aiMsgIndex] = {
      sender: 'ai',
      text: t('chat.error', { message: e.message || 'unknown error' })
    }
  } finally {
    isTyping.value = false
    isThinkingOpen.value = false
    scrollToBottom()
  }
}

const clearHistory = async () => {
  const contextName = props.subject
    ? t('chat.clearSubject', { subject: props.subject })
    : (props.globalMode ? t('chat.clearGlobal') : t('chat.clearNotebook', { title: notebook.value?.title || 'this notebook' }))

  if (confirm(t('chat.clearConfirm', { context: contextName }))) {
    await dbService.clearChatHistory(chatScopeId.value)
    messages.value = []
    selectionDirty.value = false
  }
}

  const parseMessage = (msg) => {
    const chunks = [];
    const refs = [];
    const reg = registryFor(msg);

    if (msg.sender !== 'ai') {
      return {
        chunks: [{ type: 'text', content: citationsService.renderMarkdownWithCitations(msg.text, reg).html }],
        refs: []
      };
    }

    // Regex to match <thinking>...</thinking> and <tool_call ... />
    const combinedRegex = /(<thinking>[\s\S]*?<\/thinking>)|(<tool_call\s+name="([^"]+)"\s+params='([^']+)'\s*\/>)/g;
    let lastIndex = 0;
    let match;

    while ((match = combinedRegex.exec(msg.text)) !== null) {
      // Text before the match
      const textBefore = msg.text.slice(lastIndex, match.index);
      if (textBefore) {
        const rendered = citationsService.renderMarkdownWithCitations(textBefore, reg);
        chunks.push({ type: 'text', content: rendered.html });
        refs.push(...rendered.refs);
      }

      if (match[1]) {
        // Thinking block
        const thinkingContent = match[1].replace(/<\/?thinking>/g, '').trim();
        chunks.push({ type: 'thinking', content: thinkingContent });
      } else if (match[2]) {
        // Tool call
        try {
          chunks.push({
            type: 'tool',
            tool: match[3],
            params: JSON.parse(match[4])
          });
        } catch (e) {
          chunks.push({ type: 'text', content: `<span class="tool-call-error">Invalid tool call: ${match[2]}</span>` });
        }
      }

      lastIndex = combinedRegex.lastIndex;
    }

    // Final text part
    const textAfter = msg.text.slice(lastIndex);
    if (textAfter) {
      const rendered = citationsService.renderMarkdownWithCitations(textAfter, reg);
      chunks.push({ type: 'text', content: rendered.html });
      refs.push(...rendered.refs);
    }

    return { chunks, refs };
  }

const handleToolAction = async ({ tool, params, kind, sourceMessage }) => {
  if (tool === 'suggest_generation') return handleGeneration({ kind }, sourceMessage)

  if (tool === 'generate_flashcards') {
    if (props.notebookId) {
      try {
        const currentNb = await dbService.getNotebook(props.notebookId);
        const existingCount = currentNb?.flashcards?.length || 0;
        const requestedCount = params.count || 10;

        // Skip generation only if we already have at least as many cards as requested
        if (existingCount >= requestedCount) {
          return;
        }
      } catch (e) {
        console.error('Error checking for existing flashcards:', e);
      }
    }

    const contextText = buildContextText();
    const cards = await aiService.generateFlashcards(contextText, params.focus, params.count);

    if (props.notebookId) {
      await dbService.saveFlashcards(props.notebookId, cards);
    } else {
      throw new Error('No active notebook found to save flashcards to.');
    }
  } else if (tool === 'generate_quiz') {
    if (!props.notebookId) {
      throw new Error('No active notebook found to save the quiz to.');
    }

    const contextText = buildContextText();
    const questions = await aiService.generateQuiz(contextText, {
      difficulty: params.difficulty,
      focus: params.focus,
      count: params.count
    });

    await dbService.saveQuiz({
      notebookId: props.notebookId,
      subject: null,
      difficulty: params.difficulty || 'medium',
      focus: params.focus || 'general',
      questions
    });
  } else {
    throw new Error(`Unsupported tool: ${tool}`);
  }
}

const handleGeneration = async ({ kind }, sourceMessage) => {
  if (!sourceMessage) throw new Error('No user message is available for generation.')

  const request = {
    text: sourceMessage.text,
    attachments: sourceMessage.meta?.attachments || [],
    contextText: buildContextText()
  }

  if (kind === 'guide') {
    const guide = await aiService.generateStudyGuide(request)
    const meta = {
      sources: sourceRegistry.value.map(source => ({
        num: source.num,
        name: source.name,
        type: source.type,
        url: source.url,
        notebookTitle: source.notebookTitle
      }))
    }
    messages.value.push({ sender: 'ai', text: guide, meta })
    await dbService.saveChatMessage({ notebookId: chatScopeId.value, role: 'assistant', content: guide, meta })
    await pdfService.exportStudyGuide({
      markdown: guide,
      title: sourceMessage.text,
      sourceRegistry: sourceRegistry.value
    })
    await scrollToBottom()
    return
  }

  if (kind === 'material') {
    materialSaveError.value = ''
    materialPreview.value = await aiService.generateMaterialFromChat(request)
    return
  }

  throw new Error('Unsupported generation choice.')
}

const saveGeneratedMaterial = async () => {
  if (!materialPreview.value) return

  isSavingMaterial.value = true
  materialSaveError.value = ''
  try {
    const saved = await dbService.saveNotebook(materialPreview.value)
    materialPreview.value = null
    emit('openMaterial', saved.id)
  } catch (e) {
    materialSaveError.value = e.message || 'Failed to save material.'
  } finally {
    isSavingMaterial.value = false
  }
}

const openSource = (cite) => {
  activeCite.value = cite
}

const activeCite = ref(null)

const onBubbleClick = (event, refs) => {
  const citeEl = event.target.closest('.cite-ref')
  if (citeEl && !citeEl.classList.contains('cite-ref-missing')) {
    const num = parseInt(citeEl.dataset.citeNum, 10)
    const cite = refs.find(r => r.num === num)
    if (cite && cite.source) openSource(cite)
  }
}

const splitHtmlIntoLines = (html) => {
  if (!html) return []
  // Remove outer <p> and </p> tags if present, then split by paragraph boundaries
  const trimmed = html.replace(/^<p>/, '').replace(/<\/p>$/, '')
  return trimmed.split('</p><p>')
}
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: row;
  height: 100%;
  background: var(--bg-dark);
  overflow: hidden;
  position: relative;
}

.chat-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
  position: relative;
}

.chat-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.2);
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.btn-panel-toggle {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.45rem;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.btn-panel-toggle:hover {
  background: var(--border-light);
  color: white;
}

.btn-panel-toggle.active {
  color: white;
  border-color: var(--accent-primary);
  background: rgba(99, 102, 241, 0.12);
}

.ctx-changed-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.45rem 1.5rem;
  font-size: 0.78rem;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.08);
  border-bottom: 1px solid rgba(251, 191, 36, 0.25);
}

.ctx-changed-banner button {
  background: none;
  border: none;
  color: inherit;
  font-size: 1rem;
  cursor: pointer;
  line-height: 1;
}

.btn-back {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s;
}

.btn-back:hover {
  background: var(--border-light);
  color: white;
}

.chat-title h2 {
  font-size: 1.1rem;
  margin: 0;
  color: white;
}

.chat-title p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0;
}

.btn-clear-chat {
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear-chat:hover {
  border-color: var(--danger-color);
  color: var(--danger-color);
}

.chat-messages {
  flex-grow: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message-wrapper {
  display: flex;
  width: 100%;
}

.user-msg {
  justify-content: flex-end;
}

.ai-msg {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 80%;
  padding: 0.8rem 1.2rem;
  border-radius: 16px;
  font-size: 0.95rem;
  line-height: 1.5;
}

.user-msg .message-bubble {
  background: var(--accent-gradient);
  color: white;
  border-bottom-right-radius: 4px;
}

.ai-msg .message-bubble {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-bottom-left-radius: 4px;
}

.fade-in-line {
  display: block;
  animation: chat-fade-in-line 0.5s ease-out both;
  opacity: 0;
  will-change: opacity, transform;
}

@keyframes chat-fade-in-line {
  from {
    color: var(--accent-primary);
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    color: var(--text-primary);
    opacity: 1;
    transform: translateY(0);
  }
}

.typing {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  min-height: 40px;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background: var(--text-muted);
  border-radius: 50%;
  animation: blink 1.4s infinite both;
}

.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}

.chat-input-area {
  padding: 1.5rem;
  border-top: 1px solid var(--border-light);
  background: rgba(0, 0, 0, 0.2);
}

.chat-form {
  display: flex;
  gap: 0.75rem;
  max-width: 800px;
  margin: 0 auto;
}

.chat-form input {
  flex-grow: 1;
  padding: 0.8rem 1.2rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  color: white;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.chat-form input:focus {
  outline: none;
  border-color: var(--accent-primary);
  background: rgba(255, 255, 255, 0.08);
}

.chat-form button {
  background: var(--accent-gradient);
  border: none;
  color: white;
  width: 45px;
  height: 45px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.chat-form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-form button:not(:disabled):hover {
  transform: scale(1.05);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
}

.hidden {
  display: none;
}

.btn-attach {
  flex: 0 0 auto;
  font-size: 1.35rem;
}

.pending-attachments {
  max-width: 800px;
  margin: 0 auto 0.6rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pending-attachment {
  position: relative;
}

.pending-attachment img,
.chat-attachments img {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid var(--border-light);
}

.pending-attachment button {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 0;
  background: #ef4444;
  color: white;
  cursor: pointer;
}

.chat-attachments {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-bottom: 0.45rem;
}

.material-preview-backdrop {
  backdrop-filter: blur(6px);
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  padding: 1rem;
}

.material-preview {
  width: min(720px, 100%);
  max-height: 90vh;
  overflow: auto;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 1.2rem;
  color: var(--text-primary);
}

.material-preview label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.7rem;
}

.material-preview input,
.material-preview textarea {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-light);
  color: white;
  border-radius: 7px;
  padding: 0.55rem;
}

.material-preview textarea {
  min-height: 120px;
  resize: vertical;
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
  margin-top: 1rem;
}

.preview-actions button {
  border: 1px solid var(--border-light);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.08);
  color: white;
  padding: 0.5rem 0.8rem;
  cursor: pointer;
}

.preview-actions button:last-child {
  background: var(--accent-gradient);
  border-color: transparent;
}

.generation-error {
  color: #f87171;
}

/* Sidebar transitions */
.ctx-slide-enter-active,
.ctx-slide-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}
.ctx-slide-enter-from,
.ctx-slide-leave-to {
  transform: translateX(40px);
  opacity: 0;
}

/* On narrow screens the sidebar floats over the chat */
@media (max-width: 900px) {
  .chat-ctx-sidebar {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    box-shadow: -8px 0 30px rgba(0, 0, 0, 0.45);
  }
}
</style>
