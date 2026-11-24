<template>
  <div class="admin-view">
    <h1>Admin — Usage &amp; Accounts</h1>
    <p v-if="!isAdmin" class="error">You do not have admin rights for this project.</p>

    <div v-else class="admin-tabs">
      <button :class="{ active: act === 'quota' }" @click="act = 'quota'">Usage / Limits</button>
      <button :class="{ active: act === 'global' }" @click="act = 'global'">Global Limits</button>
      <button :class="{ active: act === 'users' }" @click="act = 'users'">Users</button>
    </div>

    <div class="admin-tab">
      <section v-if="act === 'quota'">
        <div class="subhead">Per-user usage &amp; limits (read-only)</div>
        <div v-if="users.length === 0" class="empty">No users found.</div>
        <div v-for="u in users" :key="u.id" class="user-row">
          <div style="flex:1">{{ u.email }}</div>
          <div class="mono">{{ u.is_admin ? 'ADMIN' : 'user' }}</div>
          <div>{{ u.usage_notebook }} / {{ u.quota_notebook || gq.notebook_limit }} notebooks</div>
          <div>{{ u.usage_subject }} / {{ u.quota_subject || gq.subject_max }} subjects</div>
          <div>{{ u.usage_token }} / {{ u.quota_token || gq.monthly_token_limit }} tokens</div>
          <div>{{ u.usage_chat }} chat / tools</div>
        </div>
      </section>

      <section v-if="act === 'global'">
        <div class="subhead">Global defaults (database)</div>
        <div class="grid">
          <div class="f">Notebooks / user <input v-model.number="gq.notebook_limit" /></div>
          <div class="f">Subjects / user <input v-model.number="gq.subject_max" /></div>
          <div class="f">Tokens / month <input v-model.number="gq.monthly_token_limit" /></div>
          <div class="f">Notebook cost <input v-model.number="gq.notebook_cost" /></div>
          <div class="f">Chat/tool cost <input v-model.number="gq.chat_cost" /></div>
        </div>
        <button @click="saveGlobal" :disabled="busy">Save global quota</button>
        <div class="msg" v-if="msg">{{ msg }}</div>
      </section>

      <section v-if="act === 'users'">
        <div class="subhead">Users &amp; account management</div>
        <div v-if="users.length === 0" class="empty">No users found.</div>
        <div v-for="u in users" :key="u.id" class="user-row">
          <div style="flex:2">{{ u.email }}</div>
          <div style="flex:1">
            <label style="font-size:0.8rem;color:#555">admin</label>
            <input type="checkbox" :checked="!!u.is_admin" @change="toggleAdmin(u, $event)" />
          </div>
          <div style="flex:1" class="mono">{{ u.usage_token }} / {{ (u.quota_token||gq.monthly_token_limit) }} tokens</div>
          <div style="flex:1">
            <input v-model.number="u.quota_notebook" class="inp" :disabled="saving" />
            <input v-model.number="u.quota_subject" class="inp" :disabled="saving" />
            <input v-model.number="u.quota_token" class="inp" :disabled="saving" />
          </div>
          <div class="cell">
            <button :disabled="saving" @click="saveUserLimits(u)">Save limits</button>
            <button :disabled="saving" @click="resetUsage(u)">Reset usage</button>
            <button :disabled="saving" @click="toggleAdmin(u, !u.is_admin)">{{ u.is_admin ? 'Remove admin' : 'Make admin' }}</button>
            <button :disabled="saving" class="danger" @click="deleteAccount(u)">Delete</button>
          </div>
        </div>
        <div class="panel">
          <label>Reset user usage (tokens)</label>
          <select v-model="resetTarget">
            <option value="">-- choose user --</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.email }}</option>
          </select>
          <button :disabled="!resetTarget" @click="resetSelected">Reset usage to 0</button>
        </div>
        <div class="panel">
          <label>Reset user token usage (tokens)</label>
          <input v-model.number="resetTokenDelta" type="number" min="0" />
          <button :disabled="!resetTokenDelta" @click="doChangeUsage">Set tokens</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { dbService } from './db'
import { authService } from './auth'
import { supabase } from './supabase'
import { upsertGlobalQuota, setAdmin, resetUsage, changeLimits, deleteAccountUser, changeUsage } from './usage'

const act = ref('quota')
const isAdmin = ref(false)
const users = ref([])
const gq = ref({ notebook_limit: 100, subject_max: 12, monthly_token_limit: 1000, notebook_cost: 3, chat_cost: 1 })
const saving = ref(false)
const msg = ref('')
const resetTarget = ref('')
const resetTokenDelta = ref('')

function load() {
  const uid = authService.getCurrentUser()
  if (!uid) {
    authService.signOut()
    return
  }
  authService.isAdmin(uid).then((ok) => { isAdmin.value = !!ok })
  Promise.all([
    dbService.listAdmins().then((d) => { users.value = d || [] }),
    dbService.getQuotaForThisUser().then((q) => { gq.value = q || {} }).catch(() => {}),
  ])
}

onMounted(load)

async function saveGlobal() {
  const p = {
    notebook_limit: gq.value.notebook_limit ?? 100,
    subject_max: gq.value.subject_max ?? 12,
    monthly_token_limit: gq.value.monthly_token_limit ?? 1000,
    notebook_cost: gq.value.notebook_cost ?? 3,
    chat_cost: gq.value.chat_cost ?? 1,
  }
  try {
    await upsertGlobalQuota(p)
    msg.value = 'Global quota saved.'
  } catch (e) {
    msg.value = 'Failed: ' + e.message
  }
}

async function saveUserLimits(u) {
  const nv = { quota_notebook: u.quota_notebook, quota_subject: u.quota_subject, quota_token: u.quota_token }
  try {
    saving.value = true
    await changeLimits(u.id, nv)
    msg.value = 'Limits updated.'
  } catch (e) {
    msg.value = 'Failed: ' + e.message
  } finally {
    saving.value = false
  }
}

async function resetUsage(u) {
  await dbService.resetUsage(u.id)
  msg.value = 'Usage reset.'
  load()
}

async function toggleAdmin(u, checked) {
  try {
    await setAdmin(u.id, !!checked)
    msg.value = checked ? 'Made admin.' : 'Admin removed.'
    load()
  } catch (e) {
    msg.value = 'Failed: ' + e.message
  }
}

async function deleteAccount(u) {
  if (!confirm(`Delete account ${u.email}? This cannot be undone.`)) return
  try {
    await deleteAccountUser(u.id)
    msg.value = 'Account removed (hard delete requires service_role).'
    load()
  } catch (e) {
    msg.value = 'Failed: ' + e.message
  }
}

async function sendResetPassword(email) {
  try {
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` })
    msg.value = 'Reset link sent.'
  } catch (e) {
    msg.value = 'Failed: ' + e.message
  }
}

async function resetSelected() {
  if (!resetTarget.value) return
  await dbService.resetUsage(resetTarget.value)
  msg.value = 'User usage reset.'
  load()
}

async function doChangeUsage() {
  const amount = Number(resetTokenDelta.value)
  if (!amount || amount < 0) return
  if (!resetTarget.value) return
  await dbService.changeUsage(resetTarget.value, { usage_token: amount })
  msg.value = 'Token usage set.'
  resetTokenDelta.value = ''
}
</script>

<style scoped>
.admin-view { padding: 1rem; }
.admin-tabs { display:flex; gap:0.5rem; margin-bottom:0.75rem; flex-wrap:wrap; }
.admin-tab { padding: 1rem; }
.error { color:#b00020; }
.subhead { font-weight:600; margin-bottom:0.5rem; }
.cell { display:flex; gap:0.4rem; align-items:center; }
.danger { background:#ff6b6b; color:#fff; border:none; padding:0.3rem 0.5rem; }
.empty { color:#888; font-style:italic; }
.msg { color:#1a7f37; font-weight:600; }
.cell { display:flex; gap:0.4rem; align-items:center; }
.cell .inp { width:4rem; }
.panel { margin-top:0.5rem; display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; }
:focus { outline: 2px solid #ffb000; }
</style>
