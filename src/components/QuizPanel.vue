<template>
  <div class="quiz-panel">
    <!-- ============ LIST MODE ============ -->
    <template v-if="mode === 'list'">
      <div class="quiz-generate-card">
        <div class="gen-header">
          <h3>{{ t('quiz.generateTitle') }}</h3>
          <p v-if="title" class="gen-subtitle">{{ title }}</p>
        </div>
        <div class="gen-controls">
          <label class="gen-field">
            <span>{{ t('quiz.difficulty') }}</span>
            <select v-model="genDifficulty" :disabled="generating">
              <option value="easy">{{ t('quiz.easy') }}</option>
              <option value="medium">{{ t('quiz.medium') }}</option>
              <option value="hard">{{ t('quiz.hard') }}</option>
            </select>
          </label>
          <label class="gen-field">
            <span>{{ t('quiz.countLabel') }}</span>
            <select v-model.number="genCount" :disabled="generating">
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="15">15</option>
              <option :value="20">20</option>
            </select>
          </label>
          <label class="gen-field grow">
            <span>{{ t('quiz.focusLabel') }}</span>
            <input
              v-model="genFocus"
              type="text"
              :placeholder="t('quiz.focusPlaceholder')"
              :disabled="generating"
            >
          </label>
          <button class="btn-generate" :disabled="generating" @click="handleGenerate">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            {{ generating ? t('quiz.generating') : t('quiz.generateBtn') }}
          </button>
        </div>
        <p v-if="genError" class="gen-error">{{ genError }}</p>
      </div>

      <div class="section-header">
        <h2>{{ t('quiz.savedQuizzes') }}</h2>
      </div>

      <div v-if="loading" class="quiz-loading">
        <div class="loading-spinner"></div>
      </div>
      <template v-else>
        <div v-if="quizzes.length === 0" class="empty-state">
          <div class="empty-icon">🎯</div>
          <h3>{{ t('quiz.noQuizzes') }}</h3>
          <p>{{ t('quiz.noQuizzesDesc') }}</p>
        </div>
        <div v-else class="quiz-list">
          <div v-for="q in quizzes" :key="q.id" class="quiz-card">
            <div class="quiz-card-main" @click="startQuiz(q)">
              <div class="quiz-card-tags">
                <span :class="['diff-badge', q.difficulty || 'medium']">{{ difficultyLabel(q.difficulty) }}</span>
                <span v-if="q.focus && q.focus !== 'general'" class="focus-tag">{{ q.focus }}</span>
                <span :class="['status-badge', quizStatus(q)]">{{ statusLabel(q) }}</span>
              </div>
              <h4>{{ t('quiz.questionsCount', { count: q.questions?.length || 0 }) }}</h4>
              <div v-if="quizStatus(q) === 'in-progress'" class="card-progress-bar">
                <div class="card-progress-fill" :style="{ width: answeredPct(q) }"></div>
              </div>
              <span class="quiz-date">
                {{ formatDate(q.created_at) }}
                <template v-if="bestScore(q) !== null"> &middot; {{ t('quiz.bestScore', { score: bestScore(q) }) }}</template>
              </span>
            </div>
            <button class="btn-delete-quiz" :title="t('quiz.delete')" @click.stop="handleDelete(q)">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      </template>
    </template>

    <!-- ============ TAKING MODE ============ -->
    <template v-else-if="mode === 'taking' && currentQuestion">
      <div class="quiz-taking">
        <div class="taking-header">
          <button @click="backToList" class="btn-back">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <div class="progress-info">
            <span class="progress-label">{{ t('quiz.questionOf', { current: currentIndex + 1, total: currentQuiz.questions.length }) }}</span>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPct }"></div>
            </div>
          </div>
        </div>

        <div class="question-card">
          <div class="question-text" v-html="renderMd(currentQuestion.question)"></div>
          <div class="options-list">
            <button
              v-for="(opt, oIdx) in currentQuestion.options"
              :key="oIdx"
              :class="['option-btn', { selected: selectedOption === oIdx }]"
              @click="selectedOption = oIdx"
            >
              <span class="option-letter">{{ optionLetter(oIdx) }}</span>
              <span class="option-text" v-html="renderMd(opt)"></span>
            </button>
          </div>
        </div>

        <div class="taking-footer">
          <button class="btn-next" :disabled="selectedOption === null" @click="nextQuestion">
            {{ isLastQuestion ? t('quiz.finish') : t('quiz.next') }}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </div>
      </div>
    </template>

    <!-- ============ RESULT MODE ============ -->
    <template v-else-if="mode === 'result' && currentQuiz">
      <div class="quiz-result">
        <div class="score-circle" :class="scoreClass">
          <span class="score-value">{{ scorePct }}%</span>
          <span class="score-detail">{{ scoreCount }} / {{ currentQuiz.questions.length }}</span>
          <span class="score-label">{{ t('quiz.yourScore') }}</span>
        </div>

        <div class="review-list">
          <div v-for="(q, qIdx) in currentQuiz.questions" :key="qIdx" class="review-item">
            <div class="review-question">
              <span :class="['review-verdict', isCorrect(qIdx) ? 'ok' : 'bad']">{{ isCorrect(qIdx) ? '✓' : '✕' }}</span>
              <span class="review-q-text" v-html="renderMd(q.question)"></span>
            </div>
            <div class="review-answer">
              <p>
                <strong>{{ t('quiz.correctAnswer') }}:</strong>
                <span class="answer-correct" v-html="renderMd(q.options[q.correct_index])"></span>
              </p>
              <p v-if="!isCorrect(qIdx)">
                <strong>{{ t('quiz.yourAnswer') }}:</strong>
                <span class="answer-wrong" v-html="renderMd(q.options[answers[qIdx]] ?? '')"></span>
              </p>
              <p v-if="q.explanation" class="explanation">{{ q.explanation }}</p>
            </div>
          </div>
        </div>

        <div class="result-actions">
          <button class="btn-retake" @click="retakeQuiz">{{ t('quiz.retake') }}</button>
          <button class="btn-back-list" @click="backToList">{{ t('quiz.backToList') }}</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { dbService } from '../services/db'
import { aiService } from '../services/ai'
import { citationsService } from '../services/citations'
import { i18n } from '../services/i18n'

const t = i18n.t

const props = defineProps({
  notebookId: { type: String, default: null },
  subject: { type: String, default: null },
  title: { type: String, default: '' }
})

const mode = ref('list')
const loading = ref(true)
const quizzes = ref([])

// Generation state
const generating = ref(false)
const genDifficulty = ref('medium')
const genCount = ref(10)
const genFocus = ref('')
const genError = ref('')

// Taking/result state
const currentQuiz = ref(null)
const currentIndex = ref(0)
const answers = ref([])
const selectedOption = ref(null)

onMounted(() => loadQuizzes())

async function loadQuizzes(silent = false) {
  if (!silent) loading.value = true
  try {
    if (props.notebookId) {
      quizzes.value = await dbService.getQuizzesByNotebook(props.notebookId)
    } else if (props.subject) {
      quizzes.value = await dbService.getQuizzesBySubject(props.subject)
    }
  } catch (e) {
    console.error('Failed to load quizzes:', e)
  } finally {
    if (!silent) loading.value = false
  }
}

// Build the factual context sent to the LLM for quiz generation
async function buildContextText() {
  const NL = String.fromCharCode(10)
  if (props.notebookId) {
    const nb = await dbService.getNotebook(props.notebookId)
    return [
      '--- Notebook: "' + (nb.title || '') + '" ---',
      'Summary:',
      nb.summary || '',
      'Transcription:',
      nb.transcription || ''
    ].join(NL)
  }
  if (props.subject) {
    const notebooks = await dbService.getNotebooksBySubject(props.subject)
    const blocks = notebooks.map(nb =>
      '--- Notebook: "' + nb.title + '" ---' + NL +
      'Summary: ' + (nb.summary || '') + NL +
      'Transcription: ' + (nb.transcription || '')
    )
    return blocks.join(NL + NL + '=====' + NL + NL).slice(0, 30000)
  }
  return ''
}

async function handleGenerate() {
  generating.value = true
  genError.value = ''
  try {
    const contextText = await buildContextText()
    const focus = genFocus.value.trim() || 'general'
    const questions = await aiService.generateQuiz(contextText, {
      difficulty: genDifficulty.value,
      focus,
      count: genCount.value
    })
    const saved = await dbService.saveQuiz({
      notebookId: props.notebookId,
      subject: props.subject,
      difficulty: genDifficulty.value,
      focus,
      questions
    })
    await loadQuizzes()
    // Jump straight into the freshly generated quiz
    startQuiz(saved)
  } catch (e) {
    console.error('Failed to generate quiz:', e)
    genError.value = t('quiz.genFailed', { message: e.message || 'unknown error' })
  } finally {
    generating.value = false
  }
}

function startQuiz(quiz) {
  const total = quiz.questions?.length || 0
  const saved = Array.isArray(quiz.progress?.answers) ? quiz.progress.answers : []
  const savedSlice = saved.slice(0, total).map(a => (a === undefined ? null : a))
  const hasSavedAnswers = savedSlice.some(a => a !== null)
  const hasUnanswered = savedSlice.length < total || savedSlice.some(a => a === null)

  if (hasSavedAnswers && hasUnanswered) {
    // Resume an in-progress attempt from the first unanswered question
    const restored = [...savedSlice]
    while (restored.length < total) restored.push(null)
    answers.value = restored
    currentQuiz.value = quiz
    const firstUnanswered = restored.findIndex(a => a === null)
    currentIndex.value = firstUnanswered === -1 ? 0 : firstUnanswered
  } else {
    // Fresh attempt (not started yet, or already fully answered -> retake)
    answers.value = new Array(total).fill(null)
    currentQuiz.value = { ...quiz, progress: { ...(quiz.progress || {}), answers: [] } }
    currentIndex.value = 0
  }
  selectedOption.value = null
  mode.value = 'taking'
}

const currentQuestion = computed(() =>
  currentQuiz.value?.questions?.[currentIndex.value] || null
)

const isLastQuestion = computed(() =>
  currentQuiz.value ? currentIndex.value >= currentQuiz.value.questions.length - 1 : false
)

const progressPct = computed(() => {
  const total = currentQuiz.value?.questions?.length || 0
  if (!total) return '0%'
  return Math.round(((currentIndex.value + 1) / total) * 100) + '%'
})

function nextQuestion() {
  if (selectedOption.value === null || !currentQuestion.value) return
  answers.value[currentIndex.value] = selectedOption.value
  if (isLastQuestion.value) {
    finishQuiz()
  } else {
    persistProgress(false)
    currentIndex.value++
    selectedOption.value = null
  }
}

// Persist attempt state: answers so far; on completion also the flag + best score
async function persistProgress(completed) {
  const quiz = currentQuiz.value
  if (!quiz?.id) return
  const total = quiz.questions?.length || 0
  const prevBest = quiz.progress?.best_score_pct ?? null
  let best = prevBest
  if (completed && total) {
    const correct = quiz.questions.reduce(
      (sum, _q, i) => sum + (answers.value[i] === quiz.questions[i].correct_index ? 1 : 0),
      0
    )
    best = Math.max(prevBest ?? 0, Math.round((correct / total) * 100))
  }
  const progress = {
    answers: [...answers.value],
    completed: completed ? true : Boolean(quiz.progress?.completed),
    best_score_pct: best
  }
  quiz.progress = progress // optimistic local update so the list reflects it immediately
  try {
    await dbService.updateQuizProgress(quiz.id, progress)
  } catch (e) {
    console.error('Failed to save quiz progress:', e)
  }
}

function finishQuiz() {
  persistProgress(true)
  mode.value = 'result'
}

function isCorrect(qIdx) {
  return answers.value[qIdx] === currentQuiz.value?.questions?.[qIdx]?.correct_index
}

const scoreCount = computed(() => {
  if (!currentQuiz.value) return 0
  return currentQuiz.value.questions.reduce((sum, _q, i) => sum + (isCorrect(i) ? 1 : 0), 0)
})

const scorePct = computed(() => {
  const total = currentQuiz.value?.questions?.length || 0
  return total ? Math.round((scoreCount.value / total) * 100) : 0
})

const scoreClass = computed(() => {
  if (scorePct.value >= 80) return 'great'
  if (scorePct.value >= 50) return 'okay'
  return 'poor'
})

function retakeQuiz() {
  if (currentQuiz.value) startQuiz(currentQuiz.value)
}

async function backToList() {
  mode.value = 'list'
  currentQuiz.value = null
  // Refresh statuses/progress without flashing the loading spinner
  await loadQuizzes(true)
}

async function handleDelete(quiz) {
  if (!confirm(t('quiz.deleteConfirm'))) return
  try {
    await dbService.deleteQuiz(quiz.id)
    quizzes.value = quizzes.value.filter(q => q.id !== quiz.id)
  } catch (e) {
    console.error('Failed to delete quiz:', e)
  }
}

// Render markdown-ish text (bold, lists, $math$) without citations
function renderMd(text) {
  return citationsService.renderMarkdownWithCitations(text || '', []).html
}

function optionLetter(idx) {
  return String.fromCharCode(65 + idx)
}

// ---- Status tracking helpers ----
function quizStatus(quiz) {
  if (quiz.progress?.completed) return 'completed'
  if (answeredCount(quiz) > 0) return 'in-progress'
  return 'not-started'
}

function statusLabel(quiz) {
  const status = quizStatus(quiz)
  if (status === 'completed') return t('quiz.statusCompleted')
  if (status === 'in-progress') {
    const total = quiz.questions?.length || 0
    return `${t('quiz.statusInProgress')} · ${answeredCount(quiz)}/${total}`
  }
  return t('quiz.statusNotStarted')
}

function answeredCount(quiz) {
  const arr = Array.isArray(quiz.progress?.answers) ? quiz.progress.answers : []
  return arr.filter(a => a !== null && a !== undefined).length
}

function answeredPct(quiz) {
  const total = quiz.questions?.length || 0
  return total ? Math.round((answeredCount(quiz) / total) * 100) + '%' : '0%'
}

function bestScore(quiz) {
  const b = quiz.progress?.best_score_pct
  return (b === null || b === undefined) ? null : b
}

function difficultyLabel(d) {
  if (d === 'easy') return t('quiz.easy')
  if (d === 'hard') return t('quiz.hard')
  return t('quiz.medium')
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.quiz-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: var(--text-primary);
}

/* ---------- Generate card ---------- */
.quiz-generate-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
}

.gen-header h3 {
  margin: 0 0 0.25rem;
  font-size: 1.05rem;
  color: white;
}

.gen-subtitle {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.gen-controls {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.gen-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.gen-field.grow {
  flex: 1;
  min-width: 180px;
}

.gen-field select,
.gen-field input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  color: white;
  padding: 0.55rem 0.75rem;
  font-size: 0.85rem;
}

.gen-field select:focus,
.gen-field input:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.btn-generate {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--accent-gradient);
  border: none;
  color: white;
  padding: 0.6rem 1.1rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-generate:hover:not(:disabled) {
  transform: scale(1.03);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
}

.btn-generate:disabled {
  opacity: 0.6;
  cursor: wait;
}

.gen-error {
  margin: 0.75rem 0 0;
  font-size: 0.8rem;
  color: #ef4444;
}

/* ---------- Saved quiz list ---------- */
.section-header h2 {
  font-size: 1.1rem;
  margin: 0.5rem 0 0;
  color: white;
}

.quiz-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.empty-state {
  text-align: center;
  padding: 2.5rem 1rem;
  border: 1px dashed var(--border-light);
  border-radius: 16px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.empty-state h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  font-size: 0.85rem;
}

.quiz-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.quiz-card {
  display: flex;
  align-items: stretch;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.2s;
}

.quiz-card:hover {
  border-color: var(--accent-primary);
}

.quiz-card-main {
  flex: 1;
  padding: 0.9rem 1.25rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.quiz-card-tags {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.diff-badge {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
}

.diff-badge.easy {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.diff-badge.medium {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.diff-badge.hard {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.focus-tag {
  font-size: 0.72rem;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.06);
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quiz-card-main h4 {
  margin: 0;
  font-size: 0.9rem;
  color: white;
}

.quiz-date {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.status-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
}

.status-badge.not-started {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-muted);
}

.status-badge.in-progress {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.status-badge.completed {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.card-progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.card-progress-fill {
  height: 100%;
  background: var(--accent-gradient);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.btn-delete-quiz {
  background: transparent;
  border: none;
  border-left: 1px solid var(--border-light);
  color: var(--text-muted);
  padding: 0 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete-quiz:hover {
  color: var(--danger-color);
  background: rgba(239, 68, 68, 0.08);
}

/* ---------- Taking mode ---------- */
.quiz-taking {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.taking-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-back {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 8px;
  transition: all 0.2s;
}

.btn-back:hover {
  background: var(--border-light);
  color: white;
}

.progress-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.progress-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-gradient);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.question-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.question-text {
  font-size: 1.05rem;
  line-height: 1.6;
  color: white;
}

.question-text :deep(p) {
  margin: 0 0 0.5rem;
}
.question-text :deep(p:last-child) {
  margin-bottom: 0;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  text-align: left;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 0.8rem 1rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.92rem;
}

.option-btn:hover {
  border-color: var(--accent-primary);
  background: rgba(99, 102, 241, 0.08);
}

.option-btn.selected {
  border-color: var(--accent-primary);
  background: rgba(99, 102, 241, 0.18);
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.25);
}

.option-letter {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.option-btn.selected .option-letter {
  background: var(--accent-gradient);
  color: white;
}

.option-text {
  line-height: 1.5;
}

.option-text :deep(p) {
  margin: 0;
}

.taking-footer {
  display: flex;
  justify-content: flex-end;
}

.btn-next {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--accent-gradient);
  border: none;
  color: white;
  padding: 0.65rem 1.4rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-next:hover:not(:disabled) {
  transform: scale(1.03);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
}

.btn-next:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---------- Result mode ---------- */
.quiz-result {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.score-circle {
  align-self: center;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  border: 4px solid;
}

.score-circle.great {
  border-color: #22c55e;
  box-shadow: 0 0 25px rgba(34, 197, 94, 0.3);
}

.score-circle.okay {
  border-color: #f59e0b;
  box-shadow: 0 0 25px rgba(245, 158, 11, 0.3);
}

.score-circle.poor {
  border-color: #ef4444;
  box-shadow: 0 0 25px rgba(239, 68, 68, 0.3);
}

.score-value {
  font-size: 2rem;
  font-weight: 800;
  color: white;
}

.score-detail {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.score-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.review-item {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 1rem 1.25rem;
}

.review-question {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  margin-bottom: 0.6rem;
}

.review-verdict {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
  color: white;
}

.review-verdict.ok {
  background: #22c55e;
}

.review-verdict.bad {
  background: #ef4444;
}

.review-q-text {
  font-size: 0.92rem;
  line-height: 1.5;
  color: white;
}

.review-q-text :deep(p) {
  margin: 0;
}

.review-answer {
  padding-left: 1.9rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.review-answer p {
  margin: 0;
}

.answer-correct {
  color: #4ade80;
}

.answer-wrong {
  color: #f87171;
}

.explanation {
  font-style: italic;
  color: var(--text-muted);
}

.result-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}

.btn-retake,
.btn-back-list {
  padding: 0.65rem 1.4rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-retake {
  background: var(--accent-gradient);
  border: none;
  color: white;
}

.btn-retake:hover {
  transform: scale(1.03);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
}

.btn-back-list {
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
}

.btn-back-list:hover {
  border-color: var(--accent-primary);
  color: white;
}
</style>