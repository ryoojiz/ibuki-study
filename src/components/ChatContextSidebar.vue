<template>
  <aside class="ctx-sidebar">
    <div class="ctx-tabs">
      <button :class="['ctx-tab', { active: activeTab === 'sources' }]" @click="activeTab = 'sources'">
        {{ t('ctx.tabSources') }}
      </button>
      <button class="ctx-tab ctx-tab-disabled" :title="t('ctx.historySoon')">
        {{ t('ctx.tabHistory') }}
      </button>
      <button class="ctx-close" @click="$emit('close')" :title="t('ctx.hide')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <template v-if="activeTab === 'sources'">
      <div class="ctx-search">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input v-model="searchQuery" type="text" :placeholder="t('ctx.searchPlaceholder')">
      </div>

      <div class="ctx-tree">
        <p v-if="!tree.length" class="ctx-empty">{{ t('ctx.emptyTree') }}</p>

        <!-- Unsorted notebooks bucket -->
        <div v-if="unsortedNotebooks.length" class="ctx-node">
          <div class="ctx-row ctx-row-root">
            <span class="ctx-caret ctx-caret-hidden"></span>
            <span :class="['ctx-check', unsortedState]" @click="toggleUnsorted"></span>
            <span class="ctx-name">{{ t('ctx.unsorted') }}</span>
            <span class="ctx-count">{{ unsortedNotebooks.length }}</span>
          </div>
          <div class="ctx-children">
            <label v-for="nb in unsortedNotebooks" :key="nb.id" class="ctx-row ctx-row-nb">
              <span :class="['ctx-check', selectedIds.has(nb.id) ? 'all' : 'none']" @click.prevent="$emit('update:selectedIds', toggledSet(nb.id))"></span>
              <span class="ctx-nb-icon">📄</span>
              <span class="ctx-name" :title="nb.title">{{ nb.title }}</span>
              <span class="ctx-count">{{ nb.sources?.length || 0 }}</span>
            </label>
          </div>
        </div>

        <!-- Material tree -->
        <TreeNode
          v-for="node in filteredTree"
          :key="node.id"
          :node="node"
          :grouped-notebooks="groupedNotebooks"
          :selected-ids="selectedIds"
          :expanded-ids="expandedIds"
          :search-query="searchQuery"
          @toggle-node="onToggleNode"
          @toggle-notebook="id => $emit('update:selectedIds', toggledSet(id))"
          @toggle-expand="id => toggleExpand(id)"
        />
      </div>

      <div class="ctx-footer">
        <div class="ctx-stats">
          {{ t('ctx.included', { notebooks: selectedNotebookCount, sources: selectedSourceCount }) }}
        </div>
        <div class="ctx-actions">
          <button class="ctx-btn" @click="selectAll">{{ t('ctx.all') }}</button>
          <button class="ctx-btn" @click="clearAll">{{ t('ctx.none') }}</button>
        </div>
      </div>
    </template>

    <div v-else class="ctx-history-placeholder">
      <div class="empty-icon">🕘</div>
      <h3>{{ t('ctx.tabHistory') }}</h3>
      <p>{{ t('ctx.historySoon') }}</p>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits, h } from 'vue'
import { materialsService } from '../services/materials'
import { i18n } from '../services/i18n'

const t = i18n.t

const props = defineProps({
  tree: { type: Array, default: () => [] },
  groupedNotebooks: { type: Object, required: true }, // Map<materialId|null, notebook[]>
  allNotebooks: { type: Array, default: () => [] },
  selectedIds: { type: Object, required: true }, // Set<notebookId>
  open: { type: Boolean, default: true }
})

const emit = defineEmits(['update:selectedIds', 'close'])

const activeTab = ref('sources')
const searchQuery = ref('')
const expandedIds = ref(new Set())

// Recursive tree node renderer
const TreeNode = (nodeProps) => {
  const node = nodeProps.node
  const state = materialsService.nodeSelectionState(node, props.groupedNotebooks, props.selectedIds)
  const matches = materialsService.nodeMatchesSearch(node, props.groupedNotebooks, nodeProps.searchQuery)
  if (!matches) return null

  const isExpanded = nodeProps.expandedIds.has(node.id)
  const hasChildren = node.children?.length || (props.groupedNotebooks.get(node.id) || []).length

  const rows = []
  rows.push(
    h('div', { class: 'ctx-row' + (node.depth === 0 ? ' ctx-row-root' : ''), key: 'row-' + node.id }, [
      h('span', {
        class: ['ctx-caret', hasChildren ? '' : 'ctx-caret-hidden', isExpanded ? 'expanded' : ''],
        onClick: (e) => { e.stopPropagation(); nodeProps.onToggleExpand(node.id) }
      }),
      h('span', {
        class: ['ctx-check', state],
        onClick: (e) => { e.stopPropagation(); nodeProps.onToggleNode(node, state !== 'all') }
      }),
      h('span', {
        class: 'ctx-name',
        title: node.name,
        onClick: () => nodeProps.onToggleExpand(node.id)
      }, node.name),
      h('span', { class: 'ctx-count' }, String(materialsService.collectNotebookIds(node, props.groupedNotebooks).length))
    ])
  )

  if (isExpanded) {
    const childRows = []
    for (const nb of (props.groupedNotebooks.get(node.id) || [])) {
      childRows.push(
        h('label', { class: 'ctx-row ctx-row-nb', key: 'nb-' + nb.id }, [
          h('span', {
            class: ['ctx-check', nodeProps.selectedIds.has(nb.id) ? 'all' : 'none'],
            onClick: (e) => { e.preventDefault(); e.stopPropagation(); nodeProps.onToggleNotebook(nb.id) }
          }),
          h('span', { class: 'ctx-nb-icon' }, '📄'),
          h('span', { class: 'ctx-name', title: nb.title }, nb.title),
          h('span', { class: 'ctx-count' }, String(nb.sources?.length || 0))
        ])
      )
    }
    for (const child of node.children || []) {
      childRows.push(h(TreeNode, { ...nodeProps, node: child, key: 'child-' + child.id }))
    }
    rows.push(h('div', { class: 'ctx-children', key: 'ch-' + node.id }, childRows))
  }

  return h('div', { class: 'ctx-node' }, rows)
}
TreeNode.props = ['node', 'groupedNotebooks', 'selectedIds', 'expandedIds', 'searchQuery']

const filteredTree = computed(() => {
  if (!searchQuery.value.trim()) return props.tree
  return props.tree.filter(n => materialsService.nodeMatchesSearch(n, props.groupedNotebooks, searchQuery.value.trim()))
})

const unsortedNotebooks = computed(() => props.groupedNotebooks.get(null) || [])

const unsortedState = computed(() => {
  const list = unsortedNotebooks.value
  if (!list.length) return 'none'
  const count = list.filter(nb => props.selectedIds.has(nb.id)).length
  return count === 0 ? 'none' : (count === list.length ? 'all' : 'some')
})

const selectedNotebookCount = computed(() => props.selectedIds.size)

const selectedSourceCount = computed(() =>
  materialsService.countSources(props.allNotebooks.filter(nb => props.selectedIds.has(nb.id)))
)

function toggleExpand(id) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function toggledSet(notebookId) {
  const next = new Set(props.selectedIds)
  if (next.has(notebookId)) next.delete(notebookId)
  else next.add(notebookId)
  return next
}

function onToggleNode(node, include) {
  const ids = materialsService.collectNotebookIds(node, props.groupedNotebooks)
  const next = new Set(props.selectedIds)
  for (const id of ids) {
    if (include) next.add(id)
    else next.delete(id)
  }
  emit('update:selectedIds', next)
}

function toggleUnsorted() {
  const include = unsortedState.value !== 'all'
  const next = new Set(props.selectedIds)
  for (const nb of unsortedNotebooks.value) {
    if (include) next.add(nb.id)
    else next.delete(nb.id)
  }
  emit('update:selectedIds', next)
}

function selectAll() {
  emit('update:selectedIds', new Set(props.allNotebooks.map(nb => nb.id)))
}

function clearAll() {
  emit('update:selectedIds', new Set())
}
</script>

<style scoped>
.ctx-sidebar {
  display: flex;
  flex-direction: column;
  width: 300px;
  min-width: 300px;
  height: 100%;
  background: var(--bg-card);
  border-left: 1px solid var(--border-light);
}

.ctx-tabs {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.6rem 0.6rem 0 0.6rem;
  border-bottom: 1px solid var(--border-light);
}

.ctx-tab {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: 0.5rem 0.7rem;
  font-size: 0.82rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.ctx-tab.active {
  color: white;
  border-bottom-color: var(--accent-primary);
}

.ctx-tab-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ctx-close {
  margin-left: auto;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.35rem;
  border-radius: 6px;
}
.ctx-close:hover { background: var(--border-light); color: white; }

.ctx-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem;
  color: var(--text-muted);
}
.ctx-search input {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  color: white;
  font-size: 0.82rem;
}
.ctx-search input:focus { outline: none; border-color: var(--accent-primary); }

.ctx-tree {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0.5rem 1rem;
}

.ctx-empty {
  color: var(--text-muted);
  font-size: 0.82rem;
  text-align: center;
  padding: 1.5rem 0.5rem;
}

.ctx-footer {
  border-top: 1px solid var(--border-light);
  padding: 0.6rem 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.ctx-stats { font-size: 0.72rem; color: var(--text-secondary); }
.ctx-actions { display: flex; gap: 0.5rem; }
.ctx-btn {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  border-radius: 7px;
  padding: 0.3rem 0;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}
.ctx-btn:hover { color: white; border-color: var(--accent-primary); }

.ctx-history-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  color: var(--text-muted);
  padding: 2rem 1rem;
  text-align: center;
}
.ctx-history-placeholder h3 { color: var(--text-secondary); font-size: 1rem; margin: 0; }
.ctx-history-placeholder p { font-size: 0.78rem; margin: 0; }
</style>

<!-- Unscoped: tree rows are rendered by the TreeNode functional component, which
     does not receive the scoped data-v attribute, so these must be global. -->
<style>
.ctx-node { user-select: none; }

.ctx-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.32rem 0.35rem;
  border-radius: 7px;
  cursor: default;
  min-height: 28px;
}
.ctx-row:hover { background: rgba(255,255,255,0.04); }
.ctx-row-root .ctx-name { font-weight: 600; color: white; }

.ctx-children { margin-left: 1.15rem; border-left: 1px dashed rgba(255,255,255,0.08); padding-left: 0.35rem; }

.ctx-caret {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s;
  position: relative;
}
.ctx-caret::before {
  content: '';
  border-left: 5px solid currentColor;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  display: block;
  transition: transform 0.15s;
}
.ctx-caret.expanded::before { transform: rotate(90deg); }
.ctx-caret-hidden { visibility: hidden; }

/* Tri-state checkbox */
.ctx-check {
  width: 15px;
  height: 15px;
  border-radius: 4px;
  border: 1.5px solid var(--text-muted);
  flex-shrink: 0;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
  background: transparent;
}
.ctx-check.all {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
}
.ctx-check.all::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
  border-right: 2px solid white;
  border-bottom: 2px solid white;
  transform: rotate(45deg);
}
.ctx-check.some {
  border-color: var(--accent-primary);
}
.ctx-check.some::after {
  content: '';
  position: absolute;
  left: 2.5px;
  top: 5.5px;
  width: 7px;
  height: 2px;
  background: var(--accent-primary);
}

.ctx-name {
  flex: 1;
  font-size: 0.83rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.ctx-row-nb .ctx-name { cursor: pointer; }

.ctx-nb-icon { font-size: 0.75rem; }

.ctx-count {
  font-size: 0.68rem;
  color: var(--text-muted);
  background: rgba(255,255,255,0.06);
  border-radius: 999px;
  padding: 0.05rem 0.42rem;
  flex-shrink: 0;
}
</style>
