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
            <span>{{ t('quiz.modeLabel') }}</span>
            <select v-model="genMode" :disabled="generating">
              <option value="standard">{{ t('quiz.modeStandard') }}</option>
              <option value="time_attack">{{ t('quiz.modeTimeAttack') }}</option>
            </select>
          </label>
          <label v-if="genMode === 'time_attack'" class="gen-field">
            <span>{{ t('quiz.timerLabel') }}</span>
            <select v-model.number="genTimerSeconds" :disabled="generating">
              <option :value="10">{{ t('quiz.seconds', { seconds: 10 }) }}</option>
              <option :value="15">{{ t('quiz.seconds', { seconds: 15 }) }}</option>
              <option :value="20">{{ t('quiz.seconds', { seconds: 20 }) }}</option>
              <option :value="30">{{ t('quiz.seconds', { seconds: 30 }) }}</option>
            </select>
          </label>
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
        <div v-if="genMode === 'time_attack'" class="mode-tip">
          ⚡ {{ t('quiz.modeTimeAttackDesc') }}
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
                <span v-if="isTimeAttack(q)" class="mode-badge time-attack">
                  ⚡ {{ t('quiz.timeAttackBadge') }} ({{ qTimer(q) }}s)
                </span>
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
                <template v-if="hasBestScore(q)"> &middot; {{ formatBestScore(q) }}</template>
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
            <div class="progress-top-row">
              <span class="progress-label">{{ t('quiz.questionOf', { current: currentIndex + 1, total: currentQuiz.questions.length }) }}</span>
              <div v-if="isCurrentTimeAttack" class="ta-badges">
                <div class="score-pill">
                  ⭐ {{ runScore.toLocaleString() }} <span class="pts-unit">{{ t('quiz.pts') }}</span>
                </div>
                <div :class="['streak-pill', { 'streak-hot': currentStreak >= 3, 'streak-fire': currentStreak >= 5 }]">
                  🔥 {{ currentStreak }}
                  <span v-if="currentStreak > 1" class="streak-mult">{{ streakMultiplierText }}</span>
                </div>
              </div>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPct }"></div>
            </div>
          </div>
        </div>

        <!-- Time Attack Countdown Bar -->
        <div v-if="isCurrentTimeAttack" class="timer-card">
          <div class="timer-meta">
            <span class="timer-clock" :class="timerUrgencyClass">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              {{ Math.ceil(timeLeft) }}s
            </span>
            <span v-if="!isAnswerRevealed && speedBonusPreview > 0" class="speed-hint">
              {{ t('quiz.speedBonus', { pts: speedBonusPreview }) }}
            </span>
          </div>
          <div class="timer-track">
            <div
              class="timer-fill"
              :class="timerUrgencyClass"
              :style="{ width: timerPct + '%' }"
            ></div>
          </div>
        </div>

        <div class="question-card">
          <div class="question-text" v-html="renderMd(currentQuestion.question)"></div>
          <div class="options-list">
            <button
              v-for="(opt, oIdx) in currentQuestion.options"
              :key="oIdx"
              :class="[
                'option-btn',
                {
                  selected: selectedOption === oIdx,
                  'option-correct': isAnswerRevealed && selectedOption === oIdx && isOptionCorrect(oIdx),
                  'option-wrong': isAnswerRevealed && selectedOption === oIdx && !isOptionCorrect(oIdx),
                  'option-reveal-correct': isAnswerRevealed && oIdx === currentQuestion.correct_index && selectedOption !== oIdx,
                  'disabled': isAnswerRevealed
                }
              ]"
              :disabled="isAnswerRevealed"
              @click="handleOptionSelect(oIdx)"
            >
              <span class="option-letter">{{ optionLetter(oIdx) }}</span>
              <span class="option-text" v-html="renderMd(opt)"></span>
              <span v-if="isAnswerRevealed && oIdx === currentQuestion.correct_index" class="option-feedback-icon correct">✓</span>
              <span v-else-if="isAnswerRevealed && selectedOption === oIdx && !isOptionCorrect(oIdx)" class="option-feedback-icon wrong">✕</span>
            </button>
          </div>

          <!-- Instant Feedback Toast / Banner -->
          <div v-if="lastQuestionFeedback" :class="['feedback-toast', lastQuestionFeedback.type]">
            <span class="feedback-text">{{ lastQuestionFeedback.text }}</span>
          </div>
        </div>

        <div class="taking-footer">
          <button
            v-if="!isCurrentTimeAttack || isAnswerRevealed"
            class="btn-next"
            :disabled="selectedOption === null && !isAnswerRevealed"
            @click="advanceToNext"
          >
            {{ isLastQuestion ? t('quiz.finish') : t('quiz.next') }}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </div>
      </div>
    </template>

    <!-- ============ RESULT MODE ============ -->
    <template v-else-if="mode === 'result' && currentQuiz">
      <div class="quiz-result">
        <!-- Time Attack Hero Stats -->
        <div v-if="isCurrentTimeAttack" class="ta-result-summary">
          <div class="stat-card score-hero">
            <span class="stat-label">{{ t('quiz.totalScore') }}</span>
            <span class="stat-value highlight">{{ runScore.toLocaleString() }}</span>
            <span class="stat-sub">{{ t('quiz.pts') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">{{ t('quiz.accuracy') }}</span>
            <span class="stat-value">{{ accuracyPct }}%</span>
            <span class="stat-sub">{{ scoreCount }} / {{ currentQuiz.questions.length }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">{{ t('quiz.maxStreak') }}</span>
            <span class="stat-value fire">🔥 {{ maxStreakAchieved }}</span>
            <span class="stat-sub">{{ t('quiz.streak') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">{{ t('quiz.avgSpeed') }}</span>
            <span class="stat-value">{{ avgTimePerQuestion }}s</span>
            <span class="stat-sub">{{ t('quiz.secPerQuestion', { sec: avgTimePerQuestion }) }}</span>
          </div>
        </div>

        <!-- Standard Score Circle -->
        <div v-else class="score-circle" :class="scoreClass">
          <span class="score-value">{{ scorePct }}%</span>
          <span class="score-detail">{{ scoreCount }} / {{ currentQuiz.questions.length }}</span>
          <span class="score-label">{{ t('quiz.yourScore') }}</span>
        </div>

        <div class="review-list">
          <div v-for="(q, qIdx) in currentQuiz.questions" :key="qIdx" class="review-item">
            <div class="review-question">
              <span :class="['review-verdict', isCorrect(qIdx) ? 'ok' : 'bad']">
                {{ isCorrect(qIdx) ? '✓' : (isTimedOut(qIdx) ? '⏰' : '✕') }}
              </span>
              <div class="review-q-body">
                <div class="review-q-text" v-html="renderMd(q.question)"></div>
                <div v-if="isCurrentTimeAttack" class="review-q-meta">
                  <span v-if="isCorrect(qIdx)" class="q-pts-badge ok">
                    +{{ (questionScores[qIdx] || 0).toLocaleString() }} {{ t('quiz.pts') }}
                    <template v-if="answerTimes[qIdx]"> &middot; {{ answerTimes[qIdx] }}s</template>
                  </span>
                  <span v-else-if="isTimedOut(qIdx)" class="q-pts-badge timeout">
                    {{ t('quiz.timedOut') }} (0 {{ t('quiz.pts') }})
                  </span>
                  <span v-else class="q-pts-badge bad">
                    0 {{ t('quiz.pts') }}
                    <template v-if="answerTimes[qIdx]"> &middot; {{ answerTimes[qIdx] }}s</template>
                  </span>
                </div>
              </div>
            </div>
            <div class="review-answer">
              <p>
                <strong>{{ t('quiz.correctAnswer') }}:</strong>
                <span class="answer-correct" v-html="renderMd(q.options[q.correct_index])"></span>
              </p>
              <p v-if="!isCorrect(qIdx)">
                <strong>{{ t('quiz.yourAnswer') }}:</strong>
                <span class="answer-wrong">
                  <template v-if="isTimedOut(qIdx)">{{ t('quiz.timedOut') }}</template>
                  <span v-else v-html="renderMd(q.options[answers[qIdx]] ?? '')"></span>
                </span>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { dbService } from '../services/db'
import { aiService } from '../services/ai'
import { citationsService } from '../services/citations'
import { i18n } from '../services/i18n'
import { widgetService } from '../services/widget'

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
const genMode = ref('standard')
const genTimerSeconds = ref(15)
const genDifficulty = ref('medium')
const genCount = ref(10)
const genFocus = ref('')
const genError = ref('')

// Taking/result state
const currentQuiz = ref(null)
const currentIndex = ref(0)
const answers = ref([])
const selectedOption = ref(null)

// Time Attack & streak state
const runScore = ref(0)
const currentStreak = ref(0)
const maxStreakAchieved = ref(0)
const answerTimes = ref([])
const questionScores = ref([])
const timeLeft = ref(15)
const isAnswerRevealed = ref(false)
const lastQuestionFeedback = ref(null)

let timerInterval = null
let advanceTimeout = null
let questionStartTime = 0

onMounted(() => loadQuizzes())
onBeforeUnmount(() => stopQuestionTimer())

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

// Mode & timer helpers
function isTimeAttack(quiz) {
  return quiz?.mode === 'time_attack' || quiz?.progress?.mode === 'time_attack'
}

function qTimer(quiz) {
  return Number(quiz?.timer_seconds || quiz?.progress?.timer_seconds || 15)
}

const isCurrentTimeAttack = computed(() => isTimeAttack(currentQuiz.value))
const currentTimerDuration = computed(() => qTimer(currentQuiz.value))

const timerPct = computed(() => {
  const dur = currentTimerDuration.value || 15
  return Math.max(0, Math.min(100, (timeLeft.value / dur) * 100))
})

const timerUrgencyClass = computed(() => {
  if (timerPct.value <= 25) return 'critical'
  if (timerPct.value <= 50) return 'warning'
  return 'normal'
})

const speedBonusPreview = computed(() => {
  const dur = currentTimerDuration.value || 15
  if (dur <= 0) return 0
  const ratio = Math.max(0, timeLeft.value / dur)
  return Math.round(500 * ratio)
})

const streakMultiplier = computed(() => {
  if (currentStreak.value <= 1) return 1.0
  if (currentStreak.value === 2) return 1.2
  if (currentStreak.value === 3) return 1.4
  if (currentStreak.value === 4) return 1.7
  return 2.0
})

const streakMultiplierText = computed(() => `${streakMultiplier.value}x`)

// Build context for LLM
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
      questions,
      mode: genMode.value,
      timerSeconds: genTimerSeconds.value
    })
    await loadQuizzes()
    startQuiz(saved)
  } catch (e) {
    console.error('Failed to generate quiz:', e)
    genError.value = t('quiz.genFailed', { message: e.message || 'unknown error' })
  } finally {
    generating.value = false
  }
}

// Timer management
function startQuestionTimer() {
  stopQuestionTimer()
  if (!isCurrentTimeAttack.value) return
  const dur = currentTimerDuration.value
  timeLeft.value = dur
  questionStartTime = performance.now()
  isAnswerRevealed.value = false
  lastQuestionFeedback.value = null

  timerInterval = setInterval(() => {
    const elapsed = (performance.now() - questionStartTime) / 1000
    const remaining = Math.max(0, dur - elapsed)
    timeLeft.value = remaining
    if (remaining <= 0) {
      stopQuestionTimer()
      handleTimeout()
    }
  }, 50)
}

function stopQuestionTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  if (advanceTimeout) {
    clearTimeout(advanceTimeout)
    advanceTimeout = null
  }
}

function handleOptionSelect(oIdx) {
  if (isCurrentTimeAttack.value) {
    if (selectedOption.value !== null || isAnswerRevealed.value) return
    stopQuestionTimer()
    selectedOption.value = oIdx
    isAnswerRevealed.value = true

    const dur = currentTimerDuration.value
    const elapsed = Math.min(dur, (performance.now() - questionStartTime) / 1000)
    const remaining = Math.max(0, dur - elapsed)
    answerTimes.value[currentIndex.value] = Math.round(elapsed * 10) / 10
    answers.value[currentIndex.value] = oIdx

    const correct = oIdx === currentQuestion.value.correct_index
    if (correct) {
      currentStreak.value++
      if (currentStreak.value > maxStreakAchieved.value) {
        maxStreakAchieved.value = currentStreak.value
      }
      const speedRatio = dur > 0 ? remaining / dur : 0
      const speedBonus = Math.round(500 * speedRatio)
      let mult = 1.0
      if (currentStreak.value === 2) mult = 1.2
      else if (currentStreak.value === 3) mult = 1.4
      else if (currentStreak.value === 4) mult = 1.7
      else if (currentStreak.value >= 5) mult = 2.0

      const qPts = Math.round((1000 + speedBonus) * mult)
      questionScores.value[currentIndex.value] = qPts
      runScore.value += qPts

      lastQuestionFeedback.value = {
        type: 'correct',
        text: `+${qPts.toLocaleString()} pts! ${currentStreak.value > 1 ? '🔥 ' + mult + 'x' : ''}`
      }
    } else {
      currentStreak.value = 0
      questionScores.value[currentIndex.value] = 0
      lastQuestionFeedback.value = {
        type: 'wrong',
        text: t('quiz.streakLost')
      }
    }

    dbService.recordStudyDay().catch(console.error)

    advanceTimeout = setTimeout(() => {
      advanceToNext()
    }, 850)
  } else {
    selectedOption.value = oIdx
  }
}

function handleTimeout() {
  if (selectedOption.value !== null || isAnswerRevealed.value) return
  isAnswerRevealed.value = true
  selectedOption.value = -1 // Timed out
  answers.value[currentIndex.value] = null
  answerTimes.value[currentIndex.value] = currentTimerDuration.value
  questionScores.value[currentIndex.value] = 0
  currentStreak.value = 0

  lastQuestionFeedback.value = {
    type: 'timeout',
    text: `⏰ ${t('quiz.timeUp')}`
  }

  dbService.recordStudyDay().catch(console.error)

  advanceTimeout = setTimeout(() => {
    advanceToNext()
  }, 1000)
}

function advanceToNext() {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout)
    advanceTimeout = null
  }
  isAnswerRevealed.value = false
  lastQuestionFeedback.value = null

  if (!isCurrentTimeAttack.value) {
    if (selectedOption.value !== null && currentQuestion.value) {
      answers.value[currentIndex.value] = selectedOption.value
      dbService.recordStudyDay().then(async () => {
        const streak = await dbService.getStudyStreak()
        await widgetService.sync(streak)
      }).catch(console.error)
    }
  }

  if (isLastQuestion.value) {
    finishQuiz()
  } else {
    persistProgress(false)
    currentIndex.value++
    selectedOption.value = null
    if (isCurrentTimeAttack.value) {
      startQuestionTimer()
    }
  }
}

function startQuiz(quiz) {
  stopQuestionTimer()
  currentQuiz.value = quiz
  const total = quiz.questions?.length || 0
  const isTA = isTimeAttack(quiz)
  const saved = Array.isArray(quiz.progress?.answers) ? quiz.progress.answers : []
  const savedSlice = saved.slice(0, total).map(a => (a === undefined ? null : a))
  const hasSavedAnswers = savedSlice.some(a => a !== null)
  const hasUnanswered = savedSlice.length < total || savedSlice.some(a => a === null)

  if (!isTA && hasSavedAnswers && hasUnanswered) {
    const restored = [...savedSlice]
    while (restored.length < total) restored.push(null)
    answers.value = restored
    const firstUnanswered = restored.findIndex(a => a === null)
    currentIndex.value = firstUnanswered === -1 ? 0 : firstUnanswered
    answerTimes.value = Array.isArray(quiz.progress?.answer_times) ? [...quiz.progress.answer_times] : new Array(total).fill(0)
    questionScores.value = Array.isArray(quiz.progress?.question_scores) ? [...quiz.progress.question_scores] : new Array(total).fill(0)
    runScore.value = quiz.progress?.score || 0
    currentStreak.value = 0
    maxStreakAchieved.value = quiz.progress?.max_streak || 0
  } else {
    answers.value = new Array(total).fill(null)
    answerTimes.value = new Array(total).fill(0)
    questionScores.value = new Array(total).fill(0)
    runScore.value = 0
    currentStreak.value = 0
    maxStreakAchieved.value = 0
    currentIndex.value = 0
    currentQuiz.value = { ...quiz, progress: { ...(quiz.progress || {}), answers: [] } }
  }

  selectedOption.value = null
  isAnswerRevealed.value = false
  lastQuestionFeedback.value = null
  mode.value = 'taking'

  if (isTA) {
    startQuestionTimer()
  }
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

async function persistProgress(completed) {
  const quiz = currentQuiz.value
  if (!quiz?.id) return
  const total = quiz.questions?.length || 0
  const isTA = isTimeAttack(quiz)
  const prevBestPct = quiz.progress?.best_score_pct ?? null
  const prevBestScore = quiz.progress?.best_score ?? 0
  let bestPct = prevBestPct
  let bestScoreVal = prevBestScore

  const correctCount = quiz.questions.reduce(
    (sum, _q, i) => sum + (answers.value[i] === quiz.questions[i].correct_index ? 1 : 0),
    0
  )
  const currentPct = total ? Math.round((correctCount / total) * 100) : 0

  if (completed && total) {
    bestPct = Math.max(prevBestPct ?? 0, currentPct)
    if (isTA) {
      bestScoreVal = Math.max(prevBestScore, runScore.value)
    }
  }

  const progress = {
    mode: isTA ? 'time_attack' : 'standard',
    timer_seconds: qTimer(quiz),
    answers: [...answers.value],
    answer_times: [...answerTimes.value],
    question_scores: [...questionScores.value],
    completed: completed ? true : Boolean(quiz.progress?.completed),
    score: runScore.value,
    best_score: bestScoreVal,
    accuracy_pct: currentPct,
    best_score_pct: bestPct,
    max_streak: Math.max(quiz.progress?.max_streak || 0, maxStreakAchieved.value)
  }
  quiz.progress = progress
  try {
    await dbService.updateQuizProgress(quiz.id, progress)
  } catch (e) {
    console.error('Failed to save quiz progress:', e)
  }
}

function finishQuiz() {
  stopQuestionTimer()
  persistProgress(true)
  mode.value = 'result'
}

function isCorrect(qIdx) {
  return answers.value[qIdx] === currentQuiz.value?.questions?.[qIdx]?.correct_index
}

function isTimedOut(qIdx) {
  return answers.value[qIdx] === null && isTimeAttack(currentQuiz.value)
}

function isOptionCorrect(oIdx) {
  return oIdx === currentQuestion.value?.correct_index
}

const scoreCount = computed(() => {
  if (!currentQuiz.value) return 0
  return currentQuiz.value.questions.reduce((sum, _q, i) => sum + (isCorrect(i) ? 1 : 0), 0)
})

const scorePct = computed(() => {
  const total = currentQuiz.value?.questions?.length || 0
  return total ? Math.round((scoreCount.value / total) * 100) : 0
})

const accuracyPct = computed(() => scorePct.value)

const avgTimePerQuestion = computed(() => {
  const times = answerTimes.value.filter(t => typeof t === 'number' && t > 0)
  if (!times.length) return 0
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  return Math.round(avg * 10) / 10
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
  stopQuestionTimer()
  mode.value = 'list'
  currentQuiz.value = null
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

function renderMd(text) {
  return citationsService.renderMarkdownWithCitations(text || '', []).html
}

function optionLetter(idx) {
  return String.fromCharCode(65 + idx)
}

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

function hasBestScore(quiz) {
  return quiz.progress?.best_score_pct !== null && quiz.progress?.best_score_pct !== undefined
}

function formatBestScore(quiz) {
  if (isTimeAttack(quiz) && quiz.progress?.best_score) {
    return t('quiz.bestScoreWithPts', {
      score: quiz.progress.best_score.toLocaleString(),
      pct: quiz.progress.best_score_pct ?? 0
    })
  }
  return t('quiz.bestScore', { score: quiz.progress?.best_score_pct ?? 0 })
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

.mode-tip {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 8px;
  font-size: 0.8rem;
  color: #fbbf24;
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

.mode-badge.time-attack {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(239, 68, 68, 0.25));
  border: 1px solid rgba(245, 158, 11, 0.5);
  color: #fbbf24;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  letter-spacing: 0.03em;
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
  gap: 1rem;
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

.progress-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.ta-badges {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.score-pill {
  font-size: 0.75rem;
  font-weight: 700;
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.pts-unit {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.streak-pill {
  font-size: 0.75rem;
  font-weight: 700;
  color: #f97316;
  background: rgba(249, 115, 22, 0.12);
  border: 1px solid rgba(249, 115, 22, 0.3);
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.streak-pill.streak-hot {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #fca5a5;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.35);
  animation: pulse-hot 1.5s infinite;
}

.streak-pill.streak-fire {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(245, 158, 11, 0.4));
  border-color: #f59e0b;
  color: #fff;
  box-shadow: 0 0 14px rgba(245, 158, 11, 0.5);
  animation: pulse-fire 1s infinite;
}

.streak-mult {
  font-size: 0.65rem;
  background: rgba(255, 255, 255, 0.15);
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
}

@keyframes pulse-hot {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes pulse-fire {
  0%, 100% { transform: scale(1); box-shadow: 0 0 14px rgba(245, 158, 11, 0.5); }
  50% { transform: scale(1.08); box-shadow: 0 0 20px rgba(239, 68, 68, 0.7); }
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

/* Timer card */
.timer-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 0.6rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.timer-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
}

.timer-clock {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  font-family: monospace;
  font-size: 0.9rem;
  color: #38bdf8;
  transition: color 0.2s;
}

.timer-clock.warning {
  color: #fbbf24;
}

.timer-clock.critical {
  color: #ef4444;
  animation: blink 0.5s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.speed-hint {
  font-size: 0.72rem;
  color: #34d399;
  font-weight: 600;
}

.timer-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.timer-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.05s linear, background-color 0.2s;
  background: #38bdf8;
}

.timer-fill.warning {
  background: #f59e0b;
}

.timer-fill.critical {
  background: #ef4444;
}

/* Question card */
.question-card {
  position: relative;
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
  position: relative;
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

.option-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  background: rgba(99, 102, 241, 0.08);
}

.option-btn.selected {
  border-color: var(--accent-primary);
  background: rgba(99, 102, 241, 0.18);
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.25);
}

.option-btn.option-correct {
  border-color: #22c55e !important;
  background: rgba(34, 197, 94, 0.22) !important;
  box-shadow: 0 0 16px rgba(34, 197, 94, 0.35);
  color: white;
}

.option-btn.option-wrong {
  border-color: #ef4444 !important;
  background: rgba(239, 68, 68, 0.22) !important;
  box-shadow: 0 0 16px rgba(239, 68, 68, 0.35);
  color: white;
}

.option-btn.option-reveal-correct {
  border-color: #22c55e !important;
  background: rgba(34, 197, 94, 0.12) !important;
}

.option-btn.disabled {
  cursor: default;
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

.option-btn.option-correct .option-letter {
  background: #22c55e;
  color: white;
}

.option-btn.option-wrong .option-letter {
  background: #ef4444;
  color: white;
}

.option-text {
  flex: 1;
  line-height: 1.5;
}

.option-text :deep(p) {
  margin: 0;
}

.option-feedback-icon {
  font-weight: 800;
  font-size: 1rem;
}

.option-feedback-icon.correct {
  color: #4ade80;
}

.option-feedback-icon.wrong {
  color: #f87171;
}

.feedback-toast {
  padding: 0.65rem 1rem;
  border-radius: 10px;
  text-align: center;
  font-weight: 700;
  font-size: 0.95rem;
  animation: slide-up 0.2s ease-out;
}

.feedback-toast.correct {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid #22c55e;
  color: #4ade80;
  box-shadow: 0 0 14px rgba(34, 197, 94, 0.25);
}

.feedback-toast.wrong {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid #ef4444;
  color: #f87171;
}

.feedback-toast.timeout {
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid #f59e0b;
  color: #fbbf24;
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
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

.ta-result-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.75rem;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.25rem;
}

.stat-card.score-hero {
  border-color: rgba(245, 158, 11, 0.6);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(99, 102, 241, 0.08));
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.2);
}

.stat-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: white;
}

.stat-value.highlight {
  font-size: 1.8rem;
  color: #fbbf24;
}

.stat-value.fire {
  color: #f97316;
}

.stat-sub {
  font-size: 0.72rem;
  color: var(--text-secondary);
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
  gap: 0.75rem;
  align-items: flex-start;
  margin-bottom: 0.6rem;
}

.review-verdict {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
  color: white;
  margin-top: 0.15rem;
}

.review-verdict.ok {
  background: #22c55e;
}

.review-verdict.bad {
  background: #ef4444;
}

.review-q-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.review-q-text {
  font-size: 0.92rem;
  line-height: 1.5;
  color: white;
}

.review-q-text :deep(p) {
  margin: 0;
}

.review-q-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.q-pts-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 6px;
}

.q-pts-badge.ok {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.q-pts-badge.bad {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.q-pts-badge.timeout {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.review-answer {
  padding-left: 2.15rem;
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
