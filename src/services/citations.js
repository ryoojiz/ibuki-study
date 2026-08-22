/**
 * Citations service
 * -----------------
 * Handles everything related to inline source citations:
 *
 *  1. buildSourceRegistry()  - flattens notebook sources into a numbered
 *     registry ([1], [2], [3] ...) shared by the LLM prompt and the renderer.
 *  2. renderMarkdownWithCitations() - converts markdown-ish LLM output into
 *     HTML, turning citation markers into clickable pills:
 *        [[3|verbatim quote]]            -> clickable [3], quote captured
 *        [[3|verbatim quote|Page 4]]     -> clickable [3] with page ref
 *        [Source 3] / [Source 3, Page 4] -> legacy format, still supported
 *  3. findQuoteRange() - fuzzy-matches an LLM quote inside the raw source
 *     text so the viewer can highlight + scroll to the exact passage.
 */

// Newline / entity constants built from char codes so they are safe to
// serialize through any channel (no bare escape sequences or entities here).
const NL = String.fromCharCode(10)
const AMP = String.fromCharCode(38)
const ENT_AMP = AMP + 'amp;'
const ENT_LT = AMP + 'lt;'
const ENT_GT = AMP + 'gt;'
const ENT_QUOT = AMP + 'quot;'

export const citationsService = {
  /**
   * Build a flat, sequentially numbered registry from a list of notebooks.
   * Each entry: { num, notebookId, notebookTitle, sourceIndex, name, type, url, content }
   */
  buildSourceRegistry(notebooks) {
    const registry = []
    let num = 1
    for (const nb of notebooks || []) {
      const sources = nb?.sources || []
      sources.forEach((src, i) => {
        registry.push({
          num: num++,
          notebookId: nb.id ?? null,
          notebookTitle: nb.title || 'Untitled notebook',
          sourceIndex: i,
          name: src.name || ('Source ' + (i + 1)),
          type: src.type || 'text',
          url: src.url || null,
          content: src.content || null
        })
      })
    }
    return registry
  },

  /**
   * Human-readable SOURCE REGISTRY block injected into the LLM system prompt.
   */
  buildRegistryPrompt(registry) {
    if (!registry || registry.length === 0) return '(no numbered sources available)'
    return registry
      .map(r => {
        const pdfNote = r.type === 'pdf' ? ' (PDF - include the page when possible)' : ''
        return '[' + r.num + '] "' + r.name + '" - from notebook "' + r.notebookTitle + '"' + pdfNote
      })
      .join(NL)
  },

  escapeHtml(s) {
    return (s || '')
      .replace(/&/g, ENT_AMP)
      .replace(/</g, ENT_LT)
      .replace(/>/g, ENT_GT)
  },

  escapeAttr(s) {
    return this.escapeHtml(s).replace(/"/g, ENT_QUOT).replace(/'/g, '&#39;')
  },

  /**
   * Render markdown-ish text to HTML with clickable citation pills.
   *
   * Returns { html, refs } where refs is the ordered list of unique cited
   * numbers: [{ num, quote, page, source }] (source = registry entry or null).
   */
  renderMarkdownWithCitations(text, registry) {
    if (!text) return { html: '', refs: [] }
    const reg = registry || []

    // 1. Escape HTML first (safe v-html output)
    let html = this.escapeHtml(text)

    // Hide a trailing, still-streaming incomplete marker e.g. "[[2|quo"
    html = html.replace(/\[\[\d+(?:\|[^\]]*)?$/, '')

    // 2. Swap citation markers for placeholders BEFORE markdown transforms
    //    so quotes containing markdown characters are not mangled.
    const cites = []
    html = html.replace(/\[\[(\d+)\|([\s\S]*?)\]\]/g, (_m, num, rest) => {
      const barIdx = rest.indexOf('|')
      let quote = rest
      let page = null
      if (barIdx !== -1) {
        quote = rest.slice(0, barIdx)
        const pm = rest.slice(barIdx + 1).match(/\d+/)
        page = pm ? parseInt(pm[0], 10) : null
      }
      cites.push({ num: parseInt(num, 10), quote: quote.trim(), page })
      return '@@CITE' + (cites.length - 1) + '@@'
    })

    html = html.replace(/\[Source (\d+)(?:,?\s*Page (\d+))?\]/g, (_m, num, page) => {
      cites.push({ num: parseInt(num, 10), quote: '', page: page ? parseInt(page, 10) : null })
      return '@@CITE' + (cites.length - 1) + '@@'
    })

    // 3. Markdown transforms - applied per line, then reassembled with
    //    paragraph (<p>) and line-break (<br>) structure.
    const rawLines = html.split(NL)
    const transformed = rawLines.map(line => {
      let l = line
      l = l.replace(/^### (.*)$/i, '<h3>$1</h3>')
      l = l.replace(/^## (.*)$/i, '<h2>$1</h2>')
      l = l.replace(/^# (.*)$/i, '<h1>$1</h1>')
      l = l.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      l = l.replace(/\*(.*?)\*/g, '<em>$1</em>')
      l = l.replace(/^\s*[-*] (.*)$/i, '<li>$1</li>')
      l = l.replace(/^\s*\d+\. (.*)$/i, '<li>$1</li>')
      return l
    })

    const paragraphs = []
    let buf = []
    for (const line of transformed) {
      if (line.trim() === '' && !line.includes('<h')) {
        if (buf.length) {
          paragraphs.push(buf.join('<br>'))
          buf = []
        }
      } else {
        buf.push(line)
      }
    }
    if (buf.length) paragraphs.push(buf.join('<br>'))

    html = '<p>' + paragraphs.join('</p><p>') + '</p>'

    // Wrap consecutive <li> runs in a single <ul>
    html = html.replace(/<\/li>\s*(<br>\s*)+<li>/g, '</li><li>')
    html = html.replace(/(?:<li>[\s\S]*?<\/li>)+/g, m => '<ul>' + m + '</ul>')
    html = html.replace(/<\/ul>\s*<ul>/g, '')

    // 4. Substitute placeholders with clickable citation pills
    html = html.replace(/@@CITE(\d+)@@/g, (_m, idx) => {
      const c = cites[parseInt(idx, 10)]
      if (!c) return ''
      const entry = reg.find(r => r.num === c.num)
      if (!entry) return '<span class="cite-ref cite-ref-missing">[' + c.num + ']</span>'
      return (
        '<sup class="cite-ref" data-cite-num="' + c.num + '" title="' +
        this.escapeAttr(entry.name) + ' - ' + this.escapeAttr(entry.notebookTitle) +
        '">[' + c.num + ']</sup>'
      )
    })

    // 5. Ordered unique ref list for the footer
    const refs = []
    const seen = new Set()
    for (const c of cites) {
      const existing = seen.has(c.num) ? refs.find(r => r.num === c.num) : null
      if (existing) {
        if (!existing.quote && c.quote) existing.quote = c.quote
        if (!existing.page && c.page) existing.page = c.page
        continue
      }
      seen.add(c.num)
      refs.push({ ...c, source: reg.find(r => r.num === c.num) || null })
    }

    return { html, refs }
  },

  /**
   * Normalize text for matching: lowercase + collapse whitespace.
   * Returns { norm, map } where map[i] = original index of norm[i].
   */
  _normalizeWithMap(text) {
    let norm = ''
    const map = []
    let lastWasSpace = true
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (/\s/.test(ch)) {
        if (!lastWasSpace) {
          norm += ' '
          map.push(i)
          lastWasSpace = true
        }
      } else {
        norm += ch.toLowerCase()
        map.push(i)
        lastWasSpace = false
      }
    }
    while (norm.endsWith(' ')) {
      norm = norm.slice(0, -1)
      map.pop()
    }
    return { norm, map }
  },

  /**
   * Fuzzy-find `quote` inside `text`.
   * Strategy: exact normalized substring -> longest word-sequence prefix
   * match (greedily extended) -> shorter probes. Returns { start, end }
   * (original-text indices, end exclusive) or null.
   */
  findQuoteRange(text, quote) {
    if (!text || !quote) return null
    const { norm, map } = this._normalizeWithMap(text)
    const nQuote = this._normalizeWithMap(quote).norm
    if (!nQuote.trim()) return null

    // 1) Direct normalized substring
    const idx = norm.indexOf(nQuote)
    if (idx !== -1) {
      return { start: map[idx], end: map[idx + nQuote.length - 1] + 1 }
    }

    // 2) Word-sequence matching (punctuation-stripped tokens)
    const clean = (w) => w.replace(/^[^\w]+|[^\w]+$/g, '')
    const qWords = nQuote.split(' ').map(clean).filter(w => w.length > 2)
    if (qWords.length === 0) return null

    const tWords = []
    const wordRe = /[^\s]+/g
    let wm
    while ((wm = wordRe.exec(norm)) !== null) {
      const cw = clean(wm[0])
      if (cw) tWords.push({ word: cw, start: wm.index, end: wm.index + wm[0].length })
    }

    const probeLens = [Math.min(qWords.length, 12), 8, 5, 3].filter(l => l <= qWords.length && l >= 1)
    for (const len of probeLens) {
      const probe = qWords.slice(0, len).join(' ')
      for (let i = 0; i + len <= tWords.length; i++) {
        let ok = true
        for (let k = 0; k < len; k++) {
          if (tWords[i + k].word !== qWords[k]) { ok = false; break }
        }
        if (!ok) continue
        // Greedily extend forward over remaining quote words
        let endTi = i + len - 1
        let qi = len
        while (qi < qWords.length && endTi + 1 < tWords.length && tWords[endTi + 1].word === qWords[qi]) {
          endTi++
          qi++
        }
        return { start: map[tWords[i].start], end: map[tWords[endTi].end - 1] + 1 }
      }
    }

    // 3) Fallback: longest consecutive word-run shared by quote and text
    //    (robust when the LLM paraphrases part of the way through a quote)
    let bestStart = -1
    let bestEnd = -1
    let bestLen = 0
    for (let si = 0; si < qWords.length; si++) {
      for (let ti = 0; ti < tWords.length; ti++) {
        let k = 0
        while (si + k < qWords.length && ti + k < tWords.length && tWords[ti + k].word === qWords[si + k]) k++
        if (k > bestLen) {
          bestLen = k
          bestStart = map[tWords[ti].start]
          bestEnd = map[tWords[ti + k - 1].end - 1] + 1
        }
      }
    }
    if (bestLen >= 2) return { start: bestStart, end: bestEnd }

    return null
  }
}
