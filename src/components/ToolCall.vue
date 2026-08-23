<template>
  <div class="tool-call-container">
    <div 
      v-if="tool === 'generate_flashcards'" 
      class="tool-row"
      :class="{ 'success': isSuccess, 'error': hasError }"
      @click="handleRowClick"
      :style="{ cursor: isSuccess ? 'pointer' : 'default' }"
    >
      <div class="tool-left">
        <div class="tool-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"></path></svg>
        </div>
        <div class="tool-info">
          <div class="tool-title">Generate Flashcards</div>
          <div class="tool-status" :class="{ 'loading-gradient': isLoading }">
            <span v-if="isLoading">Generating {{ params.count || 10 }} Cards</span>
            <span v-else-if="isSuccess">Generated {{ params.count || 10 }} Cards</span>
            <span v-else-if="hasError" class="error-text">Tool Failed</span>
            <span v-else>Preparing...</span>
          </div>
        </div>
      </div>
      <div v-if="isSuccess" class="tool-arrow">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    </div>
    <div 
      v-else-if="tool === 'generate_quiz'" 
      class="tool-row"
      :class="{ 'success': isSuccess, 'error': hasError }"
      @click="handleRowClick"
      :style="{ cursor: isSuccess ? 'pointer' : 'default' }"
    >
      <div class="tool-left">
        <div class="tool-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
        </div>
        <div class="tool-info">
          <div class="tool-title">Generate Quiz</div>
          <div class="tool-status" :class="{ 'loading-gradient': isLoading }">
            <span v-if="isLoading">Generating Quiz</span>
            <span v-else-if="isSuccess">Quiz Generated</span>
            <span v-else-if="hasError" class="error-text">Tool Failed</span>
            <span v-else>Preparing...</span>
          </div>
        </div>
      </div>
      <div v-if="isSuccess" class="tool-arrow">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    </div>
    <div v-else class="tool-row unknown-tool">
      <div class="tool-info">Unknown tool: {{ tool }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { aiService } from '../services/ai'
import { dbService } from '../services/db'

const props = defineProps({
  tool: String,
  params: Object,
  notebookId: String,
  onAction: Function
})

const emit = defineEmits(['actionCompleted', 'openFlashcards', 'openQuiz'])

const isLoading = ref(false)
const isSuccess = ref(false)
const hasError = ref(false)

const handleAction = async () => {
  if (props.tool === 'generate_flashcards' || props.tool === 'generate_quiz') {
    if (!props.notebookId) {
      console.error('No active notebook found to save flashcards to.');
      hasError.value = true;
      return;
    }

    isLoading.value = true;
    hasError.value = false;
    try {
      if (props.onAction) {
        await props.onAction({ tool: props.tool, params: props.params });
      } else {
        console.error('onAction prop not provided');
        throw new Error('Tool action handler missing');
      }
      isSuccess.value = true;
    } catch (e) {
      console.error('Tool execution failed:', e);
      hasError.value = true;
    } finally {
      isLoading.value = false;
    }
  }
}

const handleRowClick = () => {
  if (isSuccess.value && props.notebookId) {
    if (props.tool === 'generate_quiz') {
      emit('openQuiz', props.notebookId);
    } else {
      emit('openFlashcards', props.notebookId);
    }
  }
}

onMounted(() => {
  handleAction();
})
</script>

<style scoped>
.tool-call-container {
  margin: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tool-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
  cursor: default;
  user-select: none;
}

.tool-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
}

.tool-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.tool-title {
  font-weight: 600;
  font-size: 1rem;
  color: white;
}

.tool-status {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.loading-gradient {
  background: linear-gradient(
    90deg, 
    var(--text-secondary) 0%, 
    #ffffff 50%, 
    var(--text-secondary) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer 2s linear infinite;
}

@keyframes shimmer {
  to {
    background-position: 200% center;
  }
}

.error-text {
  color: #ef4444;
}

.tool-arrow {
  color: var(--text-secondary);
  display: flex;
  align-items: center;
}

.unknown-tool {
  opacity: 0.5;
}
</style>