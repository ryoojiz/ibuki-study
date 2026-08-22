<template>
  <div class="creator-container">
    <!-- Left Panel: Source Upload -->
    <div class="creator-panel">
      <h2>1. Upload Sources</h2>
      
      <div 
        class="drag-zone" 
        :class="{ 'drag-over': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        @click="$refs.fileInput.click()"
      >
        <div class="drag-icon">📁</div>
        <div class="drag-text">
          Drag & drop files here or <span>browse</span>
        </div>
        <input 
          ref="fileInput" 
          type="file" 
          multiple 
          class="hidden" 
          @change="handleFileSelect"
          accept="image/*,.txt,.pdf"
        >
      </div>

      <div class="sources-preview-list">
        <div v-for="(src, index) in sources" :key="index" class="source-item">
          <img v-if="src.type === 'image'" :src="src.content" class="source-thumb">
          <div v-else class="source-thumb" style="display:flex; align-items:center; justify-content:center; font-size:12px">{{ src.type === 'pdf' ? 'PDF' : 'TXT' }}</div>
          
          <div class="source-details">
            <div class="source-name">{{ src.name }}</div>
            <div class="source-meta-tag">{{ src.type === 'image' ? 'Image' : (src.type === 'pdf' ? 'PDF File' : 'Text File') }}</div>
          </div>
          
          <button @click="removeSource(index)" class="btn-remove-source">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <button 
        @click="analyzeSources" 
        class="btn-analyze" 
        :disabled="sources.length === 0 || isAnalyzing"
      >
        <svg v-if="!isAnalyzing" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12L20 12"></path><path d="M12 12L12 20"></path></svg>
        {{ isAnalyzing ? 'Processing...' : 'Process Sources' }}
      </button>
    </div>

    <!-- Right Panel: Notebook Details -->
    <div class="creator-panel">
      <h2>2. Review & Edit</h2>
      
      <div v-if="isAnalyzing" class="skeleton-loader">
        <div class="skeleton-text header"></div>
        <div class="skeleton-text paragraph"></div>
        <div class="skeleton-text paragraph half"></div>
        <div class="skeleton-text paragraph"></div>
        <div class="skeleton-text paragraph"></div>
      </div>

      <div v-else-if="notebook" class="notebook-form">
        <div class="input-group">
          <label>Title</label>
          <input v-model="notebook.title" type="text">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem">
          <div class="input-group">
            <label>Subject</label>
            <input v-model="notebook.subject" type="text">
          </div>
          <div class="input-group">
            <label>Material</label>
            <input v-model="notebook.material" type="text">
          </div>
        </div>

        <div class="input-group">
          <label>Summary (Markdown)</label>
          <textarea v-model="notebook.summary" rows="8"></textarea>
        </div>

        <div class="input-group">
          <label>Transcription</label>
          <textarea v-model="notebook.transcription" rows="5"></textarea>
        </div>

        <button @click="saveNotebook" class="btn-save-notebook">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 11 13 11 21"></polyline><polyline points="17 21 13 21"></polyline></svg>
          Save Notebook
        </button>
      </div>

      <div v-else class="empty-state" style="padding: 2rem; text-align: center">
        <div class="empty-icon">✨</div>
        <p>Upload sources and click "Analyze" to generate your notebook.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { aiService } from '../services/ai'
import { dbService } from '../services/db'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

const emit = defineEmits(['notebookCreated'])

const isDragging = ref(false)
const isAnalyzing = ref(false)
const sources = ref([])
const originalFiles = ref([])
const notebook = ref(null)

const handleFileSelect = async (event) => {
  const files = Array.from(event.target.files)
  await processFiles(files)
}

const handleDrop = async (event) => {
  isDragging.value = false
  const files = Array.from(event.dataTransfer.files)
  await processFiles(files)
}

const processFiles = async (files) => {
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      try {
        const compressedBase64 = await compressImage(file)
        sources.value.push({
          name: file.name,
          type: 'image',
          content: compressedBase64
        })
        originalFiles.value.push(file)
      } catch (e) {
        console.error(`Failed to compress image ${file.name}:`, e)
        alert(`Failed to process image ${file.name}. It might be too large or corrupted.`)
      }
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text()
        sources.value.push({
          name: file.name,
          type: 'text',
          content: text
        })
        originalFiles.value.push(file)
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        const text = await extractTextFromPDF(file)
        sources.value.push({
          name: file.name,
          type: 'pdf',
          content: text
        })
        originalFiles.value.push(file)
      } catch (e) {
        console.error(`Failed to process PDF ${file.name}:`, e)
        alert(`Failed to process PDF ${file.name}.`)
      }
    }
  }
}

const extractTextFromPDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map(item => item.str).join(' ')
    fullText += `[Page ${i}] ${pageText}\n\n`
  }
  
  return fullText
}

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        // Set max dimensions to avoid huge base64 strings
        const MAX_WIDTH = 1600
        const MAX_HEIGHT = 1600
        let width = img.width
        let height = img.height

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        // Compress as JPEG with 0.7 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        resolve(dataUrl)
      }
      img.onerror = (e) => reject(new Error('Failed to load image for compression'))
    }
    reader.onerror = (e) => reject(new Error('FileReader error'))
  })
}

const removeSource = (index) => {
  sources.value.splice(index, 1)
  originalFiles.value.splice(index, 1)
}

const analyzeSources = async () => {
  isAnalyzing.value = true
  notebook.value = null
  
  try {
    const result = await aiService.analyzeSources(sources.value)
    notebook.value = {
      ...result,
      // Persist extracted text for text/PDF sources so citations can be
      // highlighted later. Image base64 is intentionally not persisted
      // (the storage URL is used instead).
      sources: sources.value.map(s => (
        s.type === 'image'
          ? { name: s.name, type: s.type }
          : { name: s.name, type: s.type, content: s.content }
      ))
    }
   } catch (e) {
     let errorMessage = 'AI Analysis failed: ' + e.message;
     // Customize error messages for specific cases
     if (e.message.includes('timed out') || e.message.includes('524') || e.message.includes('520')) {
       errorMessage = 'The AI analysis took too long to complete. This usually happens with large or complex sources. Please try again with fewer or smaller files.';
     } else if (e.message.includes('API Request failed')) {
       errorMessage = 'The AI service is currently unavailable. Please try again later or check your internet connection.';
     }
     alert(errorMessage);
   } finally {
    isAnalyzing.value = false
  }
}

const saveNotebook = async () => {
  try {
    await dbService.saveNotebook(notebook.value, originalFiles.value)
    emit('notebookCreated')
  } catch (e) {
    alert('Failed to save notebook: ' + e.message)
  }
}
</script>