import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { citationsService } from './citations'

const A4_CONTENT_WIDTH_PX = 718

const safeFilename = value => String(value || 'study-guide')
  .normalize('NFKD')
  .replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'study-guide'

const titleFromMarkdown = (markdown, fallback) => {
  const heading = String(markdown || '').match(/^#\s+(.+)$/m)?.[1]
  return (heading || fallback || 'Study Guide').replace(/[*_`]/g, '').trim()
}

const blobToBase64 = blob => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(reader.error || new Error('Could not read the generated PDF.'))
  reader.onload = () => resolve(String(reader.result).split(',')[1])
  reader.readAsDataURL(blob)
})

const waitForImages = element => Promise.all(
  [...element.querySelectorAll('img')].map(image => {
    if (image.complete) return Promise.resolve()
    return new Promise(resolve => {
      image.onload = resolve
      image.onerror = resolve
    })
  })
)

const buildPrintableElement = ({ markdown, title, sourceRegistry }) => {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    box-sizing: border-box;
    overflow: auto;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 24px;
    background: #f3f1f5;
  `

  const page = document.createElement('article')
  page.style.cssText = `
    position: relative;
    flex: 0 0 auto;
    width: ${A4_CONTENT_WIDTH_PX}px;
    min-height: 1016px;
    box-sizing: border-box;
    background: #ffffff;
    color: #17151c;
    font-family: Inter, Arial, "Noto Sans", sans-serif;
    font-size: 14px;
    line-height: 1.62;
    padding: 24px 28px 36px;
  `

  const header = document.createElement('header')
  header.style.cssText = 'border-bottom: 3px solid #8d1ee3; margin-bottom: 24px; padding-bottom: 14px;'

  const brand = document.createElement('div')
  brand.textContent = 'IBUKI STUDY'
  brand.style.cssText = 'color: #8d1ee3; font-size: 11px; font-weight: 800; letter-spacing: 0.16em; margin-bottom: 7px;'

  const heading = document.createElement('h1')
  heading.textContent = title
  heading.style.cssText = 'color: #17151c; font-size: 28px; line-height: 1.2; margin: 0;'

  const date = document.createElement('p')
  date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date())
  date.style.cssText = 'color: #6d6875; font-size: 11px; margin: 8px 0 0;'

  const content = document.createElement('section')
  content.className = 'ibuki-pdf-content'
  content.innerHTML = citationsService.renderMarkdownWithCitations(markdown, sourceRegistry || []).html

  const printStyles = document.createElement('style')
  printStyles.textContent = `
    .ibuki-pdf-content h1 { display: none; }
    .ibuki-pdf-content h2 { color: #42106a; font-size: 20px; line-height: 1.3; margin: 24px 0 9px; border-bottom: 1px solid #ddd6e6; padding-bottom: 5px; break-after: avoid; }
    .ibuki-pdf-content h3 { color: #25152f; font-size: 16px; margin: 18px 0 7px; break-after: avoid; }
    .ibuki-pdf-content p { margin: 0 0 10px; orphans: 3; widows: 3; }
    .ibuki-pdf-content ul, .ibuki-pdf-content ol { margin: 8px 0 14px; padding-left: 24px; }
    .ibuki-pdf-content li { margin-bottom: 5px; }
    .ibuki-pdf-content blockquote { border-left: 4px solid #8d1ee3; background: #f7f1fc; margin: 14px 0; padding: 9px 14px; break-inside: avoid; }
    .ibuki-pdf-content pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f3f1f5; border-radius: 7px; padding: 11px; break-inside: avoid; }
    .ibuki-pdf-content code { font-family: Consolas, monospace; background: #f3f1f5; border-radius: 3px; padding: 1px 3px; }
    .ibuki-pdf-content table { width: 100%; border-collapse: collapse; margin: 14px 0; break-inside: avoid; }
    .ibuki-pdf-content th, .ibuki-pdf-content td { border: 1px solid #d9d4df; padding: 7px; text-align: left; }
    .ibuki-pdf-content th { background: #f3eafa; color: #42106a; }
    .ibuki-pdf-content .math-block { overflow: hidden; text-align: center; margin: 14px 0; break-inside: avoid; }
    .ibuki-pdf-content .cite-ref { color: #6617a5; font-weight: 700; }
    .ibuki-pdf-content img, .ibuki-pdf-content svg { max-width: 100%; height: auto; }
    .ibuki-pdf-content h2, .ibuki-pdf-content h3, .ibuki-pdf-content blockquote, .ibuki-pdf-content pre, .ibuki-pdf-content table { page-break-inside: avoid; }
  `

  header.append(brand, heading, date)
  page.append(printStyles, header, content)
  host.appendChild(page)
  document.body.appendChild(host)
  return { host, page }
}

export const createStudyGuidePdfBlob = async ({ markdown, title, sourceRegistry = [] }) => {
  const { host, page } = buildPrintableElement({ markdown, title, sourceRegistry })

  try {
    if (document.fonts?.ready) await document.fonts.ready
    await waitForImages(page)
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    const html2pdfModule = await import('html2pdf.js')
    const html2pdf = html2pdfModule.default || html2pdfModule
    const worker = html2pdf().set({
      margin: [12, 12, 16, 12],
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['h2', 'h3', 'blockquote', 'pre', 'table'] }
    }).from(page).toPdf()

    const pdf = await worker.get('pdf')
    const pageCount = pdf.internal.getNumberOfPages()
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      pdf.setPage(pageNumber)
      pdf.setFontSize(8)
      pdf.setTextColor(115, 108, 123)
      pdf.text(`Ibuki Study  |  ${pageNumber} / ${pageCount}`, 105, 291, { align: 'center' })
    }
    return pdf.output('blob')
  } finally {
    host.remove()
  }
}

const downloadOnWeb = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const shareOnNative = async (blob, filename, title) => {
  const data = await blobToBase64(blob)
  const result = await Filesystem.writeFile({
    path: `pdf/${filename}`,
    data,
    directory: Directory.Cache,
    recursive: true
  })
  await Share.share({
    title,
    text: 'Printable study guide from Ibuki Study',
    files: [result.uri],
    dialogTitle: 'Print or share study guide'
  })
}

export const pdfService = {
  async exportStudyGuide({ markdown, title: suggestedTitle, sourceRegistry = [] }) {
    const title = titleFromMarkdown(markdown, suggestedTitle)
    const filename = `${safeFilename(title)}.pdf`
    const blob = await createStudyGuidePdfBlob({ markdown, title, sourceRegistry })

    if (Capacitor.isNativePlatform()) {
      await shareOnNative(blob, filename, title)
    } else {
      downloadOnWeb(blob, filename)
    }

    return { filename, title }
  }
}
