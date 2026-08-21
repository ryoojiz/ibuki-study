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

  async saveNotebook(notebook, originalFiles = []) {
    const userId = await this.getUserId()
    
    const sourcesWithUrls = [];
    
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

    const { data, error } = await supabase
      .from('notebooks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) throw error
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

  async saveChatMessage(chatMsg) {
    const userId = await this.getUserId()

    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: userId,
        notebook_id: chatMsg.notebookId || null,
        role: chatMsg.role,
        content: chatMsg.content,
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
  }
}