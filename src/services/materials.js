/**
 * Materials tree service
 * ----------------------
 * Pure helpers for the unified relational material tree (adjacency list).
 *
 * A flat node looks like: { id, parent_id, name, sort_order, created_at }
 * A tree node is a flat node plus: { children: [treeNode...] , depth }
 */

export const materialsService = {
  /**
   * Build a nested tree from a flat adjacency list.
   * Orphans (parent missing) are promoted to roots for resilience.
   */
  buildTree(flat) {
    const nodes = new Map()
    const roots = []
    for (const n of flat || []) {
      nodes.set(n.id, { ...n, children: [], depth: 0 })
    }
    for (const node of nodes.values()) {
      const parent = node.parent_id ? nodes.get(node.parent_id) : null
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
    const sortRec = (list, depth) => {
      list.sort((a, b) =>
        (a.sort_order - b.sort_order) || a.name.localeCompare(b.name)
      )
      for (const n of list) {
        n.depth = depth
        sortRec(n.children, depth + 1)
      }
    }
    sortRec(roots, 0)
    return roots
  },

  /** Flatten a tree back to an ordered list (depth-first). */
  flattenTree(tree) {
    const out = []
    const walk = (nodes) => {
      for (const n of nodes || []) {
        out.push(n)
        walk(n.children)
      }
    }
    walk(tree)
    return out
  },

  /** Map of id -> flat node for quick lookups. */
  indexById(flat) {
    return new Map((flat || []).map(n => [n.id, n]))
  },

  /**
   * Ancestor chain for a node id: [root, ..., parent] (excluding the node).
   */
  getAncestors(index, id) {
    const chain = []
    let cur = index.get(id)?.parent_id
    while (cur) {
      const node = index.get(cur)
      if (!node) break
      chain.unshift(node)
      cur = node.parent_id
    }
    return chain
  },

  /**
   * Full path names for a node id including itself:
   * e.g. ['Mathematics', 'Calculus', 'Limits']
   */
  getPathNames(index, id) {
    const node = index.get(id)
    if (!node) return []
    return [...this.getAncestors(index, id).map(a => a.name), node.name]
  },

  /** All descendant ids of a node (excluding the node itself). */
  getDescendantIds(index, id) {
    const out = new Set()
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()
      for (const n of index.values()) {
        if (n.parent_id === cur && !out.has(n.id)) {
          out.add(n.id)
          stack.push(n.id)
        }
      }
    }
    return out
  },

  /**
   * Would moving `nodeId` under `newParentId` create a cycle?
   * (i.e. newParent is the node itself or one of its descendants)
   */
  wouldCreateCycle(index, nodeId, newParentId) {
    if (!newParentId) return false
    if (nodeId === newParentId) return true
    return this.getDescendantIds(index, nodeId).has(newParentId)
  },

  /**
   * Group notebooks by their material_id.
   * Returns Map<material_id|null, notebook[]>.
   */
  groupNotebooksByMaterial(notebooks) {
    const map = new Map()
    for (const nb of notebooks || []) {
      const key = nb.material_id ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(nb)
    }
    return map
  },

  /**
   * Collect all notebook ids that live under a tree node
   * (the node itself + every descendant), given a grouping map.
   */
  collectNotebookIds(node, groupedNotebooks) {
    const ids = []
    const own = groupedNotebooks.get(node.id) || []
    ids.push(...own.map(nb => nb.id))
    for (const child of node.children || []) {
      ids.push(...this.collectNotebookIds(child, groupedNotebooks))
    }
    return ids
  },

  /**
   * Tri-state for a checkbox over a node's descendant notebooks.
   * selectedIds: Set<notebookId>
   * Returns 'all' | 'some' | 'none'
   */
  nodeSelectionState(node, groupedNotebooks, selectedIds) {
    const ids = this.collectNotebookIds(node, groupedNotebooks)
    if (ids.length === 0) return 'none'
    let count = 0
    for (const id of ids) if (selectedIds.has(id)) count++
    if (count === 0) return 'none'
    if (count === ids.length) return 'all'
    return 'some'
  },

  /**
   * Does any notebook under this node match the search query?
   * Used by sidebar filtering.
   */
  nodeMatchesSearch(node, groupedNotebooks, query) {
    if (!query) return true
    const q = query.toLowerCase()
    if (node.name.toLowerCase().includes(q)) return true
    const own = groupedNotebooks.get(node.id) || []
    if (own.some(nb => (nb.title || '').toLowerCase().includes(q))) return true
    return (node.children || []).some(c => this.nodeMatchesSearch(c, groupedNotebooks, query))
  },

  /** Count sources across a list of notebooks. */
  countSources(notebooks) {
    return (notebooks || []).reduce((sum, nb) => sum + (nb.sources?.length || 0), 0)
  }
}