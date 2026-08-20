/**
 * Ibuki Database Manager
 * Migrated from IndexedDB to Supabase.
 * Handles storage of notebooks and chat histories.
 */

const db = {
  // Helper to get current user ID
  async getUserId() {
    const user = await ibukiAuth.getCurrentUser();
    if (!user) throw new Error("User not authenticated");
    return user.id;
  },

  // --- Notebook Operations ---

  async saveNotebook(notebook) {
    const userId = await this.getUserId();

    const { data, error } = await ibukiAuth.supabase
      .from('notebooks')
      .upsert({
        id: notebook.id || undefined, // Let Supabase generate UUID if new
        user_id: userId,
        title: notebook.title,
        subject: notebook.subject,
        material: notebook.material,
        summary: notebook.summary,
        transcription: notebook.transcription,
        sources: notebook.sources,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getAllNotebooks() {
    const userId = await this.getUserId();

    const { data, error } = await ibukiAuth.supabase
      .from('notebooks')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getNotebook(id) {
    const userId = await this.getUserId();

    const { data, error } = await ibukiAuth.supabase
      .from('notebooks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  async deleteNotebook(id) {
    const userId = await this.getUserId();

    // Delete notebook and its associated chats
    const { error: nbError } = await ibukiAuth.supabase
      .from('notebooks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (nbError) throw nbError;

    await ibukiAuth.supabase
      .from('chats')
      .delete()
      .eq('notebook_id', id)
      .eq('user_id', userId);
  },

  // --- Chat History Operations ---

  async saveChatMessage(chatMsg) {
    const userId = await this.getUserId();

    const { data, error } = await ibukiAuth.supabase
      .from('chats')
      .insert({
        user_id: userId,
        notebook_id: chatMsg.notebookId || null,
        role: chatMsg.role,
        content: chatMsg.content,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getChatHistory(notebookId = null) {
    const userId = await this.getUserId();

    let query = ibukiAuth.supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId);

    if (notebookId) {
      query = query.eq('notebook_id', notebookId);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async clearChatHistory(notebookId = null) {
    const userId = await this.getUserId();

    let query = ibukiAuth.supabase
      .from('chats')
      .delete()
      .eq('user_id', userId);

    if (notebookId) {
      query = query.eq('notebook_id', notebookId);
    }

    const { error } = await query;
    if (error) throw error;
  }
};

window.db = db;