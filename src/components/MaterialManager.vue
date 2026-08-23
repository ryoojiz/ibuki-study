<template>
  <div class="mm-overlay" @click.self="$emit('close')">
    <div class="mm-modal">
      <div class="mm-header">
        <h2>{{ t('matmgr.title') }}</h2>
        <button class="mm-close" @click="$emit('close')">&times;</button>
      </div>

      <!-- Toolbar -->
      <div class="mm-toolbar">
        <button class="mm-btn" @click="startCreate(null)">+ {{ t('matmgr.newRoot') }}</button>
        <button class="mm-btn" :disabled="!selectedNodeIds.size" @click="openGroupDialog">
          {{ t('matmgr.groupInto') }}<span v-if="selectedNodeIds.size"> ({{ selectedNodeIds.size }})</span>
        </button>
        <button class="mm-btn mm-danger" :disabled="!selectedNodeIds.size" @click="confirmDeleteSelection">
          {{ t('matmgr.delete') }}<span v-if="selectedNodeIds.size"> ({{ selectedNodeIds.size }})</span>
        </button>
        <button class="mm-btn mm-accent" @click="runAutoGroup" :disabled="autoLoading">
          {{ autoLoading ? t('matmgr.thinking') : '✨ ' + t('matmgr.autoGroup') }}
        </button>
        <span class="mm-spacer"></span>
        <button class="mm-btn mm-ghost" @click="resyncLabels" :disabled="busy">{{ t('matmgr.resyncLabels') }}</button>
      </div>

      <div class="mm-body">
        <!-- Tree -->
        <div class="mm-tree">
          <p v-if="!tree.length && !unsortedNotebooks.length" class="mm-empty">{{ t('matmgr.empty') }}</p>

          <!-- Unassigned notebooks -->
          <div v-if="unsortedNotebooks.length" class="mm-node">
            <div class="mm-row mm-row-root">
              <span class="mm-caret mm-caret-hidden"></span>
              <input type="checkbox" class="mm-check"
                :checked="unsortedState === 'all'" :indeterminate.prop="unsortedState === 'some'"
                @change="toggleUnsortedNotebooks">
              <span class="mm-name">{{ t('ctx.unsorted') }}</span>
              <span class="mm-count">{{ unsortedNotebooks.length }}</span>
            </div>
            <div class="mm-children">
              <label v-for="nb in unsortedNotebooks" :key="nb.id" class="mm-row mm-row-nb">
                <input type="checkbox" class="mm-check" :checked="selectedNotebookIds.has(nb.id)" @change="toggleNotebookPick(nb.id)">
                <span class="mm-nb-icon">📄</span>
                <span class="mm-name" :title="nb.title">{{ nb.title }}</span>
              </label>
            </div>
          </div>

          <MMNode
            v-for="node in tree"
            :key="node.id"
            :node="node"
            :grouped="groupedNotebooks"
            :expanded="expandedIds"
            :picked-node-ids="selectedNodeIds"
            :picked-notebook-ids="selectedNotebookIds"
            @expand="toggleExpand"
            @pick-node="toggleNodePick"
            @pick-notebook="toggleNotebookPick"
            @add-child="startCreate"
            @rename="startRename"
            @move="startMoveSingle"
          />
        </div>

        <!-- Side info / actions -->
        <div class="mm-side">
          <template v-if="!showAiPanel">
            <h3>{{ t('matmgr.selectionTitle') }}</h3>
            <p class="mm-hint">{{ t('matmgr.hint') }}</p>
            <ul class="mm-picked">
              <li v-for="id in pickedNames" :key="id.id">{{ id.label }}</li>
            </ul>
            <p v-if="selectedNotebookIds.size" class="mm-hint">
              {{ t('matmgr.notebooksPicked', { n: selectedNotebookIds.size }) }}
            </p>
          </template>

          <!-- AI grouping preview -->
          <template v-else>
            <h3>{{ t('matmgr.aiPreviewTitle') }}</h3>
            <p class="mm-hint">{{ t('matmgr.aiPreviewHint') }}</p>
            <div class="mm-ai-groups">
              <div v-for="(g, gi) in aiGroups" :key="gi" class="mm-ai-group">
                <div class="mm-ai-path">
                  <span v-for="(seg, si) in g.path" :key="si" class="mm-path-seg">{{ seg }}<template v-if="si < g.path.length - 1"> ›</template></span>
                </div>
                <ul>
                  <li v-for="mid in g.memberNames" :key="mid">{{ mid }}</li>
                </ul>
              </div>
            </div>
            <div class="mm-ai-actions">
              <button class="mm-btn mm-accent" @click="applyAutoGroup" :disabled="busy">{{ t('matmgr.applyStructure') }}</button>
              <button class="mm-btn mm-ghost" @click="discardAutoGroup">{{ t('matmgr.discard') }}</button>
            </div>
          </template>
        </div>
      </div>

      <!-- Inline dialogs -->
      <div v-if="dialog.mode === 'create' || dialog.mode === 'rename' || dialog.mode === 'move'" class="mm-dialog">
        <template v-if="dialog.mode === 'create'">
          <label>{{ t('matmgr.createUnder', { parent: dialog.parentName || t('matmgr.rootLevel') }) }}</label>
          <input v-model="dialog.name" type="text" :placeholder="t('matmgr.namePlaceholder')" @keyup.enter="applyDialog">
        </template>
        <template v-else-if="dialog.mode === 'rename'">
          <label>{{ t('matmgr.renameLabel') }}</label>
          <input v-model="dialog.name" type="text" @keyup.enter="applyDialog">
        </template>
        <template v-else-if="dialog.mode === 'move'">
          <label>{{ t('matmgr.moveTitle', { name: dialog.targetName }) }}</label>
          <select v-model="dialog.parentId">
            <option :value="null">— {{ t('matmgr.rootLevel') }} —</option>
            <option v-for="opt in movableParents(dialog.targetId)" :key="opt.id" :value="opt.id">{{ opt.pathLabel }}</option>
          </select>
        </template>
        <div class="mm-dialog-actions">
          <button class="mm-btn mm-accent" @click="applyDialog" :disabled="busy || !dialogValid">{{ t('common.save') }}</button>
          <button class="mm-btn mm-ghost" @click="dialog = { mode: null }">{{ t('common.cancel') }}</button>
        </div>
      </div>

      <!-- Group-into dialog -->
      <div v-if="dialog.mode === 'group'" class="mm-dialog">
        <label>{{ t('matmgr.groupTarget', { n: selectedNodeIds.size }) }}</label>
        <select v-model="dialog.parentId">
          <option :value="'__new__'">{{ t('matmgr.createNewGroup') }}</option>
          <option :value="null">— {{ t('matmgr.rootLevel') }} —</option>
          <option v-for="opt in movableParents(null)" :key="opt.id" :value="opt.id">{{ opt.pathLabel }}</option>
        </select>
        <input v-if="dialog.parentId === '__new__'" v-model="dialog.name" type="text" :placeholder="t('matmgr.groupNamePlaceholder')" @keyup.enter="applyDialog">
        <div class="mm-dialog-actions">
          <button class="mm-btn mm-accent" @click="applyDialog" :disabled="busy || !dialogValid">{{ t('matmgr.moveHere') }}</button>
          <button class="mm-btn mm-ghost" @click="dialog = { mode: null }">{{ t('common.cancel') }}</button>
        </div>
      </div>

      <p v-if="error" class="mm-error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits, h, onMounted } from 'vue'
import { dbService } from '../services/db'
import { aiService } from '../services/ai'
import { materialsService } from '../services/materials'
import { i18n } from '../services/i18n'

const t = i18n.t

const props = defineProps({})
const emit = defineEmits(['close', 'changed'])

// ---- State -----------------------------------------------------------------
const flat = ref([])
const notebooks = ref([])
const expandedIds = ref(new Set())
const selectedNodeIds = ref(new Set())   // picked material nodes
const selectedNotebookIds = ref(new Set()) // picked unassigned notebooks
const busy = ref(false)
const error = ref('')
const dialog = ref({ mode: null })

// AI grouping preview
const showAiPanel = ref(false)
const autoLoading = ref(false)
const aiGroups = ref([])

const tree = computed(() => materialsService.buildTree(flat.value))
const index = computed(() => materialsService.indexById(flat.value))
const groupedNotebooks = computed(() => materialsService.groupNotebooksByMaterial(notebooks.value))
const unsortedNotebooks = computed(() => groupedNotebooks.value.get(null) || [])

const unsortedState = computed(() => {
  const list = unsortedNotebooks.value
  if (!list.length) return 'none'
  const c = list.filter(nb => selectedNotebookIds.value.has(nb.id)).length
  return c === 0 ? 'none' : (c === list.length ? 'all' : 'some')
})

const pickedNames = computed(() =>
  [...selectedNodeIds.value].map(id => {
    const names = materialsService.getPathNames(index.value, id)
    return { id, label: names.join(' › ') }
  })
)

const dialogValid = computed(() => {
  const d = dialog.value
  if (d.mode === 'create' || d.mode === 'rename') return !!d.name?.trim()
  if (d.mode === 'group') {
    if (d.parentId === '__new__') return !!d.name?.trim()
    // Prevent grouping a set under one of its own members
    if (d.parentId && selectedNodeIds.value.has(d.parentId)) return false
    return true
  }
  if (d.mode === 'move') {
    return d.parentId !== d.targetId &&
      !materialsService.wouldCreateCycle(index.value, d.targetId, d.parentId)
  }
  return false
})

onMounted(async () => {
  await reload()
})

async function reload() {
  const [mats, nbs] = await Promise.all([
    dbService.getMaterials(),
    dbService.getAllNotebooks()
  ])
  flat.value = mats
  notebooks.value = nbs
}

function toggleExpand(id) {
  const next = new Set(expandedIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expandedIds.value = next
}

function toggleNodePick(id) {
  const next = new Set(selectedNodeIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedNodeIds.value = next
}

function toggleNotebookPick(id) {
  const next = new Set(selectedNotebookIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedNotebookIds.value = next
}

function toggleUnsortedNotebooks() {
  const include = unsortedState.value !== 'all'
  const next = new Set(selectedNotebookIds.value)
  for (const nb of unsortedNotebooks.value) {
    include ? next.add(nb.id) : next.delete(nb.id)
  }
  selectedNotebookIds.value = next
}

/** Valid drop targets for moving `excludeId` (or any when null). */
function movableParents(excludeId) {
  const out = []
  const walk = (nodes, prefix) => {
    for (const n of nodes) {
      if (n.id !== excludeId) {
        const label = prefix ? prefix + ' › ' + n.name : n.name
        out.push({ id: n.id, pathLabel: label })
        walk(n.children, label)
      }
    }
  }
  walk(tree.value, '')
  return out
}

// ---- CRUD actions -----------------------------------------------------------

function startCreate(parentId) {
  dialog.value = { mode: 'create', parentId, parentName: parentId ? index.value.get(parentId)?.name : '', name: '' }
}

function startRename(node) {
  dialog.value = { mode: 'rename', targetId: node.id, name: node.name }
}

function startMoveSingle(node) {
  dialog.value = { mode: 'move', targetId: node.id, targetName: node.name, parentId: node.parent_id }
}

function openGroupDialog() {
  dialog.value = { mode: 'group', parentId: '__new__', name: '' }
}

async function applyDialog() {
  if (!dialogValid.value || busy.value) return
  const d = dialog.value
  busy.value = true
  error.value = ''
  try {
    if (d.mode === 'create') {
      await dbService.createMaterial({ name: d.name, parentId: d.parentId })
    } else if (d.mode === 'rename') {
      await dbService.renameMaterial(d.targetId, d.name)
    } else if (d.mode === 'move') {
      await dbService.moveMaterial(d.targetId, d.parentId)
      await dbService.resyncNotebookLabels().catch(() => {})
    } else if (d.mode === 'group') {
      let targetParent = d.parentId
      if (targetParent === '__new__') {
        const created = await dbService.createMaterial({ name: d.name, parentId: null })
        targetParent = created.id
      }
      const ids = [...selectedNodeIds.value]
      for (const id of ids) {
        if (materialsService.wouldCreateCycle(index.value, id, targetParent)) continue
        await dbService.moveMaterial(id, targetParent)
      }
      await dbService.resyncNotebookLabels().catch(() => {})
      selectedNodeIds.value = new Set()
    }
    dialog.value = { mode: null }
    await reload()
    emit('changed')
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    busy.value = false
  }
}

async function confirmDeleteSelection() {
  const ids = [...selectedNodeIds.value]
  if (!ids.length) return
  const names = pickedNames.value.map(p => p.label).join(', ')
  const nbCount = countNotebooksUnder(ids)
  const msg = nbCount > 0
    ? t('matmgr.deleteConfirmWithNb', { names, n: nbCount })
    : t('matmgr.deleteConfirm', { names })
  if (!confirm(msg)) return

  busy.value = true
  error.value = ''
  try {
    await dbService.deleteMaterials(ids)
    selectedNodeIds.value = new Set()
    await reload()
    emit('changed')
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    busy.value = false
  }
}

function countNotebooksUnder(ids) {
  let count = 0
  for (const id of ids) {
    const node = index.value.get(id)
    if (!node) continue
    const treeNode = findTreeNode(tree.value, id)
    if (treeNode) count += materialsService.collectNotebookIds(treeNode, groupedNotebooks.value).length
  }
  return count
}

function findTreeNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findTreeNode(n.children || [], id)
    if (found) return found
  }
  return null
}

// ---- AI auto-group ----------------------------------------------------------

async function runAutoGroup() {
  autoLoading.value = true
  error.value = ''
  try {
    // Feed material nodes to the LLM as pseudo-notebooks
    const pseudo = flat.value.map(m => ({
      id: m.id,
      title: m.name,
      subject: m.parent_id ? (index.value.get(m.parent_id)?.name || '') : '',
      material: '',
      summary: ''
    }))
    const result = await aiService.suggestGrouping(pseudo)
    aiGroups.value = result.groups.map(g => ({
      path: g.path,
      memberIds: g.notebook_ids,
      memberNames: g.notebook_ids.map(id => index.value.get(id)?.name || id)
    })).filter(g => g.memberIds.length)
    showAiPanel.value = aiGroups.value.length > 0
    if (!aiGroups.value.length) error.value = t('matmgr.aiNoProposal')
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    autoLoading.value = false
  }
}

async function applyAutoGroup() {
  busy.value = true
  error.value = ''
  try {
    for (const g of aiGroups.value) {
      const leaf = await dbService.ensureMaterialPath(g.path)
      if (!leaf) continue
      for (const mid of g.memberIds) {
        if (materialsService.wouldCreateCycle(index.value, mid, leaf.id)) continue
        await dbService.moveMaterial(mid, leaf.id)
      }
    }
    await dbService.resyncNotebookLabels().catch(() => {})
    discardAutoGroup()
    await reload()
    emit('changed')
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    busy.value = false
  }
}

function discardAutoGroup() {
  showAiPanel.value = false
  aiGroups.value = []
}

async function resyncLabels() {
  busy.value = true
  error.value = ''
  try {
    await dbService.resyncNotebookLabels()
    await reload()
    emit('changed')
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    busy.value = false
  }
}

// ---- Recursive node renderer -------------------------------------------------

// Inline SVG icon builders (unicode glyphs like ✎/⇄ render as tofu in some fonts)
const svgAttrs = {
  width: 13,
  height: 13,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round'
}
const IconPlus = () => h('svg', svgAttrs, [
  h('line', { x1: 12, y1: 5, x2: 12, y2: 19 }),
  h('line', { x1: 5, y1: 12, x2: 19, y2: 12 })
])
const IconPencil = () => h('svg', svgAttrs, [
  h('path', { d: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' })
])
const IconMove = () => h('svg', svgAttrs, [
  h('polyline', { points: '8 3 4 7 8 11' }),
  h('line', { x1: 4, y1: 7, x2: 20, y2: 7 }),
  h('polyline', { points: '16 21 20 17 16 13' }),
  h('line', { x1: 20, y1: 17, x2: 4, y2: 17 })
])

const MMNode = (p) => {
  const node = p.node
  const isExpanded = p.expanded.has(node.id)
  const hasKids = node.children?.length || (p.grouped.get(node.id) || []).length

  const rows = [
    h('div', { class: 'mm-row' + (node.depth === 0 ? ' mm-row-root' : ''), key: 'r-' + node.id }, [
      h('span', {
        class: ['mm-caret', hasKids ? '' : 'mm-caret-hidden', isExpanded ? 'expanded' : ''],
        onClick: () => p.onExpand(node.id)
      }),
      h('input', {
        type: 'checkbox',
        class: 'mm-check',
        checked: p.pickedNodeIds.has(node.id),
        onChange: () => p.onPickNode(node.id)
      }),
      h('span', { class: 'mm-name', title: node.name }, node.name),
      h('span', { class: 'mm-count' }, String(materialsService.collectNotebookIds(node, p.grouped).length)),
      h('span', { class: 'mm-row-actions' }, [
        h('button', { class: 'mm-icon-btn', title: t('matmgr.addChild'), onClick: (e) => { e.stopPropagation(); p.onAddChild(node.id) } }, [h(IconPlus)]),
        h('button', { class: 'mm-icon-btn', title: t('matmgr.rename'), onClick: (e) => { e.stopPropagation(); p.onRename(node) } }, [h(IconPencil)]),
        h('button', { class: 'mm-icon-btn', title: t('matmgr.move'), onClick: (e) => { e.stopPropagation(); p.onMove(node) } }, [h(IconMove)])
      ])
    ])
  ]

  if (isExpanded) {
    const kids = []
    for (const nb of (p.grouped.get(node.id) || [])) {
      kids.push(
        h('label', { class: 'mm-row mm-row-nb', key: 'nb-' + nb.id }, [
          h('input', {
            type: 'checkbox',
            class: 'mm-check',
            checked: p.pickedNotebookIds.has(nb.id),
            onChange: () => p.onPickNotebook(nb.id)
          }),
          h('span', { class: 'mm-nb-icon' }, '📄'),
          h('span', { class: 'mm-name', title: nb.title }, nb.title),
          h('span', { class: 'mm-count' }, String(nb.sources?.length || 0))
        ])
      )
    }
    for (const child of node.children || []) {
      kids.push(h(MMNode, { ...p, node: child, key: 'c-' + child.id }))
    }
    rows.push(h('div', { class: 'mm-children', key: 'ch-' + node.id }, kids))
  }

  return h('div', { class: 'mm-node' }, rows)
}
MMNode.props = ['node', 'grouped', 'expanded', 'pickedNodeIds', 'pickedNotebookIds']
</script>

<style scoped>
.mm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}
.mm-modal {
  background: var(--bg-dark);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  width: min(960px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-light);
}
.mm-header h2 { margin: 0; font-size: 1.05rem; color: white; }
.mm-close {
  background: none; border: none; color: var(--text-secondary);
  font-size: 1.6rem; cursor: pointer; line-height: 1;
}
.mm-close:hover { color: white; }

.mm-toolbar {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border-light);
  flex-wrap: wrap;
  align-items: center;
}
.mm-spacer { flex: 1; }
.mm-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--border-light);
  color: var(--text-primary);
  padding: 0.42rem 0.8rem;
  border-radius: 8px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}
.mm-btn:hover:not(:disabled) { border-color: var(--accent-primary); color: white; }
.mm-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.mm-danger:hover:not(:disabled) { border-color: var(--danger-color); color: var(--danger-color); }
.mm-accent { background: var(--accent-gradient); border: none; color: white; }
.mm-accent:hover:not(:disabled) { filter: brightness(1.1); color: white; }
.mm-ghost { background: transparent; }

.mm-body {
  display: flex;
  gap: 0;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}
.mm-tree {
  flex: 1.4;
  overflow-y: auto;
  padding: 0.75rem;
  border-right: 1px solid var(--border-light);
}
.mm-empty { color: var(--text-muted); text-align: center; padding: 2rem 0.5rem; font-size: 0.85rem; }

.mm-side {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  min-width: 240px;
}
.mm-side h3 { margin: 0 0 0.4rem; font-size: 0.9rem; color: white; }
.mm-hint { font-size: 0.76rem; color: var(--text-muted); margin: 0 0 0.7rem; line-height: 1.45; }
.mm-picked { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.mm-picked li {
  font-size: 0.78rem; color: var(--text-secondary);
  background: rgba(255,255,255,0.04);
  border-radius: 6px; padding: 0.28rem 0.55rem;
}

.mm-ai-groups { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 0.8rem; }
.mm-ai-group {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
}
.mm-ai-path { display: flex; flex-wrap: wrap; gap: 0.15rem; margin-bottom: 0.35rem; }
.mm-path-seg { font-size: 0.74rem; color: #a5b4fc; font-weight: 600; }
.mm-ai-group ul { margin: 0; padding-left: 1.1rem; }
.mm-ai-group li { font-size: 0.76rem; color: var(--text-secondary); }
.mm-ai-actions { display: flex; gap: 0.5rem; }

.mm-dialog {
  border-top: 1px solid var(--border-light);
  padding: 0.9rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  background: rgba(0,0,0,0.25);
}
.mm-dialog label { font-size: 0.8rem; color: var(--text-secondary); }
.mm-dialog input, .mm-dialog select {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  color: white;
  padding: 0.45rem 0.65rem;
  font-size: 0.85rem;
}
.mm-dialog input:focus, .mm-dialog select:focus { outline: none; border-color: var(--accent-primary); }
.mm-dialog-actions { display: flex; gap: 0.5rem; }

.mm-error {
  margin: 0;
  padding: 0.6rem 1.25rem;
  color: var(--danger-color);
  font-size: 0.78rem;
  border-top: 1px solid rgba(239,68,68,0.3);
  background: rgba(239,68,68,0.07);
}
</style>

<!-- Unscoped: rows are rendered by the MMNode functional component, which does
     not receive the scoped data-v attribute, so these must be global. -->
<style>
.mm-node { user-select: none; }
.mm-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.35rem;
  border-radius: 7px;
  min-height: 30px;
}
.mm-row:hover { background: rgba(255,255,255,0.04); }
.mm-row-root .mm-name { font-weight: 600; color: white; }
.mm-children { margin-left: 1.15rem; border-left: 1px dashed rgba(255,255,255,0.08); padding-left: 0.35rem; }

.mm-caret {
  width: 14px; height: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--text-muted); cursor: pointer; flex-shrink: 0;
}
.mm-caret::before {
  content: '';
  border-left: 5px solid currentColor;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  transition: transform 0.15s;
}
.mm-caret.expanded::before { transform: rotate(90deg); }
.mm-caret-hidden { visibility: hidden; }

.mm-check { accent-color: var(--accent-primary); cursor: pointer; }

.mm-name {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mm-count {
  font-size: 0.68rem; color: var(--text-muted);
  background: rgba(255,255,255,0.06);
  border-radius: 999px; padding: 0.05rem 0.42rem;
}
.mm-nb-icon { font-size: 0.75rem; }

.mm-row-actions { display: none; gap: 0.2rem; }
.mm-row:hover .mm-row-actions { display: inline-flex; }
.mm-icon-btn {
  background: transparent; border: none; color: var(--text-muted);
  cursor: pointer; font-size: 0.78rem; padding: 0.15rem 0.3rem; border-radius: 5px;
  display: inline-flex; align-items: center;
}
.mm-icon-btn:hover { color: white; background: rgba(255,255,255,0.08); }
</style>
