<template>
  <div class="chat-container">
    <div class="chat-header">
      <div class="chat-title">
        <button @click="$emit('back')" class="btn-back">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <div>
          <h2>AI Study Assistant</h2>
          <p v-if="subject">Chatting about {{ subject }}</p>
          <p v-else-if="notebook">Chatting about {{ notebook?.title }}</p>
          <p v-else>Global Study Assistant</p>
        </div>
      </div>
      <button @click="clearHistory" class="btn-clear-chat">
        Clear History
      </button>
    </div>

    <div class="chat-messages" ref="chatWindow">
      <div v-for="(msg, index) in messages" :key="index" :class="['message-wrapper', msg.sender === 'user' ? 'user-msg' : 'ai-msg']">
        <div class="message-bubble">
          <div v-html="renderMarkdown(msg.text)"></div>
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
          placeholder="Ask a question about your notes..." 
          :disabled="isTyping"
        >
        <button type="submit" :disabled="!userInput.trim() || isTyping">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 //2"></polygon></svg>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { dbService } from '../services/db'
import { aiService } from '../services/ai'

const props = defineProps(['notebookId', 'subject'])
const notebook = ref(null)
const subjectNotebooks = ref([])
const messages = ref([])
const userInput = ref('')
const isTyping = ref(false)
const chatWindow = ref(null)

onMounted(async () => {
  try {
    if (props.subject) {
      subjectNotebooks.value = await dbService.getNotebooksBySubject(props.subject)
    } else if (props.notebookId) {
      notebook.value = await dbService.getNotebook(props.notebookId)
    }
    await loadHistory()
  } catch (e) {
    console.error('Failed to initialize chat:', e)
  }
})

const loadHistory = async () => {
  const chatId = props.subject ? `subject:${props.subject}` : props.notebookId
  const history = await dbService.getChatHistory(chatId)
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

const sendMessage = async () => {
  const text = userInput.value.trim()
  if (!text || isTyping.value) return

  userInput.value = ''
  const userMsg = { sender: 'user', text }
  messages.value.push(userMsg)
  
  const chatId = props.subject ? `subject:${props.subject}` : props.notebookId

  try {
    await dbService.saveChatMessage({
      notebookId: chatId,
      role: 'user',
      content: text
    })
    
    scrollToBottom()
    
    isTyping.value = true
    
    // Prepare context for AI
    let contextText = ''
    if (props.subject) {
      contextText = subjectNotebooks.value
        .map(nb => `Notebook: ${nb.title}\nSummary: ${nb.summary}\nTranscription: ${nb.transcription}`)
        .join('\n\n---\n\n')
    } else if (notebook.value) {
      contextText = `Title: ${notebook.value.title}\nSummary: ${notebook.value.summary}\nTranscription: ${notebook.value.transcription}`
    }
    
    let aiResponseText = ''
    const aiMsgIndex = messages.value.length
    messages.value.push({ sender: 'ai', text: '' })

    const chatTitle = props.subject ? props.subject : (notebook.value?.title || 'Global Knowledge')
    const chatType = props.subject ? 'Subject Assistant' : (notebook.value ? 'Notebook' : 'Global Study Assistant')

    await aiService.chat(
      messages.value.map(m => ({ sender: m.sender, text: m.text })),
      chatTitle,
      chatType,
      contextText,
      (chunk) => {
        aiResponseText = chunk
        messages.value[aiMsgIndex].text = chunk
        scrollToBottom()
      }
    )

    await dbService.saveChatMessage({
      notebookId: chatId,
      role: 'assistant',
      content: aiResponseText
    })

  } catch (e) {
    console.error('Chat error:', e)
    messages.value.push({ sender: 'ai', text: 'Sorry, I encountered an error. Please try again.' })
  } finally {
    isTyping.value = false
    scrollToBottom()
  }
}

const clearHistory = async () => {
  const chatId = props.subject ? `subject:${props.subject}` : props.notebookId
  const contextName = props.subject ? `subject ${props.subject}` : (notebook.value?.title || 'this assistant')
  
  if (confirm(`Clear all chat history for ${contextName}?`)) {
    await dbService.clearChatHistory(chatId)
    messages.value = []
  }
}

const renderMarkdown = (text) => {
  if (!text) return ''
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
    .replace(/\[Source (\d+)(, Page \d+)?\]/g, (match, sourceNum) => {
      const sourceIndex = parseInt(sourceNum) - 1;
      const source = notebook.value?.sources?.[sourceIndex];
      if (source && source.url) {
        return `<a href="${source.url}" target="_blank" class="citation-link">${match}</a>`;
      }
      return match;
    })
  return html
}
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-dark);
  border-radius: 16px;
  border: 1px solid var(--border-light);
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