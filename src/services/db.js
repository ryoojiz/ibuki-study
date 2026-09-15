import { supabase } from './supabase'
import { authService } from './auth'

export const dbService = {
  async getUserId() {
    const user = await authService.getCurrentUser()
    if (!user) throw new Error("User not authenticated")
    return user.id
  },

  async getProfile() {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 is "no rows found"
    return data
  },

  async updateProfile(updates) {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        ...updates,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async uploadSource(userId, file) {
    const fileName = `${userId}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('sources')
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('sources')
      .getPublicUrl(fileName);

    return publicUrl;
  },

  async uploadChatImage(file) {
    if (!file?.type?.startsWith('image/')) throw new Error('Only image attachments are supported.')
    const userId = await this.getUserId()
    const url = await this.uploadSource(userId, file)
    return { name: file.name, type: file.type, url }
  },

  async saveNotebook(notebook, originalFiles = []) {
    const userId = await this.getUserId()
    
    // Chat-generated notebooks already contain securely uploaded source URLs.
    const sourcesWithUrls = originalFiles.length ? [] : [...(notebook.sources || [])];
    
    // Upload original files to storage
    for (let i = 0; i < originalFiles.length; i++) {
      const file = originalFiles[i];
      const sourceMeta = notebook.sources[i];
      
      try {
        const url = await this.uploadSource(userId, file);
        sourcesWithUrls.push({
          ...sourceMeta,
          url: url
        });
      } catch (e) {
        console.error(`Failed to upload ${file.name}:`, e);
        sourcesWithUrls.push({
          ...sourceMeta,
          url: null // Mark as failed
        });
      }
    }

    const { data, error } = await supabase
      .from('notebooks')
      .upsert({
        id: notebook.id || undefined,
        user_id: userId,
        title: notebook.title,
        subject: notebook.subject,
        material: notebook.material,
        summary: notebook.summary,
        transcription: notebook.transcription,
        sources: sourcesWithUrls,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getAllNotebooks() {
    const userId = await this.getUserId()

    const { data, error } = await supabase
      .from('notebooks')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data
  },

  async getNotebook(id) {
    const userId = await this.getUserId()
    console.log('Fetching notebook with id:', id, 'for user:', userId);

    const { data, error } = await supabase
      .from('notebooks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Supabase error in getNotebook:', error);
      throw error
    }
    return data
  },

  async getNotebooksBySubject(subject) {
    const userId = await this.getUserId()

    const { data, error } = await supabase
      .from('notebooks')
      .select('*')
      .eq('subject', subject)
      .eq('user_id', userId)

    if (error) throw error
    return data
  },

  async getMaterialRelationships() {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('material_relationships')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  async createMaterialRelationship({ sourceNotebookId, targetNotebookId, relationType, origin = 'manual', confidence = null }) {
    if (!sourceNotebookId || !targetNotebookId || sourceNotebookId === targetNotebookId) {
      throw new Error('Choose two different materials.')
    }

    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('material_relationships')
      .upsert({
        user_id: userId,
        source_notebook_id: sourceNotebookId,
        target_notebook_id: targetNotebookId,
        relation_type: relationType,
        origin,
        confidence,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,source_notebook_id,target_notebook_id,relation_type' })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateMaterialRelationship(id, { sourceNotebookId, targetNotebookId, relationType }) {
    const userId = await this.getUserId()
    const updates = { origin: 'manual', updated_at: new Date().toISOString() }
    if (sourceNotebookId) updates.source_notebook_id = sourceNotebookId
    if (targetNotebookId) updates.target_notebook_id = targetNotebookId
    if (relationType) updates.relation_type = relationType

    const { data, error } = await supabase
      .from('material_relationships')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteMaterialRelationship(id) {
    const userId = await this.getUserId()
    const { error } = await supabase
      .from('material_relationships')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
  },

  async replaceAiMaterialRelationships(sourceNotebookId, relationships) {
    const userId = await this.getUserId()
    const { data: manualLinks, error: manualError } = await supabase
      .from('material_relationships')
      .select('target_notebook_id, relation_type')
      .eq('user_id', userId)
      .eq('source_notebook_id', sourceNotebookId)
      .eq('origin', 'manual')

    if (manualError) throw manualError

    const manualKeys = new Set((manualLinks || []).map(link => `${link.target_notebook_id}:${link.relation_type}`))
    const { error: deleteError } = await supabase
      .from('material_relationships')
      .delete()
      .eq('user_id', userId)
      .eq('source_notebook_id', sourceNotebookId)
      .eq('origin', 'ai')

    if (deleteError) throw deleteError

    const rows = relationships
      .filter(relationship => !manualKeys.has(`${relationship.targetNotebookId}:${relationship.relationType}`))
      .map(relationship => ({
        user_id: userId,
        source_notebook_id: sourceNotebookId,
        target_notebook_id: relationship.targetNotebookId,
        relation_type: relationship.relationType,
        origin: 'ai',
        confidence: relationship.confidence ?? null,
        updated_at: new Date().toISOString()
      }))

    if (!rows.length) return []

    const { data, error } = await supabase
      .from('material_relationships')
      .upsert(rows, { onConflict: 'user_id,source_notebook_id,target_notebook_id,relation_type' })
      .select()

    if (error) throw error
    return data || []
  },

  async deleteNotebook(id) {
    const userId = await this.getUserId()

    const { error: nbError } = await supabase
      .from('notebooks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (nbError) throw nbError

    await supabase
      .from('chats')
      .delete()
      .eq('notebook_id', id)
      .eq('user_id', userId)
  },

  async saveFlashcards(notebookId, flashcards) {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('notebooks')
      .update({
        flashcards: flashcards,
        updated_at: new Date().toISOString()
      })
      .eq('id', notebookId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async saveQuiz({ notebookId = null, subject = null, difficulty = null, focus = null, questions = [] }) {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        user_id: userId,
        notebook_id: notebookId || null,
        subject: subject || null,
        difficulty: difficulty || null,
        focus: focus || null,
        questions: questions,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getQuizzesByNotebook(notebookId) {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('notebook_id', notebookId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getQuizzesBySubject(subject) {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('subject', subject)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async deleteQuiz(id) {
    const userId = await this.getUserId()
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
  },

  async updateQuizProgress(id, progress) {
    const userId = await this.getUserId()
    const { error } = await supabase
      .from('quizzes')
      .update({ progress })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
  },

  localStudyDate(date = new Date()) {
    const offsetMs = date.getTimezoneOffset() * 60 * 1000
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10)
  },

  async recordStudyDay() {
    const userId = await this.getUserId()
    const { error } = await supabase
      .from('study_days')
      .upsert({ user_id: userId, study_date: this.localStudyDate() }, { onConflict: 'user_id,study_date', ignoreDuplicates: true })
    if (error) throw error
  },

  async getStudyStreak() {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('study_days')
      .select('study_date')
      .eq('user_id', userId)
      .order('study_date', { ascending: false })
    if (error) throw error

    const dates = new Set((data || []).map(row => row.study_date))
    const today = this.localStudyDate()
    let cursor = new Date(`${today}T12:00:00`)
    let streak = 0
    while (dates.has(this.localStudyDate(cursor))) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
    return { streak, studiedToday: dates.has(today) }
  },

  async saveChatMessage(chatMsg) {
    const userId = await this.getUserId()

    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: userId,
        notebook_id: chatMsg.notebookId || null,
        conversation_id: chatMsg.conversationId || null,
        role: chatMsg.role,
        content: chatMsg.content,
        meta: chatMsg.meta || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getChatHistory(notebookId = null) {
    const userId = await this.getUserId()

    let query = supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)

    if (notebookId) {
      query = query.eq('notebook_id', notebookId)
    }

    const { data, error } = await query.order('created_at', { ascending: true })

    if (error) throw error
    return data
  },

  async clearChatHistory(notebookId = null) {
    const userId = await this.getUserId()

    let query = supabase
      .from('chats')
      .delete()
      .eq('user_id', userId)

    if (notebookId) {
      query = query.eq('notebook_id', notebookId)
    }

    const { error } = await query
    if (error) throw error
  },

  // Conversation sessions are scoped to a notebook, a subject, or global chat.
  async getConversations(scopeKey) {
    const userId = await this.getUserId()
    const { data, error } = await supabase.from('conversations').select('*').eq('user_id', userId).eq('scope_key', scopeKey).order('updated_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async createConversation(scopeKey, title = 'New conversation') {
    const userId = await this.getUserId()
    const now = new Date().toISOString()
    const { data, error } = await supabase.from('conversations').insert({ user_id: userId, scope_key: scopeKey, title, created_at: now, updated_at: now }).select().single()
    if (error) throw error
    return data
  },

  async updateConversation(id, updates) {
    const userId = await this.getUserId()
    const { data, error } = await supabase.from('conversations').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select().single()
    if (error) throw error
    return data
  },

  async getConversationMessages(conversationId) {
    const userId = await this.getUserId()
    const { data, error } = await supabase.from('chats').select('*').eq('user_id', userId).eq('conversation_id', conversationId).order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  },

  async deleteConversation(id) {
    const userId = await this.getUserId()
    const { error } = await supabase.from('conversations').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error
  },
  // -----------------------------------------------------------------------
  // Materials tree (unified relational hierarchy: subject roots -> materials)
  // -----------------------------------------------------------------------

  async getMaterials() {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  },

  async createMaterial({ name, parentId = null }) {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('materials')
      .insert({
        user_id: userId,
        parent_id: parentId,
        name: name.trim()
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async renameMaterial(id, name) {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('materials')
      .update({ name: name.trim() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async moveMaterial(id, newParentId) {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('materials')
      .update({ parent_id: newParentId })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Deletes material nodes; sub-materials cascade, notebooks are unassigned.
  async deleteMaterials(ids) {
    if (!ids?.length) return
    const userId = await this.getUserId()
    const { error } = await supabase
      .from('materials')
      .delete()
      .in('id', ids)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Assign notebooks to a material node and keep the denormalized
   * legacy strings (subject / material) in sync with the tree.
   * materialId may be null (unassign).
   */
  async assignNotebooksToMaterial(notebookIds, materialId, treeIndex = null) {
    if (!notebookIds?.length) return
    const userId = await this.getUserId()

    // Resolve denormalized labels from the tree when an index is provided
    let subjectLabel = null
    let materialLabel = null
    if (materialId && treeIndex) {
      const node = treeIndex.get(materialId)
      if (node) {
        materialLabel = node.name
        let cur = node.parent_id
        while (cur) {
          const parent = treeIndex.get(cur)
          if (!parent) break
          subjectLabel = parent.name
          cur = parent.parent_id
        }
        // Node IS a root: it is its own subject
        if (!subjectLabel) subjectLabel = node.name
      }
    }

    for (const nbId of notebookIds) {
      const updates = { material_id: materialId, updated_at: new Date().toISOString() }
      if (treeIndex) {
        if (subjectLabel !== null) updates.subject = subjectLabel
        updates.material = materialLabel || ''
      }
      const { error } = await supabase
        .from('notebooks')
        .update(updates)
        .eq('id', nbId)
        .eq('user_id', userId)
      if (error) throw error
    }
  },

  /**
   * Find-or-create a chain of nodes by path names, e.g.
   * ['Mathematics', 'Calculus', 'Limits'] -> returns the leaf node.
   */
  async ensureMaterialPath(pathNames) {
    const names = (pathNames || []).map(p => String(p).trim()).filter(Boolean)
    if (!names.length) return null

    const existing = await this.getMaterials()
    let parentId = null
    let leaf = null

    for (const name of names) {
      const match =
        existing.find(m => m.parent_id === parentId && m.name === name) ||
        existing.find(m => m.parent_id === parentId && m.name.toLowerCase() === name.toLowerCase())
      if (match) {
        leaf = match
        parentId = match.id
      } else {
        leaf = await this.createMaterial({ name, parentId })
        existing.push(leaf)
        parentId = leaf.id
      }
    }
    return leaf
  },

  /**
   * Re-sync denormalized subject/material strings on notebooks from the
   * current tree. Only issues updates where values actually differ.
   */
  async resyncNotebookLabels() {
    const [materials, notebooks] = await Promise.all([
      this.getMaterials(),
      this.getAllNotebooks()
    ])
    const index = new Map(materials.map(m => [m.id, m]))

    for (const nb of notebooks) {
      if (!nb.material_id) continue
      const node = index.get(nb.material_id)
      if (!node) continue

      let subjectLabel = null
      let cur = node.parent_id
      while (cur) {
        const parent = index.get(cur)
        if (!parent) break
        subjectLabel = parent.name
        cur = parent.parent_id
      }
      if (!subjectLabel) subjectLabel = node.name
      const materialLabel = node.parent_id ? node.name : ''

      if (nb.subject !== subjectLabel || nb.material !== materialLabel) {
        const { error } = await supabase
          .from('notebooks')
          .update({
            subject: subjectLabel,
            material: materialLabel,
            updated_at: new Date().toISOString()
          })
          .eq('id', nb.id)
          .eq('user_id', await this.getUserId())
        if (error) throw error
      }
    }
  },

  async updateNotebook(notebookId, updates) {
    const userId = await this.getUserId()
    const { data, error } = await supabase
      .from('notebooks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', notebookId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }
}
