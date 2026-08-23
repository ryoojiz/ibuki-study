<template>
  <div class="mp-root" ref="rootEl">
    <button type="button" class="mp-trigger" @click="open = !open">
      <span class="mp-trigger-label" :class="{ placeholder: !currentPath.length }">
        {{ currentPath.length ? currentPath.join(' › ') : t('matmgr.rootLevel') }}
      </span>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </button>

    <div v-if="open" class="mp-dropdown">
      <button type="button" class="mp-option mp-option-none" :class="{ selected: !modelValue }" @click="pick(null)">
        — {{ t('matmgr.rootLevel') }} —
      </button>
      <div class="mp-tree">
        <template v-for="node in tree" :key="node.id">
          <MPRow :node="node" :depth="0" />
        </template>
      </div>
      <p v-if="!tree.length" class="mp-empty">{{ t('ctx.emptyTree') }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, h, onMounted, onBeforeUnmount, defineProps, defineEmits } from 'vue'
import { dbService } from '../services/db'
import { materialsService } from '../services/materials'
import { i18n } from '../services/i18n'

const t = i18n.t

const props = defineProps({
  modelValue: { type: String, default: null }
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const flat = ref([])
const rootEl = ref(null)

const tree = computed(() => materialsService.buildTree(flat.value))
const index = computed(() => materialsService.indexById(flat.value))
const currentPath = computed(() =>
  props.modelValue ? materialsService.getPathNames(index.value, props.modelValue) : []
)

function pick(id) {
  emit('update:modelValue', id)
  open.value = false
}

const onDocClick = (e) => {
  if (rootEl.value && !rootEl.value.contains(e.target)) open.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  dbService.getMaterials().then(m => { flat.value = m }).catch(() => {})
})
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

 // Recursive row renderer
 const MPRow = (p) => {
   const node = p.node
   const isSelected = props.modelValue === node.id
   const row = h(
     'button',
     {
       type: 'button',
       class: ['mp-option', { selected: isSelected }],
       style: { paddingLeft: `${0.55 + p.depth * 0.9}rem` },
       onClick: (e) => { e.stopPropagation(); pick(node.id) }
     },
     [
       h('span', { class: 'mp-dot' }),
       h('span', { class: 'mp-label' }, node.name)
     ]
   )
   const kids = (node.children || []).map(c => h(MPRow, { node: c, depth: p.depth + 1, key: c.id }))
   return h('div', { class: 'mp-branch' }, [row, ...kids])
 }
 MPRow.props = ['node', 'depth']
</script>

<style scoped>
.mp-root { position: relative; width: 100%; }
.mp-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  color: white;
  padding: 0.5rem 0.7rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.mp-trigger:hover { border-color: var(--accent-primary); }
.mp-trigger-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-trigger-label.placeholder { color: var(--text-muted); }

.mp-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 50;
  background: #1e1e2e;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  max-height: 260px;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
.mp-tree { padding: 0.25rem; }
.mp-empty { color: var(--text-muted); font-size: 0.78rem; text-align: center; padding: 0.8rem; margin: 0; }
</style>

<!-- Unscoped: options are rendered by the MPRow functional component, which does
     not receive the scoped data-v attribute, so these must be global. -->
<style>
.mp-branch { min-width: 0; }

.mp-option {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 0.82rem;
  padding: 0.42rem 0.55rem;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}
.mp-option:hover { background: rgba(255,255,255,0.07); }
.mp-option.selected { color: #a5b4fc; }
.mp-option-none {
  border-bottom: 1px solid var(--border-light);
  border-radius: 10px 10px 0 0;
  color: var(--text-secondary);
}
.mp-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent-primary);
  flex-shrink: 0;
  opacity: 0.7;
}
.mp-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
