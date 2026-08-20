/**
 * Ibuki Application Controller
 * Manages UI state, views, database operations, and AI workflows.
 */

// Global Application State
const state = {
  notebooks: [],
  currentView: 'dashboard',
  currentSources: [],
  activeNotebook: null,
  activeChatHistory: [],
  // Chat context: { type: 'notebook'|'subject'|'material', id: string, name: string }
  chatContext: null,
  globalChatHistory: []
};

// Safe Markdown Parser
function renderMarkdown(text) {
  if (!text) return '';

  // Use marked.js library if loaded
  if (window.marked && typeof window.marked.parse === 'function') {
    try {
      return window.marked.parse(text);
    } catch (e) {
      console.warn('marked.js failed to parse, falling back to simple regex parser:', e);
    }
  }

  // Fallback simple regex Markdown renderer
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Code Blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Lists (simple conversion)
  html = html.replace(/^\s*[\*\-]\s+(.*)$/gim, '<li>$1</li>');

  // Wrap list items
  // Since we replace line-by-line, we just have list items floating. This is a basic fallback.

  // Newlines
  html = html.replace(/\n/g, '<br>');

  return html;
}

// Format Dates
function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Generate unique IDs
function generateUUID() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Initialize Authentication
    await window.ibukiAuth.init();

    // 2. Only proceed with app initialization if user is authenticated
    const user = await window.ibukiAuth.getCurrentUser();
    if (user) {
      // Initialize AI config UI elements
      initSettingsView();
      updateAPIStatusBadge();

      // Load Notebooks & Populate Layout
      await refreshData();

      // Attach General Listeners
      attachEventListeners();

      // Direct to Dashboard
      switchView('dashboard');
      console.log('Ibuki initialized successfully for user:', user.email);
    }
  } catch (error) {
    console.error('Failed to initialize Ibuki App:', error);
    alert('Failed to initialize application. Please reload or check console.');
  }
});

// --- DATA ACCESS & REFRESH ---
async function refreshData() {
  state.notebooks = await window.ibukiDB.getAllNotebooks();

  // Update stats cards
  const subjects = getUniqueSubjects();
  const indexMaterials = getUniqueMaterials();
  document.getElementById('stat-notebook-count').textContent = state.notebooks.length;
  document.getElementById('stat-subject-count').textContent = subjects.length;
  document.getElementById('stat-material-count').textContent = indexMaterials.length;

  renderSidebarCategories();
  renderDashboard();
}

// Get unique subjects list
function getUniqueSubjects() {
  const list = state.notebooks.map(nb => nb.subject).filter(Boolean);
  return [...new Set(list)].sort();
}

// Get unique materials list
function getUniqueMaterials() {
  const list = state.notebooks.map(nb => nb.material).filter(Boolean);
  return [...new Set(list)].sort();
}

// --- VIEW NAVIGATION SYSTEM ---
function switchView(viewId) {
  state.currentView = viewId;

  // Hide all view panels
  const views = ['dashboard-view', 'creator-view', 'notebook-view', 'chat-view', 'settings-view'];
  views.forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });

  // Show target view panel
  document.getElementById(`${viewId}-view`).classList.remove('hidden');

  // Deactivate all sidebar items, activate current if applicable
  document.querySelectorAll('.sidebar .nav-item').forEach(item => {
    item.classList.remove('active');
  });

  if (viewId === 'dashboard') {
    document.getElementById('nav-dashboard').classList.add('active');
  } else if (viewId === 'settings') {
    document.getElementById('nav-settings').classList.add('active');
  } else if (viewId === 'chat' && state.chatContext?.type === 'global') {
    document.getElementById('nav-global-chat').classList.add('active');
  }

  // Highlight active subject/material sidebar items
  if (state.chatContext && (viewId === 'chat')) {
    const listId = state.chatContext.type === 'subject' ? 'sidebar-subjects' : 'sidebar-materials';
    const items = document.querySelectorAll(`#${listId} .nav-item`);
    items.forEach(item => {
      if (item.dataset.name === state.chatContext.name) {
        item.classList.add('active');
      }
    });
  }

  // Scroll views to top
  document.querySelector('.main-content').scrollTop = 0;
}

// --- RENDER SIDEBAR ---
function renderSidebarCategories() {
  const subjects = getUniqueSubjects();
  const materials = getUniqueMaterials();

  const subjectsContainer = document.getElementById('sidebar-subjects');
  const materialsContainer = document.getElementById('sidebar-materials');

  // 1. Subjects
  if (subjects.length === 0) {
    subjectsContainer.innerHTML = `<li class="text-center mt-1"><span style="font-size:0.75rem; color:var(--text-muted);">No subjects yet</span></li>`;
  } else {
    subjectsContainer.innerHTML = subjects.map(sub => `
      <li>
        <div class="nav-item sidebar-sub-link" data-name="${sub}" onclick="startSubjectChat('${sub}')">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sub}</span>
        </div>
      </li>
    `).join('');
  }

  // 2. Materials
  if (materials.length === 0) {
    materialsContainer.innerHTML = `<li class="text-center mt-1"><span style="font-size:0.75rem; color:var(--text-muted);">No topics yet</span></li>`;
  } else {
    materialsContainer.innerHTML = materials.map(mat => `
      <li>
        <div class="nav-item sidebar-mat-link" data-name="${mat}" onclick="startMaterialChat('${mat}')">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a1.44 1.44 0 002.036 0l4.318-4.318a1.44 1.44 0 000-2.036L11.16 3.659A2.25 2.25 0 009.568 3z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 7.5h.008v.008H6V7.5z" />
          </svg>
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${mat}</span>
        </div>
      </li>
    `).join('');
  }
}

// --- RENDER DASHBOARD ---
function renderDashboard(filterQuery = '') {
  const notebooksGrid = document.getElementById('dashboard-notebooks-grid');
  const subjectsGrid = document.getElementById('dashboard-subjects-grid');

  // Filter notebooks if query exists
  const filteredNotebooks = state.notebooks.filter(nb => {
    if (!filterQuery) return true;
    const query = filterQuery.toLowerCase();
    return (
      nb.title.toLowerCase().includes(query) ||
      nb.subject.toLowerCase().includes(query) ||
      nb.material.toLowerCase().includes(query) ||
      nb.summary.toLowerCase().includes(query)
    );
  });

  // Render recent notebooks
  if (filteredNotebooks.length === 0) {
    notebooksGrid.innerHTML = `
      <div class="empty-state w-full" style="grid-column: 1 / -1;">
        <div class="empty-icon">📝</div>
        <h3>No notebooks found</h3>
        <p>You haven't created any notebooks yet, or none match your search criteria.</p>
        <button class="btn-new-notebook" onclick="initNotebookCreator()" style="margin: 0 auto;">Create Notebook</button>
      </div>
    `;
  } else {
    notebooksGrid.innerHTML = filteredNotebooks.map(nb => {
      const sourceCount = nb.sources ? nb.sources.length : 0;
      const imagesCount = nb.sources ? nb.sources.filter(s => s.type === 'image').length : 0;
      const textCount = nb.sources ? nb.sources.filter(s => s.type === 'text').length : 0;

      return `
        <div class="notebook-card" onclick="openNotebookDetail('${nb.id}')">
          <div class="notebook-tags">
            <span class="tag tag-subject">${nb.subject}</span>
            <span class="tag tag-material">${nb.material}</span>
          </div>
          <h3>${nb.title}</h3>
          <p class="notebook-desc">${nb.summary ? nb.summary.replace(/[#*`]/g, '').slice(0, 120) + '...' : 'No summary generated yet.'}</p>
          <div class="notebook-footer">
            <span>${formatDate(nb.createdDate)}</span>
            <div class="source-badges">
              <span class="badge-count" title="Text notes">
                📝 ${textCount}
              </span>
              <span class="badge-count" title="Whiteboard captures / Images">
                📷 ${imagesCount}
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render subjects statistics grids
  const subjects = getUniqueSubjects();
  if (subjects.length === 0) {
    subjectsGrid.innerHTML = `
      <div class="empty-state w-full" style="grid-column: 1 / -1; padding: 2rem;">
        <p style="color:var(--text-secondary);">No subjects created yet. Upload a notebook to get started!</p>
      </div>
    `;
  } else {
    subjectsGrid.innerHTML = subjects.map(sub => {
      const count = state.notebooks.filter(nb => nb.subject === sub).length;
      return `
        <div class="subject-card" onclick="startSubjectChat('${sub}')">
          <div>
            <h3>${sub}</h3>
            <p>${count} lesson${count === 1 ? '' : 's'} recorded under this subject.</p>
          </div>
          <div class="subject-meta">
            <span>Interactive AI ready</span>
            <button class="btn-chat-subject" onclick="event.stopPropagation(); startSubjectChat('${sub}')">Chat Subject</button>
          </div>
        </div>
      `;
    }).join('');
  }
}

// --- CREATOR (NOTEBOOK CREATION WORKFLOW) ---
function initNotebookCreator() {
  // Clear creator state
  state.currentSources = [];
  document.getElementById('creator-text-input').value = '';
  document.getElementById('creator-sources-list').innerHTML = '';
  document.getElementById('btn-creator-analyze').disabled = true;

  // Clear analysis result forms
  document.getElementById('result-title').value = '';
  document.getElementById('result-subject').value = '';
  document.getElementById('result-material').value = '';
  document.getElementById('result-transcription').value = '';
  document.getElementById('result-summary').value = '';

  // Datalists updates
  updateCreatorDatalists();

  // Hide loader / show result inputs (empty initially)
  document.getElementById('creator-loading-panel').classList.add('hidden');
  document.getElementById('creator-result-form').classList.remove('hidden');

  switchView('creator');
}

function updateCreatorDatalists() {
  const subjects = getUniqueSubjects();
  const subDatalist = document.getElementById('subjects-datalist');
  subDatalist.innerHTML = subjects.map(s => `<option value="${s}">`).join('');

  const materials = getUniqueMaterials();
  const matDatalist = document.getElementById('materials-datalist');
  matDatalist.innerHTML = materials.map(m => `<option value="${m}">`).join('');
}

// Process new sources added
function handleSourceAdd(type, name, content) {
  const id = generateUUID();
  state.currentSources.push({ id, type, name, content });
  renderCreatorSources();
  document.getElementById('btn-creator-analyze').disabled = false;
}

function renderCreatorSources() {
  const list = document.getElementById('creator-sources-list');
  if (state.currentSources.length === 0) {
    list.innerHTML = '';
    document.getElementById('btn-creator-analyze').disabled = true;
    return;
  }

  list.innerHTML = state.currentSources.map(src => {
    const isImage = src.type === 'image';
    const previewHtml = isImage
      ? `<img src="${src.content}" class="source-thumb">`
      : `<div class="source-thumb" style="display:flex; align-items:center; justify-content:center; font-size:1.25rem;">📝</div>`;

    return `
      <div class="source-item" data-id="${src.id}">
        ${previewHtml}
        <div class="source-details">
          <div class="source-name">${src.name}</div>
          <div class="source-meta-tag">${isImage ? 'Image Source' : 'Text Summary'}</div>
        </div>
        <button class="btn-remove-source" onclick="removeSource('${src.id}')" title="Delete Source">
          ✕
        </button>
      </div>
    `;
  }).join('');
}

function removeSource(id) {
  state.currentSources = state.currentSources.filter(src => src.id !== id);
  renderCreatorSources();
}

// --- NOTEBOOK DETAILS tabs ---
function initTabs(container) {
  const tabs = container.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Toggle active tab buttons
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Toggle active tab content panels
      const activeTabName = tab.dataset.tab;
      const contentPanels = ['summary', 'sources', 'transcript'];
      contentPanels.forEach(panel => {
        const panelEl = document.getElementById(`tab-${panel}-content`);
        if (panel === activeTabName) {
          panelEl.classList.remove('hidden');
        } else {
          panelEl.classList.add('hidden');
        }
      });
    });
  });
}

async function openNotebookDetail(id) {
  const nb = await window.ibukiDB.getNotebook(id);
  if (!nb) return;

  state.activeNotebook = nb;

  // Populate Notebook Information
  document.getElementById('nb-detail-title').textContent = nb.title;
  document.getElementById('nb-detail-subject').textContent = nb.subject;
  document.getElementById('nb-detail-material').textContent = nb.material;
  document.getElementById('nb-detail-date').textContent = `Created: ${formatDate(nb.createdDate)}`;

  // Populate Tab 1: Study Guide Summary (Markdown rendered)
  const summaryRenderEl = document.getElementById('markdown-summary-render');
  summaryRenderEl.innerHTML = renderMarkdown(nb.summary);

  // Populate Tab 2: Sources Gallery
  const galleryEl = document.getElementById('nb-detail-gallery');
  if (!nb.sources || nb.sources.length === 0) {
    galleryEl.innerHTML = `<p style="color:var(--text-muted); grid-column:1/-1; text-align:center;">No sources uploaded.</p>`;
  } else {
    galleryEl.innerHTML = nb.sources.map((src, index) => {
      if (src.type === 'image') {
        return `
          <div class="gallery-card" onclick="openMediaModal('${src.content}')">
            <img src="${src.content}" class="gallery-img">
            <div class="gallery-card-info">${src.name || `Whiteboard #${index + 1}`}</div>
          </div>
        `;
      } else {
        return `
          <div class="gallery-card" onclick="openTextSourceModal('${escapeHTML(src.content)}', '${escapeHTML(src.name)}')">
            <div class="gallery-text-placeholder">
              <div class="gallery-text-icon">📝</div>
              <div style="font-size:0.75rem; overflow:hidden; text-overflow:ellipsis; width:100%;">${escapeHTML(src.content.slice(0, 60)) + '...'}</div>
            </div>
            <div class="gallery-card-info">${src.name || `Text Notes`}</div>
          </div>
        `;
      }
    }).join('');
  }

  // Populate Tab 3: Transcription
  const transcriptEl = document.getElementById('nb-detail-transcription');
  transcriptEl.textContent = nb.transcription || 'No text transcribed for this notebook.';

  // Initialize Notebook Level Chat Context
  state.chatContext = {
    type: 'notebook',
    id: nb.id,
    name: nb.title
  };

  document.getElementById('chat-scope-label').textContent = `Querying notebook: "${nb.title}"`;

  // Set up Tab listeners
  initTabs(document.getElementById('notebook-view'));

  // Load local chat history
  state.activeChatHistory = await window.ibukiDB.getChatHistory(nb.id);
  renderNotebookChat();

  switchView('notebook');
}

// Escaping content for safe HTML embeds
function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// --- CHAT SYSTEM LOGIC ---
function renderNotebookChat() {
  const container = document.getElementById('notebook-chat-messages');
  if (state.activeChatHistory.length === 0) {
    container.innerHTML = `
      <div class="chat-bubble assistant">
        Hi! I've loaded your whiteboard OCR, synthesized text, and summary. What part of **"${state.activeNotebook.title}"** should I clarify for you?
      </div>
    `;
    return;
  }

  container.innerHTML = state.activeChatHistory.map(msg => `
    <div class="chat-bubble ${msg.sender}">
      ${msg.sender === 'assistant' ? renderMarkdown(msg.text) : escapeHTML(msg.text)}
    </div>
  `).join('');

  container.scrollTop = container.scrollHeight;
}

async function sendNotebookChatMessage() {
  const input = document.getElementById('notebook-chat-input');
  const text = input.value.trim();
  if (!text) return;

  // Append user message
  const userMsg = { sender: 'user', text, timestamp: Date.now() };
  state.activeChatHistory.push(userMsg);
  renderNotebookChat();
  input.value = '';
  await window.ibukiDB.saveChatHistory(state.activeNotebook.id, state.activeChatHistory);

  // Show typing loader
  const container = document.getElementById('notebook-chat-messages');
  const typingBubble = document.createElement('div');
  typingBubble.className = 'chat-bubble assistant typing-bubble';
  typingBubble.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  container.appendChild(typingBubble);
  container.scrollTop = container.scrollHeight;

  // Setup prompt context
  // Include OCR transcription + summary study guide
  const contextText = `
Notebook Summary:
${state.activeNotebook.summary}

Full Text & Whiteboard OCR Transcription:
${state.activeNotebook.transcription}
`;

  let assistantMsgBubble = null;

  try {
    const response = await window.ibukiAI.chat(
      state.activeChatHistory,
      state.activeNotebook.title,
      'notebook',
      contextText,
      (streamedText) => {
        // Remove typing bubble
        const typingEl = container.querySelector('.typing-bubble');
        if (typingEl) typingEl.remove();

        // Create the streaming bubble if not created
        if (!assistantMsgBubble) {
          assistantMsgBubble = document.createElement('div');
          assistantMsgBubble.className = 'chat-bubble assistant';
          container.appendChild(assistantMsgBubble);
        }

        // Render the partial markdown
        assistantMsgBubble.innerHTML = renderMarkdown(streamedText);
        container.scrollTop = container.scrollHeight;
      }
    );

    // Save final reply
    const assistantMsg = { sender: 'assistant', text: response, timestamp: Date.now() };
    state.activeChatHistory.push(assistantMsg);
    renderNotebookChat();

    await window.ibukiDB.saveChatHistory(state.activeNotebook.id, state.activeChatHistory);
  } catch (error) {
    console.error('Chat AI call failed:', error);

    const typingEl = container.querySelector('.typing-bubble');
    if (typingEl) typingEl.remove();

    const systemMsg = { sender: 'system', text: `Failed to connect to AI API. Error: ${error.message}. Verify settings.`, timestamp: Date.now() };
    state.activeChatHistory.push(systemMsg);
    renderNotebookChat();
  }
}

// --- GLOBAL CHATS (SUBJECT/MATERIAL CHAT ASSISTANT) ---
async function startSubjectChat(subjectName) {
  state.chatContext = {
    type: 'subject',
    id: `subject_${subjectName}`,
    name: subjectName
  };

  document.getElementById('global-chat-title').textContent = `${subjectName} Assistant`;
  document.getElementById('global-chat-description').textContent = `Query consolidated lessons, summaries, and transcripts stored in Subject "${subjectName}".`;
  document.getElementById('panel-chat-scope-title').textContent = `${subjectName} Portal`;
  document.getElementById('panel-chat-scope-subtitle').textContent = `Consolidating notes under "${subjectName}"`;

  // Get aggregated context of all notebooks in this subject
  const subjectNotebooks = state.notebooks.filter(nb => nb.subject === subjectName);

  // Fetch History
  state.globalChatHistory = await window.ibukiDB.getChatHistory(state.chatContext.id);
  renderGlobalChat(subjectNotebooks.length);

  switchView('chat');
}

async function startMaterialChat(materialName) {
  state.chatContext = {
    type: 'material',
    id: `material_${materialName}`,
    name: materialName
  };

  document.getElementById('global-chat-title').textContent = `${materialName} Assistant`;
  document.getElementById('global-chat-description').textContent = `Query consolidated lessons, summaries, and transcripts stored in Topic "${materialName}".`;
  document.getElementById('panel-chat-scope-title').textContent = `${materialName} Portal`;
  document.getElementById('panel-chat-scope-subtitle').textContent = `Consolidating notes under topic "${materialName}"`;

  // Get aggregated context of all notebooks in this material
  const materialNotebooks = state.notebooks.filter(nb => nb.material === materialName);

  // Fetch History
  state.globalChatHistory = await window.ibukiDB.getChatHistory(state.chatContext.id);
  renderGlobalChat(materialNotebooks.length);

  switchView('chat');
}

function renderGlobalChat(notebooksCount) {
  const container = document.getElementById('global-chat-messages');
  if (state.globalChatHistory.length === 0) {
    container.innerHTML = `
      <div class="chat-bubble assistant">
        Welcome! I have gathered context from <strong>${notebooksCount}</strong> lesson notebook(s) cataloged under the <strong>${state.chatContext.name}</strong> ${state.chatContext.type}. 
        <br><br>
        Ask me anything regarding definitions, formulas, or connections between these notebooks!
      </div>
    `;
    return;
  }

  container.innerHTML = state.globalChatHistory.map(msg => `
    <div class="chat-bubble ${msg.sender}">
      ${msg.sender === 'assistant' ? renderMarkdown(msg.text) : escapeHTML(msg.text)}
    </div>
  `).join('');

  container.scrollTop = container.scrollHeight;
}

async function sendGlobalChatMessage() {
  const input = document.getElementById('global-chat-input');
  const text = input.value.trim();
  if (!text) return;

  // Append user message
  const userMsg = { sender: 'user', text, timestamp: Date.now() };
  state.globalChatHistory.push(userMsg);

  // Count relevant notebooks for display
  const matchingNotebooks = state.chatContext.type === 'subject'
    ? state.notebooks.filter(nb => nb.subject === state.chatContext.name)
    : state.notebooks.filter(nb => nb.material === state.chatContext.name);

  renderGlobalChat(matchingNotebooks.length);
  input.value = '';
  await window.ibukiDB.saveChatHistory(state.chatContext.id, state.globalChatHistory);

  // Show typing loader
  const container = document.getElementById('global-chat-messages');
  const typingBubble = document.createElement('div');
  typingBubble.className = 'chat-bubble assistant typing-bubble';
  typingBubble.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  container.appendChild(typingBubble);
  container.scrollTop = container.scrollHeight;

  // Consolidate texts
  let contextText = '';
  matchingNotebooks.forEach((nb, index) => {
    contextText += `
--- Notebook #${index + 1}: ${nb.title} (Topic: ${nb.material}) ---
Study Summary:
${nb.summary}

Full OCR Transcript:
${nb.transcription}
\n`;
  });

  let assistantMsgBubble = null;

  try {
    const response = await window.ibukiAI.chat(
      state.globalChatHistory,
      state.chatContext.name,
      state.chatContext.type,
      contextText,
      (streamedText) => {
        // Remove typing bubble
        const typingEl = container.querySelector('.typing-bubble');
        if (typingEl) typingEl.remove();

        // Create the streaming bubble if not created
        if (!assistantMsgBubble) {
          assistantMsgBubble = document.createElement('div');
          assistantMsgBubble.className = 'chat-bubble assistant';
          container.appendChild(assistantMsgBubble);
        }

        // Render the partial markdown
        assistantMsgBubble.innerHTML = renderMarkdown(streamedText);
        container.scrollTop = container.scrollHeight;
      }
    );

    // Save final reply
    const assistantMsg = { sender: 'assistant', text: response, timestamp: Date.now() };
    state.globalChatHistory.push(assistantMsg);
    renderGlobalChat(matchingNotebooks.length);

    await window.ibukiDB.saveChatHistory(state.chatContext.id, state.globalChatHistory);
  } catch (error) {
    console.error('Global Chat AI call failed:', error);

    const currentTyping = container.querySelector('.typing-bubble');
    if (currentTyping) currentTyping.remove();

    const systemMsg = { sender: 'system', text: `Failed to connect to AI API. Error: ${error.message}. Verify settings.`, timestamp: Date.now() };
    state.globalChatHistory.push(systemMsg);
    renderGlobalChat(matchingNotebooks.length);
  }
}

// --- SETTINGS CONTROLLER ---
function initSettingsView() {
  const conf = window.ibukiAI.config;
  document.getElementById('settings-demo-mode').checked = conf.useDemoMode;
  document.getElementById('settings-base-url').value = conf.baseUrl;
  document.getElementById('settings-api-key').value = conf.apiKey;
  document.getElementById('settings-chat-model').value = conf.chatModel;
  document.getElementById('settings-vision-model').value = conf.visionModel;
  document.getElementById('settings-language').value = conf.language || 'English';

  toggleAPISettingsFields(conf.useDemoMode);
}

function toggleAPISettingsFields(isDemo) {
  const fields = document.getElementById('settings-api-fields');
  if (isDemo) {
    fields.style.opacity = '0.5';
    fields.querySelectorAll('input').forEach(i => i.disabled = true);
  } else {
    fields.style.opacity = '1';
    fields.querySelectorAll('input').forEach(i => i.disabled = false);
  }
}

function updateAPIStatusBadge() {
  const conf = window.ibukiAI.config;
  const statusDot = document.getElementById('api-status-dot');
  const statusText = document.getElementById('api-status-text');

  statusDot.className = 'status-dot'; // reset class

  if (conf.useDemoMode) {
    statusDot.classList.add('demo');
    statusText.textContent = 'Simulated Demo Mode';
  } else if (conf.apiKey) {
    statusDot.classList.add('online');
    statusText.textContent = 'Custom API Connected';
  } else {
    statusText.textContent = 'API Key Required';
  }
}

// --- MEDIA MODALS ---
function openMediaModal(base64Image) {
  const modal = document.getElementById('media-modal');
  const modalImg = document.getElementById('media-modal-img');

  modalImg.src = base64Image;
  modal.classList.add('open');
}

function openTextSourceModal(textContent, title) {
  // Use the same media modal but structure it as a text pop-up.
  // We can render text content dynamically on standard layout.
  // Or just alert/modal. A modal with text is much cleaner.
  const modal = document.getElementById('media-modal');
  const modalImg = document.getElementById('media-modal-img');

  // Let's create a temporary text block instead of the image if it is text
  // We'll replace modalImg temporarily
  const container = modal.querySelector('.media-modal-content');

  // Remove existing text viewer if any
  const oldText = container.querySelector('.text-modal-viewer');
  if (oldText) oldText.remove();

  modalImg.style.display = 'none';

  const textViewer = document.createElement('div');
  textViewer.className = 'text-modal-viewer';
  textViewer.style.background = 'var(--bg-dark)';
  textViewer.style.color = 'var(--text-primary)';
  textViewer.style.padding = '2rem';
  textViewer.style.borderRadius = '12px';
  textViewer.style.border = '1px solid var(--border-light)';
  textViewer.style.maxHeight = '80vh';
  textViewer.style.overflowY = 'auto';
  textViewer.style.whiteSpace = 'pre-wrap';
  textViewer.style.fontSize = '0.95rem';
  textViewer.style.lineHeight = '1.6';
  textViewer.style.width = '600px';
  textViewer.style.maxWidth = '100%';

  textViewer.innerHTML = `<h3 style="border-bottom:1px solid var(--border-light); padding-bottom:0.75rem; margin-bottom:1rem; font-family:var(--font-heading); color:white;">${title}</h3><p>${textContent}</p>`;
  container.appendChild(textViewer);

  modal.classList.add('open');
}

function closeMediaModal() {
  const modal = document.getElementById('media-modal');
  const modalImg = document.getElementById('media-modal-img');
  modalImg.style.display = 'block';

  const textViewer = modal.querySelector('.text-modal-viewer');
  if (textViewer) textViewer.remove();

  modal.classList.remove('open');
}

// --- GLOBAL EVENT LISTENERS ATTACHMENT ---
function attachEventListeners() {
  // Sidebar Nav Links
  document.getElementById('nav-dashboard').addEventListener('click', () => switchView('dashboard'));
  document.getElementById('nav-global-chat').addEventListener('click', () => {
    state.chatContext = { type: 'global', id: 'global_chat', name: 'Global Assistant' };
    document.getElementById('global-chat-title').textContent = `Global Assistant`;
    document.getElementById('global-chat-description').textContent = `Query concepts aggregated across all notebook entries in the database.`;
    document.getElementById('panel-chat-scope-title').textContent = `Ibuki Portal`;
    document.getElementById('panel-chat-scope-subtitle').textContent = `Consolidating details across all lessons`;

    // Load historical global assistant chat
    window.ibukiDB.getChatHistory('global_chat').then(history => {
      state.globalChatHistory = history;
      renderGlobalChat(state.notebooks.length);
      switchView('chat');
    });
  });

  document.getElementById('nav-settings').addEventListener('click', () => {
    initSettingsView();
    switchView('settings');
  });

  document.getElementById('btn-sidebar-create').addEventListener('click', initNotebookCreator);
  document.getElementById('btn-dashboard-new').addEventListener('click', initNotebookCreator);

  // Search Input (Real-time dashboard filtering)
  document.getElementById('global-search').addEventListener('input', (e) => {
    if (state.currentView !== 'dashboard') {
      switchView('dashboard');
    }
    renderDashboard(e.target.value);
  });

  // Settings Toggles
  document.getElementById('settings-demo-mode').addEventListener('change', (e) => {
    toggleAPISettingsFields(e.target.checked);
  });

  document.getElementById('btn-settings-save').addEventListener('click', () => {
    const isDemo = document.getElementById('settings-demo-mode').checked;
    const baseUrl = document.getElementById('settings-base-url').value.trim();
    const apiKey = document.getElementById('settings-api-key').value.trim();
    const chatModel = document.getElementById('settings-chat-model').value.trim();
    const visionModel = document.getElementById('settings-vision-model').value.trim();
    const language = document.getElementById('settings-language').value;

    if (!isDemo && !apiKey) {
      showSettingsAlert('API Key is required if Demo Mode is turned off.', 'error');
      return;
    }

    window.ibukiAI.saveConfig({
      useDemoMode: isDemo,
      baseUrl: baseUrl || 'https://api.openai.com/v1',
      apiKey,
      chatModel: chatModel || 'gpt-4o-mini',
      visionModel: visionModel || 'gpt-4o',
      language: language
    });

    updateAPIStatusBadge();
    showSettingsAlert('Configuration settings saved successfully!', 'success');
  });

  document.getElementById('btn-settings-test').addEventListener('click', async () => {
    const isDemo = document.getElementById('settings-demo-mode').checked;
    const baseUrl = document.getElementById('settings-base-url').value.trim();
    const apiKey = document.getElementById('settings-api-key').value.trim();
    const chatModel = document.getElementById('settings-chat-model').value.trim();

    // Temporarily apply configuration for connection testing
    const tempConfig = {
      useDemoMode: isDemo,
      baseUrl: baseUrl || 'https://api.openai.com/v1',
      apiKey,
      chatModel: chatModel || 'gpt-4o-mini'
    };

    const originalConfig = { ...window.ibukiAI.config };
    window.ibukiAI.config = { ...window.ibukiAI.config, ...tempConfig };

    showSettingsAlert('Testing API Connection. Please wait...', 'info');

    const result = await window.ibukiAI.testConnection();

    // Restore configuration
    window.ibukiAI.config = originalConfig;

    if (result.success) {
      showSettingsAlert(result.message, 'success');
    } else {
      showSettingsAlert(`Connection Failed: ${result.message}`, 'error');
    }
  });

  // Creator Source Upload Handlers (Drag and Drop / File Input)
  const dropzone = document.getElementById('creator-dropzone');
  const fileInput = document.getElementById('creator-file-input');

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    processUploadedFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', (e) => {
    processUploadedFiles(e.target.files);
  });

  // Creator manual drafts text source addition
  document.getElementById('creator-text-input').addEventListener('input', (e) => {
    const text = e.target.value.trim();
    if (text.length > 5) {
      document.getElementById('btn-creator-analyze').disabled = false;
    } else if (state.currentSources.length === 0) {
      document.getElementById('btn-creator-analyze').disabled = true;
    }
  });

  // Analysis Trigger
  document.getElementById('btn-creator-analyze').addEventListener('click', async () => {
    const textDraft = document.getElementById('creator-text-input').value.trim();

    // If text draft is written, insert it as a source
    if (textDraft) {
      handleSourceAdd('text', 'Typed Lecture Notes Draft', textDraft);
      document.getElementById('creator-text-input').value = ''; // clear text draft
    }

    if (state.currentSources.length === 0) {
      alert('Please enter text notes or upload images before running AI analysis.');
      return;
    }

    // Disable buttons and show skeletons
    document.getElementById('btn-creator-analyze').disabled = true;
    document.getElementById('creator-loading-panel').classList.remove('hidden');
    document.getElementById('creator-result-form').classList.add('hidden');

    try {
      const data = await window.ibukiAI.analyzeSources(state.currentSources);

      // Populate results inputs
      document.getElementById('result-title').value = data.title || 'Untitled Notebook';
      document.getElementById('result-subject').value = data.subject || 'General';
      document.getElementById('result-material').value = data.material || 'Study Notes';
      document.getElementById('result-transcription').value = data.transcription || '';
      document.getElementById('result-summary').value = data.summary || '';

      // Reveal results form
      document.getElementById('creator-loading-panel').classList.add('hidden');
      document.getElementById('creator-result-form').classList.remove('hidden');
    } catch (error) {
      console.error('OCR Synthesis Analysis failed:', error);
      alert(`AI Analysis failed: ${error.message}. Double check your API settings.`);
      document.getElementById('creator-loading-panel').classList.add('hidden');
      document.getElementById('creator-result-form').classList.remove('hidden');
      document.getElementById('btn-creator-analyze').disabled = false;
    }
  });

  // Saving Notebook
  document.getElementById('btn-creator-save').addEventListener('click', async () => {
    const title = document.getElementById('result-title').value.trim();
    const subject = document.getElementById('result-subject').value.trim();
    const material = document.getElementById('result-material').value.trim();
    const transcription = document.getElementById('result-transcription').value;
    const summary = document.getElementById('result-summary').value;

    if (!title || !subject || !material) {
      alert('Please fill out Title, Subject, and Topic/Material categories before saving.');
      return;
    }

    const notebook = {
      id: generateUUID(),
      title,
      subject,
      material,
      transcription,
      summary,
      sources: state.currentSources, // Array of base64 images and texts
      createdDate: new Date().toISOString()
    };

    try {
      await window.ibukiDB.saveNotebook(notebook);
      await refreshData();
      switchView('dashboard');
    } catch (e) {
      console.error('Failed to save notebook:', e);
      alert('Could not save notebook to browser storage. Check available disk space.');
    }
  });

  // Notebook View deletion & Navigation Back buttons
  document.getElementById('btn-nb-back-dashboard').addEventListener('click', () => switchView('dashboard'));
  document.getElementById('btn-global-chat-back').addEventListener('click', () => switchView('dashboard'));

  document.getElementById('btn-delete-notebook').addEventListener('click', async () => {
    if (!state.activeNotebook) return;
    if (confirm(`Are you absolutely sure you want to delete "${state.activeNotebook.title}"? This cannot be undone.`)) {
      await window.ibukiDB.deleteNotebook(state.activeNotebook.id);
      await refreshData();
      switchView('dashboard');
    }
  });

  // Individual Notebook Chat Form Submit
  document.getElementById('notebook-chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    sendNotebookChatMessage();
  });

  document.getElementById('btn-clear-notebook-chat').addEventListener('click', async () => {
    if (!state.activeNotebook) return;
    if (confirm('Clear notebook chat session logs?')) {
      await window.ibukiDB.clearChatHistory(state.activeNotebook.id);
      state.activeChatHistory = [];
      renderNotebookChat();
    }
  });

  // Consolidated Group Chat Form Submit
  document.getElementById('global-chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    sendGlobalChatMessage();
  });

  document.getElementById('btn-clear-global-chat').addEventListener('click', async () => {
    if (!state.chatContext) return;
    if (confirm('Clear consolidated chat logs for this topic?')) {
      await window.ibukiDB.clearChatHistory(state.chatContext.id);
      state.globalChatHistory = [];

      const matchingCount = state.chatContext.type === 'subject'
        ? state.notebooks.filter(nb => nb.subject === state.chatContext.name).length
        : state.notebooks.filter(nb => nb.material === state.chatContext.name).length;

      renderGlobalChat(matchingCount);
    }
  });

  // Media Modal Closing Events
  document.getElementById('btn-close-media-modal').addEventListener('click', closeMediaModal);
  document.getElementById('media-modal').addEventListener('click', (e) => {
    if (e.target.id === 'media-modal') {
      closeMediaModal();
    }
  });
}

// Compress image client-side to keep base64 payloads under 1MB
function compressImage(base64Str, maxDimension = 1600, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Handle scaling if dimensions exceed maximum threshold
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed jpeg
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    img.onerror = (err) => reject(err);
  });
}

// Processing File Upload attachments into Base64 format with automatic compression
function processUploadedFiles(files) {
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) {
      alert(`Only images are supported for whiteboard uploads. File "${file.name}" was skipped.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      // Compress the loaded base64 representation
      compressImage(e.target.result, 1600, 0.75)
        .then(compressedBase64 => {
          handleSourceAdd('image', file.name, compressedBase64);
        })
        .catch(err => {
          console.warn('Image compression failed, falling back to original quality:', err);
          handleSourceAdd('image', file.name, e.target.result);
        });
    };
    reader.onerror = () => {
      alert(`Error reading file "${file.name}".`);
    };
    reader.readAsDataURL(file);
  });
}

// Settings feedback alert
function showSettingsAlert(message, type) {
  const alertEl = document.getElementById('settings-alert');
  alertEl.className = 'alert-message'; // clear previous styles

  if (type === 'success') {
    alertEl.classList.add('success');
  } else if (type === 'error') {
    alertEl.classList.add('error');
  } else {
    // Info notification
    alertEl.style.display = 'block';
    alertEl.style.background = 'rgba(99, 102, 241, 0.1)';
    alertEl.style.border = '1px solid rgba(99, 102, 241, 0.2)';
    alertEl.style.color = '#c7d2fe';
  }

  alertEl.textContent = message;

  // Auto scroll settings card to reveal message
  document.querySelector('.settings-card').scrollTop = alertEl.offsetTop;
}
