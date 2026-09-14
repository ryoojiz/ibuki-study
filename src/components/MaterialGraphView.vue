<template>
  <div class="graph-view">
    <header class="graph-header">
      <div>
        <h1>{{ t('graph.title') }}</h1>
        <p>{{ t('graph.subtitle') }}</p>
      </div>
      <div class="graph-actions">
        <button class="graph-btn" @click="fitGraph">{{ t('graph.fit') }}</button>
        <button class="graph-btn primary" :disabled="isRefreshing || !notebooks.length" @click="refreshRelationships">
          {{ isRefreshing ? t('graph.refreshing') : t('graph.refresh') }}
        </button>
      </div>
    </header>

    <div class="graph-toolbar">
      <label>{{ t('graph.subject') }} <select v-model="subjectFilter">
          <option value="">{{ t('graph.allSubjects') }}</option>
          <option v-for="subject in subjects" :key="subject" :value="subject">{{ subject }}</option>
        </select></label>
      <label>{{ t('graph.relationship') }} <select v-model="typeFilter">
          <option value="">{{ t('graph.allRelationships') }}</option>
          <option v-for="type in relationTypes" :key="type" :value="type">{{ relationLabel(type) }}</option>
        </select></label>
      <span class="graph-count">{{ t('graph.count', { materials: visibleNodes.length, links: visibleLinks.length })
        }}</span>
    </div>

    <p v-if="error" class="graph-error">{{ error }}</p>
    <div v-if="loading" class="graph-empty">{{ t('graph.loading') }}</div>
    <div v-else-if="!notebooks.length" class="graph-empty">{{ t('graph.empty') }}</div>
    <div v-else class="graph-layout">
      <section class="graph-canvas" ref="canvas">
        <svg :viewBox="`0 0 ${dimensions.width} ${dimensions.height}`" @wheel.prevent="onWheel" @pointerdown="startPan"
          @pointermove="panGraph" @pointerup="endPan" @pointercancel="endPan" @pointerleave="endPan">
          <g :transform="`translate(${transform.x} ${transform.y}) scale(${transform.scale})`">
            <line v-for="link in positionedLinks" :key="link.id" class="graph-link"
              :class="{ active: selectedLink?.id === link.id }" :x1="link.source.x" :y1="link.source.y"
              :x2="link.target.x" :y2="link.target.y" @click="selectLink(link)" />
            <text v-for="link in positionedLinks" :key="`${link.id}-label`" class="graph-link-label"
              :x="(link.source.x + link.target.x) / 2" :y="(link.source.y + link.target.y) / 2 - 6">{{
                relationLabel(link.relation_type) }}</text>
            <g v-for="node in positionedNodes" :key="node.id" class="graph-node"
              :class="{ active: selectedNode?.id === node.id, 'link-selected': linkNodes.some(selected => selected.id === node.id) }"
              :transform="`translate(${node.x} ${node.y})`" @mousedown="startDrag(node, $event)"
              @click.stop="selectNode(node)">
              <circle :r="nodeRadius(node)" :fill="subjectColor(node.subject)" />
              <text y="5" text-anchor="middle" class="graph-node-initials">{{ initials(node.title) }}</text>
              <text class="graph-node-label" :y="nodeRadius(node) + 16" text-anchor="middle">{{ truncate(node.title, 22)
                }}</text>
            </g>
          </g>
        </svg>
      </section>

      <aside class="graph-panel">
        <template v-if="selectedNode">
          <div class="graph-panel-title"><span :style="{ background: subjectColor(selectedNode.subject) }"
              class="subject-dot"></span>
            <h2>{{ selectedNode.title }}</h2>
          </div>
          <p class="graph-subject">{{ selectedNode.subject || t('graph.unsorted') }}</p>
          <p class="graph-summary">{{ plainSummary(selectedNode.summary) }}</p>
          <div class="graph-panel-actions"><button class="graph-btn" @click="$emit('open-material', selectedNode.id)">{{
            t('graph.openMaterial') }}</button><button class="graph-btn"
              @click="$emit('open-chat', selectedNode.id)">{{ t('graph.chat') }}</button></div>
          <h3>{{ t('graph.connections') }}</h3>
          <button v-for="link in nodeLinks" :key="link.id" class="connection-row" @click="selectLink(link)"><span>{{
            relationLabel(link.relation_type) }}</span><strong>{{ connectedTitle(link) }}</strong><small>{{
                originLabel(link.origin) }}</small></button>
          <p v-if="!nodeLinks.length" class="graph-muted">{{ t('graph.noRelationships') }}</p>
        </template>
        <template v-else-if="selectedLink">
          <h2>{{ relationLabel(selectedLink.relation_type) }}</h2>
          <p class="graph-muted">{{ sourceTitle(selectedLink) }} → {{ targetTitle(selectedLink) }}</p>
          <label>{{ t('graph.relationship') }} <select v-model="editingType">
              <option v-for="type in relationTypes" :key="type" :value="type">{{ relationLabel(type) }}</option>
            </select></label>
          <div class="graph-panel-actions"><button class="graph-btn" @click="saveLinkEdit">{{ t('graph.saveEdit')
              }}</button><button class="graph-btn danger" @click="removeLink(selectedLink.id)">{{ t('graph.delete')
              }}</button></div>
        </template>
        <template v-else>
          <h2>{{ t('graph.chooseMaterial') }}</h2>
          <p class="graph-muted">{{ t('graph.chooseMaterialHint') }}</p>
        </template>

        <div class="manual-link">
          <h3>{{ t('graph.addRelationship') }}</h3>
          <button v-if="!isLinking" class="graph-btn primary" @click="startLinking">{{ t('graph.connectMaterials')
            }}</button>
          <template v-else>
            <p class="linking-help">{{ t(linkNodes.length ? 'graph.clickSecond' : 'graph.clickFirst') }}</p>
            <div v-if="linkNodes.length" class="link-picks"><span v-for="node in linkNodes" :key="node.id">{{ node.title
                }}</span></div>
            <label v-if="linkNodes.length === 2">{{ t('graph.relationshipType') }} <select v-model="newLink.type">
                <option v-for="type in relationTypes" :key="type" :value="type">{{ relationLabel(type) }}</option>
              </select></label>
            <div class="graph-panel-actions"><button class="graph-btn primary" :disabled="!canCreateLink"
                @click="createLink">{{ t('graph.addLink') }}</button><button class="graph-btn" @click="cancelLinking">{{
                  t('common.cancel') }}</button></div>
          </template>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import { dbService } from '../services/db'
import { aiService } from '../services/ai'
import { i18n } from '../services/i18n'

const emit = defineEmits(['open-material', 'open-chat'])
const t = i18n.t
const relationTypes = ['prerequisite', 'builds_on', 'related_to', 'contrasts_with', 'example_of']
const notebooks = ref([])
const relationships = ref([])
const loading = ref(true)
const isRefreshing = ref(false)
const error = ref('')
const subjectFilter = ref('')
const typeFilter = ref('')
const selectedNode = ref(null)
const selectedLink = ref(null)
const isLinking = ref(false)
const linkNodes = ref([])
const editingType = ref('related_to')
const canvas = ref(null)
const dimensions = reactive({ width: 800, height: 600 })
const transform = reactive({ x: 0, y: 0, scale: 1 })
const isPanning = ref(false)
const tick = ref(0)
const renderedLinks = ref([])
const newLink = reactive({ type: 'related_to' })
let simulation = null
let resizeObserver = null
let dragging = null
let panState = null

const subjects = computed(() => [...new Set(notebooks.value.map(node => node.subject).filter(Boolean))].sort())
const visibleNodes = computed(() => notebooks.value.filter(node => !subjectFilter.value || node.subject === subjectFilter.value))
const visibleLinks = computed(() => relationships.value.filter(link =>
  (!typeFilter.value || link.relation_type === typeFilter.value) &&
  visibleNodes.value.some(node => node.id === link.source_notebook_id) &&
  visibleNodes.value.some(node => node.id === link.target_notebook_id)
))
const positionedNodes = computed(() => { tick.value; return visibleNodes.value })
const positionedLinks = computed(() => { tick.value; return renderedLinks.value.filter(link => link.source?.x != null && link.target?.x != null) })
const nodeLinks = computed(() => selectedNode.value ? relationships.value.filter(link => link.source_notebook_id === selectedNode.value.id || link.target_notebook_id === selectedNode.value.id) : [])
const canCreateLink = computed(() => linkNodes.value.length === 2)

const relationLabel = type => ({ prerequisite: t('graph.relationPrerequisite'), builds_on: t('graph.relationBuildsOn'), related_to: t('graph.relationRelatedTo'), contrasts_with: t('graph.relationContrastsWith'), example_of: t('graph.relationExampleOf') })[type] || type
const originLabel = origin => origin === 'ai' ? t('graph.ai') : t('graph.manual')
const subjectColor = subject => ['#8d1ee3', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6'][Math.abs([...String(subject || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 5]
const initials = title => String(title || '?').split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()
const truncate = (value, length) => value?.length > length ? `${value.slice(0, length - 1)}…` : value
const plainSummary = summary => truncate(String(summary || '').replace(/[#*`_]/g, '').replace(/\s+/g, ' ').trim(), 280) || t('graph.noSummary')
const nodeRadius = node => selectedNode.value?.id === node.id ? 28 : 23
const sourceTitle = link => notebooks.value.find(node => node.id === link.source_notebook_id)?.title || t('graph.unknownMaterial')
const targetTitle = link => notebooks.value.find(node => node.id === link.target_notebook_id)?.title || t('graph.unknownMaterial')
const connectedTitle = link => link.source_notebook_id === selectedNode.value?.id ? targetTitle(link) : sourceTitle(link)

function resize() {
  const rect = canvas.value?.getBoundingClientRect()
  if (!rect) return
  dimensions.width = Math.max(480, Math.floor(rect.width))
  dimensions.height = Math.max(460, Math.floor(rect.height))
  restartSimulation()
}

function restartSimulation() {
  simulation?.stop()
  const nodes = visibleNodes.value
  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const links = visibleLinks.value.map(link => ({ ...link, source: nodeMap.get(link.source_notebook_id), target: nodeMap.get(link.target_notebook_id) })).filter(link => link.source && link.target)
  renderedLinks.value = links
  simulation = forceSimulation(nodes)
    .force('link', forceLink(links).id(node => node.id).distance(150).strength(0.65))
    .force('charge', forceManyBody().strength(-420))
    .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
    .force('collide', forceCollide(42))
    .on('tick', () => { tick.value++ })
}

function fitGraph() { transform.x = 0; transform.y = 0; transform.scale = 1; restartSimulation() }
function onWheel(event) { transform.scale = Math.min(2.5, Math.max(0.4, transform.scale * (event.deltaY > 0 ? 0.9 : 1.1))) }
function startPan(event) {
  if (event.target !== event.currentTarget || dragging) return
  panState = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y }
  isPanning.value = true
  event.currentTarget.setPointerCapture?.(event.pointerId)
}
function panGraph(event) {
  if (!panState || event.pointerId !== panState.pointerId) return
  transform.x = panState.originX + event.clientX - panState.x
  transform.y = panState.originY + event.clientY - panState.y
}
function endPan(event) {
  if (panState && (!event.pointerId || event.pointerId === panState.pointerId)) {
    panState = null
    isPanning.value = false
  }
}
function startDrag(node, event) {
  dragging = node
  node.fx = node.x
  node.fy = node.y
  const svg = event.currentTarget.closest('svg')
  const move = moveEvent => {
    const rect = svg.getBoundingClientRect()
    node.fx = (moveEvent.clientX - rect.left - transform.x) / transform.scale
    node.fy = (moveEvent.clientY - rect.top - transform.y) / transform.scale
    simulation?.alpha(0.4).restart()
  }
  const end = () => { node.fx = null; node.fy = null; dragging = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end) }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', end)
}
function startLinking() { isLinking.value = true; linkNodes.value = []; selectedNode.value = null; selectedLink.value = null }
function cancelLinking() { isLinking.value = false; linkNodes.value = [] }
function selectNode(node) {
  if (dragging) return
  if (isLinking.value) {
    if (linkNodes.value.some(selected => selected.id === node.id)) {
      linkNodes.value = linkNodes.value.filter(selected => selected.id !== node.id)
    } else if (linkNodes.value.length < 2) {
      linkNodes.value = [...linkNodes.value, node]
    }
    return
  }
  selectedNode.value = node; selectedLink.value = null
}
function selectLink(link) { selectedLink.value = link; selectedNode.value = null; editingType.value = link.relation_type }

async function loadGraph() {
  loading.value = true; error.value = ''
  try { [notebooks.value, relationships.value] = await Promise.all([dbService.getAllNotebooks(), dbService.getMaterialRelationships()]); await nextTick(); resize() }
  catch (e) { error.value = e.message || t('graph.loadError') }
  finally { loading.value = false }
}
async function createLink() {
  try {
    relationships.value.push(await dbService.createMaterialRelationship({ sourceNotebookId: linkNodes.value[0].id, targetNotebookId: linkNodes.value[1].id, relationType: newLink.type }))
    cancelLinking()
    restartSimulation()
  }
  catch (e) { error.value = e.message || t('graph.addError') }
}
async function saveLinkEdit() {
  try { const updated = await dbService.updateMaterialRelationship(selectedLink.value.id, { relationType: editingType.value }); relationships.value = relationships.value.map(link => link.id === updated.id ? updated : link); selectedLink.value = updated; restartSimulation() }
  catch (e) { error.value = e.message || t('graph.saveError') }
}
async function removeLink(id) {
  try { await dbService.deleteMaterialRelationship(id); relationships.value = relationships.value.filter(link => link.id !== id); selectedLink.value = null; restartSimulation() }
  catch (e) { error.value = e.message || t('graph.deleteError') }
}
async function refreshRelationships() {
  isRefreshing.value = true; error.value = ''
  try {
    for (const source of notebooks.value) {
      const candidates = notebooks.value.filter(candidate => candidate.id !== source.id)
      const suggestions = await aiService.suggestMaterialRelationships(source, candidates)
      await dbService.replaceAiMaterialRelationships(source.id, suggestions)
    }
    relationships.value = await dbService.getMaterialRelationships(); restartSimulation()
  } catch (e) { error.value = e.message || t('graph.refreshError') }
  finally { isRefreshing.value = false }
}

watch([subjectFilter, typeFilter], () => nextTick(restartSimulation))
onMounted(async () => { await loadGraph(); resizeObserver = new ResizeObserver(resize); if (canvas.value) resizeObserver.observe(canvas.value) })
onBeforeUnmount(() => { simulation?.stop(); resizeObserver?.disconnect() })
</script>

<style scoped>
.graph-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
}

.graph-header,
.graph-toolbar,
.graph-actions,
.graph-panel-actions {
  display: flex;
  align-items: center;
  gap: .75rem;
}

.graph-header {
  justify-content: space-between;
}

.graph-header h1 {
  font-size: 1.8rem;
}

.graph-header p,
.graph-muted,
.graph-subject {
  color: var(--text-secondary);
  font-size: .88rem;
}

.graph-toolbar {
  flex-wrap: wrap;
}

.graph-toolbar label,
.graph-panel label {
  display: flex;
  flex-direction: column;
  gap: .3rem;
  color: var(--text-secondary);
  font-size: .76rem;
}

.graph-toolbar select,
.graph-panel select {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  color: white;
  border-radius: 7px;
  padding: .45rem .6rem;
  min-width: 150px;
}

.graph-count {
  color: var(--text-muted);
  font-size: .8rem;
  margin-left: auto;
}

.graph-layout {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 1rem;
}

.graph-canvas,
.graph-panel {
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-card);
  overflow: hidden;
}

.graph-canvas svg {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
  touch-action: none;
  background-image: radial-gradient(rgba(255, 255, 255, .11) 1px, transparent 1px);
  background-size: 22px 22px;
}

.graph-canvas svg:active {
  cursor: grabbing;
}

.graph-link {
  stroke: rgba(255, 255, 255, .3);
  stroke-width: 2;
  cursor: pointer;
}

.graph-link.active {
  stroke: #c084fc;
  stroke-width: 4;
}

.graph-link-label {
  fill: var(--text-secondary);
  font-size: 13px;
  pointer-events: none;
}

.graph-node {
  cursor: grab;
}

.graph-node:active {
  cursor: grabbing;
}

.graph-node circle {
  stroke: rgba(255, 255, 255, .7);
  stroke-width: 2;
}

.graph-node.active circle,
.graph-node.link-selected circle {
  stroke: white;
  stroke-width: 4;
}

.graph-node.link-selected circle {
  stroke: #fbbf24;
}

.graph-node text {
  fill: white;
  font-size: 10px;
  font-weight: 700;
  pointer-events: none;
}

.graph-node .graph-node-label {
  font-weight: 500;
  font-size: 14px;
}

.graph-node .graph-node-initials {
  font-size: 16px;
  font-weight: 400;
}

.graph-panel {
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: .75rem;
}

.graph-panel-title {
  display: flex;
  gap: .5rem;
  align-items: center;
}

.graph-panel-title h2,
.graph-panel h2 {
  font-size: 1.05rem;
}

.subject-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.graph-summary {
  line-height: 1.5;
  font-size: .83rem;
}

.graph-btn {
  border: 1px solid var(--border-light);
  color: white;
  background: rgba(255, 255, 255, .06);
  border-radius: 7px;
  padding: .45rem .65rem;
  cursor: pointer;
  font-size: .78rem;
}

.graph-btn.primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
}

.graph-btn.danger {
  color: #fca5a5;
}

.graph-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.connection-row {
  text-align: left;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: .15rem;
  border: none;
  background: rgba(255, 255, 255, .04);
  color: var(--text-primary);
  padding: .55rem;
  border-radius: 7px;
  cursor: pointer;
}

.connection-row span,
.connection-row small {
  color: var(--text-muted);
  font-size: .7rem;
}

.connection-row small {
  grid-column: 2;
}

.manual-link {
  border-top: 1px solid var(--border-light);
  padding-top: .85rem;
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: .55rem;
}

.manual-link h3,
.graph-panel h3 {
  font-size: .85rem;
}

.linking-help,
.link-picks {
  color: var(--text-secondary);
  font-size: .78rem;
}

.link-picks {
  display: flex;
  flex-direction: column;
  gap: .25rem;
}

.graph-empty,
.graph-error {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}

.graph-error {
  color: #fca5a5;
  padding: 0;
}

@media (max-width: 900px) {
  .graph-layout {
    grid-template-columns: 1fr;
  }

  .graph-canvas {
    min-height: 500px;
  }

  .graph-panel {
    max-height: 420px;
  }

  .graph-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .graph-count {
    margin-left: 0;
  }
}
</style>
