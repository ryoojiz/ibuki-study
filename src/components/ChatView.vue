<template>
  <div class="chat-container">
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
      <button @click="clearHistory" class="btn-clear-chat">
        {{ t('chat.clearHistory') }}
      </button>
    </div>

    <div class="chat-messages" ref="chatWindow">
      <div v-for="(msg, index) in messages" :key="index" :class="['message-wrapper', msg.sender === 'user' ? 'user-msg' : 'ai-msg']">
        <div class="message-bubble">
          <div class="message-content" @click="onBubbleClick($event, messageView(msg).refs)">
            <template v-if="msg.sender === 'ai'">
              <div 
                v-for="(line, lIdx) in splitIntoLines(messageView(msg).html)" 
                :key="lIdx"
                class="fade-in-line"
                :style="{ animationDelay: `${lIdx * 0.1}s` }"
                v-html="line"
              ></div>
            </template>
            <template v-else>
              <div v-html="messageView(msg).html"></div>
            </template>
            <!-- Sources accordion: shown only for AI messages with citations -->
            <details v-if="msg.sender === 'ai' && messageView(msg).refs.length" class="citation-accordion">
              <summary class="citation-accordion-title">{{ t('chat.sources') }}</summary>
              <div class="citation-footer">
                <button
                  v-for="cite in messageView(msg).refs"
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
      <form @submit.prevent="sendMessage" class="chat-form">
        <input
          v-model="userInput"
          type="text"
          :placeholder="t('chat.placeholder')"
          :disabled="isTyping"
        >
        <button type="submit" :disabled="!userInput.trim() || isTyping">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 2"></polygon></svg>
        </button>
      </form>
    </div>

    <SourceViewerModal v-if="activeCite" :cite="activeCite" @close="activeCite = null" />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { dbService } from '../services/db'
import { aiService } from '../services/ai'
import { citationsService } from '../services/citations'
import { i18n } from '../services/i18n'
import SourceViewerModal from './SourceViewerModal.vue'

const t = i18n.t
const NL = String.fromCharCode(10)

const props = defineProps(['notebookId', 'subject', 'globalMode'])
const notebook = ref(null)
const subjectNotebooks = ref([])
const allNotebooks = ref([])
const messages = ref([])
const userInput = ref('')
const isTyping = ref(false)
const chatWindow = ref(null)

// Numbered [1]..[N] registry of every source visible to this chat
const sourceRegistry = ref([])
// Currently opened citation in the source viewer modal
const activeCite = ref(null)

// Unique storage scope per chat mode: notebook id, subject namespace, or global
const chatScopeId = computed(() => {
  if (props.subject) return `subject:${props.subject}`
  if (props.globalMode) return 'global_chat'
  return props.notebookId
})

onMounted(async () => {
  try {
    if (props.subject) {
      subjectNotebooks.value = await dbService.getNotebooksBySubject(props.subject)
      sourceRegistry.value = citationsService.buildSourceRegistry(subjectNotebooks.value)
    } else if (props.globalMode) {
      allNotebooks.value = await dbService.getAllNotebooks()
      sourceRegistry.value = citationsService.buildSourceRegistry(allNotebooks.value)
    } else if (props.notebookId) {
      notebook.value = await dbService.getNotebook(props.notebookId)
      sourceRegistry.value = citationsService.buildSourceRegistry(notebook.value ? [notebook.value] : [])
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
    text: m.content
  }))
  scrollToBottom()
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatWindow.value) {
    chatWindow.value.scrollTop = chatWindow.value.scrollHeight
  }
}

// Build the factual context block sent to the LLM, annotated with the
// numbered sources of each notebook so citations map back correctly.
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

  if (props.subject) {
    return subjectNotebooks.value.map(notebookBlock).join(NL + NL + '=====' + NL + NL)
  }
  if (props.globalMode) {
    // Aggregate context across ALL notebooks for the global assistant
    return allNotebooks.value
      .map(nb => {
        const meta = 'Notebook: "' + nb.title + '" (Subject: ' + nb.subject + ', Topic: ' + nb.material + ')'
        return notebookBlock(nb) + NL + meta
      })
      .join(NL + NL + '=====' + NL + NL)
      .slice(0, 30000) // keep prompt within a sane size
  }
  if (notebook.value) {
    return notebookBlock(notebook.value)
  }
  return ''
}

const sendMessage = async () => {
  const text = userInput.value.trim()
  if (!text || isTyping.value) return

  userInput.value = ''
  const userMsg = { sender: 'user', text }
  messages.value.push(userMsg)

  try {
    await dbService.saveChatMessage({
      notebookId: chatScopeId.value,
      role: 'user',
      content: text
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

  try {
    await aiService.chat(
      messages.value.map(m => ({ sender: m.sender, text: m.text })),
      chatTitle,
      chatType,
      contextText,
      (chunk) => {
        aiResponseText = chunk
        messages.value[aiMsgIndex].text = chunk
        scrollToBottom()
      },
      sourceRegistry.value
    )

    if (!aiResponseText || !aiResponseText.trim()) {
      // Never persist blank bubbles — surface the failure instead
      messages.value[aiMsgIndex] = {
        sender: 'ai',
        text: t('chat.emptyResponse')
      }
    } else {
      // A persistence failure must never destroy a successfully streamed reply
      try {
        await dbService.saveChatMessage({
          notebookId: chatScopeId.value,
          role: 'assistant',
          content: aiResponseText
        })
      } catch (saveErr) {
        console.error('Failed to persist assistant message:', saveErr)
      }
    }

  } catch (e) {
    console.error('Chat error:', e)
    messages.value[aiMsgIndex] = {
      sender: 'ai',
      text: t('chat.error', { message: e.message || 'unknown error' })
    }
  } finally {
    isTyping.value = false
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
  }
}

// Cached render of each message into HTML + extracted citation refs
const viewCache = new WeakMap()
const messageView = (msg) => {
  let cached = viewCache.get(msg)
  if (!cached || cached.text !== msg.text) {
    cached = {
      text: msg.text,
      view: citationsService.renderMarkdownWithCitations(msg.text, sourceRegistry.value)
    }
    viewCache.set(msg, cached)
  }
  return cached.view
}

// Event delegation: clicks on .cite-ref pills inside rendered HTML
const onBubbleClick = (event, refs) => {
  const el = event.target.closest('.cite-ref')
  if (!el || el.classList.contains('cite-ref-missing')) return
  const num = parseInt(el.dataset.citeNum, 10)
  const cite = refs.find(r => r.num === num)
  if (cite && cite.source) openSource(cite)
}

const openSource = (cite) => {
  activeCite.value = cite
}

const splitIntoLines = (html) => {
  if (!html) return []
  // remove outer <p> and </p>
  const trimmed = html.replace(/^<p>/, '').replace(/<\/p>$/, '')
  return trimmed.split('</p><p>')
}
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-dark);
  overflow: hidden;
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
  animation: fade-in-line 0.5s ease forwards;
  opacity: 0;
}

@keyframes fade-in-line {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
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
</style>