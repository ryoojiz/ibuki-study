<template>
  <div class="flashcard-container">
    <div class="flashcard-header">
      <button @click="$emit('back')" class="btn-back">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      </button>
      <div class="header-title">
        <h2>{{ title }}</h2>
        <p>{{ currentIndex + 1 }} / {{ flashcards.length }}</p>
      </div>
    </div>

    <div class="study-area">
      <div 
        class="card-perspective" 
        @click="isFlipped = !isFlipped"
      >
        <div class="card-inner" :class="{ 'is-flipped': isFlipped }">
          <!-- Front: Question -->
          <div class="card-face card-front">
            <div class="card-label">QUESTION</div>
            <div class="card-content" v-html="flashcards[currentIndex].question"></div>
            <div class="flip-hint">Click to flip</div>
          </div>
          <!-- Back: Answer -->
          <div class="card-face card-back">
            <div class="card-label">ANSWER</div>
            <div class="card-content" v-html="flashcards[currentIndex].answer"></div>
            <div class="flip-hint">Click to see question</div>
          </div>
        </div>
      </div>

      <div class="card-controls">
        <button 
          @click="prevCard" 
          :disabled="currentIndex === 0" 
          class="ctrl-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        
        <button 
          @click="isFlipped = !isFlipped" 
          class="ctrl-btn flip-btn"
        >
          {{ isFlipped ? 'Show Question' : 'Show Answer' }}
        </button>

        <button 
          @click="nextCard" 
          :disabled="currentIndex === flashcards.length - 1" 
          class="ctrl-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  title: String,
  flashcards: {
    type: Array,
    required: true
  }
})

const currentIndex = ref(0)
const isFlipped = ref(false)

const nextCard = () => {
  if (currentIndex.value < props.flashcards.length - 1) {
    isFlipped.value = false
    currentIndex.value++
  }
}

const prevCard = () => {
  if (currentIndex.value > 0) {
    isFlipped.value = false
    currentIndex.value--
  }
}
</script>

<style scoped>
.flashcard-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-dark);
  color: white;
  overflow: hidden;
}

.flashcard-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.2);
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

.header-title {
  display: flex;
  flex-direction: column;
}

.header-title h2 {
  font-size: 1.1rem;
  margin: 0;
}

.header-title p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0;
}

.study-area {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 3rem;
}

.card-perspective {
  width: 100%;
  max-width: 600px;
  height: 400px;
  perspective: 1000px;
  cursor: pointer;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.card-inner.is-flipped {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  width: 100%;
  height: 100%;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  border-radius: 24px;
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}

.card-back {
  transform: rotateY(180deg);
  background: linear-gradient(135deg, var(--bg-card) 0%, #1a1a2e 100%);
}

.card-label {
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  font-size: 0.7rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.card-content {
  font-size: 1.4rem;
  line-height: 1.6;
  color: var(--text-primary);
  max-width: 80%;
}

.card-content :deep(p) {
  margin: 0;
}

.flip-hint {
  position: absolute;
  bottom: 1.5rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  font-style: italic;
}

.card-controls {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.ctrl-btn {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  color: white;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.ctrl-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ctrl-btn:not(:disabled):hover {
  background: var(--border-light);
  transform: scale(1.1);
}

.flip-btn {
  width: auto;
  padding: 0 1.5rem;
  border-radius: 28px;
  font-weight: 600;
  background: var(--accent-gradient);
  border: none;
}

.flip-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
}
</style>