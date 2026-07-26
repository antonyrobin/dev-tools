import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import html2pdf from 'html2pdf.js';
import { toPng, toJpeg } from 'html-to-image';

// Configure PDF.js worker using local Vite bundled worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Helper to configure Mammoth image embedding
const mammothOptions = {
  convertImage: mammoth.images.imgElement(function(image) {
    return image.read("base64").then(function(imageBuffer) {
      return {
        src: "data:" + image.contentType + ";base64," + imageBuffer
      };
    });
  })
};

/**
 * Direct Word (.docx) to PDF conversion preserving all images, formatting, and layout directly from file.
 */
export async function convertWordToPdfDirect(file, outputFilename = 'converted_document') {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer }, mammothOptions);
  const html = result.value || '<p>(Empty Word Document)</p>';

  const cleanName = outputFilename.replace(/\.[^/.]+$/, '') || 'document';

  const tempContainer = document.createElement('div');
  tempContainer.style.width = '794px';
  tempContainer.style.padding = '40px';
  tempContainer.style.background = '#ffffff';
  tempContainer.style.color = '#111827';
  tempContainer.style.fontFamily = 'Calibri, Arial, sans-serif';
  tempContainer.style.lineHeight = '1.6';
  tempContainer.style.fontSize = '12pt';
  tempContainer.innerHTML = `
    <style>
      h1 { font-size: 24pt; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #111827; }
      h2 { font-size: 18pt; font-weight: bold; margin-top: 16px; margin-bottom: 8px; color: #111827; }
      h3 { font-size: 14pt; font-weight: bold; margin-top: 14px; margin-bottom: 6px; color: #111827; }
      p { margin-bottom: 12px; line-height: 1.6; }
      table { border-collapse: collapse; width: 100%; margin: 16px 0; }
      td, th { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
      th { background-color: #f3f4f6; font-weight: bold; }
      blockquote { border-left: 4px solid #6366f1; padding-left: 16px; margin: 16px 0; color: #4b5563; font-style: italic; }
      img { max-width: 100%; height: auto; display: block; margin: 12px auto; border-radius: 4px; }
    </style>
    ${html}
  `;
  document.body.appendChild(tempContainer);

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `${cleanName}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(opt).from(tempContainer).save();
  } finally {
    document.body.removeChild(tempContainer);
  }
}

/**
 * Direct PDF to Word (.docx/.doc) conversion preserving structure, fonts, headings, and formatting directly from file.
 */
export async function convertPdfToWordDirect(file, outputFilename = 'converted_document') {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  let fullHtml = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    let pageHtml = '';
    let lastY = null;
    let currentLine = '';

    for (const item of textContent.items) {
      const fontSize = Math.abs(item.transform[0] || item.transform[3] || 12);
      const isBold = (item.fontName || '').toLowerCase().includes('bold');

      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        let lineStyled = currentLine.trim();
        if (lineStyled) {
          if (fontSize >= 18) {
            pageHtml += `<h1 style="font-size: 20pt; font-weight: bold; margin-top: 14pt; margin-bottom: 6pt;">${lineStyled}</h1>`;
          } else if (fontSize >= 14) {
            pageHtml += `<h2 style="font-size: 15pt; font-weight: bold; margin-top: 12pt; margin-bottom: 4pt;">${lineStyled}</h2>`;
          } else {
            pageHtml += `<p style="font-size: 11pt; margin-bottom: 8pt; line-height: 1.5;">${lineStyled}</p>`;
          }
        }
        currentLine = '';
      }

      const itemText = isBold ? `<strong>${escapeHtml(item.str)}</strong>` : escapeHtml(item.str);
      if (currentLine && !currentLine.endsWith(' ') && !item.str.startsWith(' ')) {
        currentLine += ' ';
      }
      currentLine += itemText;
      lastY = item.transform[5];
    }

    if (currentLine.trim()) {
      pageHtml += `<p style="font-size: 11pt; margin-bottom: 8pt; line-height: 1.5;">${currentLine.trim()}</p>`;
    }

    fullHtml += `<div style="page-break-after: always; margin-bottom: 24pt;">`;
    if (pdf.numPages > 1) {
      fullHtml += `<p style="font-size: 9pt; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4pt; margin-bottom: 12pt;">--- Page ${pageNum} of ${pdf.numPages} ---</p>`;
    }
    fullHtml += pageHtml;
    fullHtml += `</div>`;
  }

  const cleanName = outputFilename.replace(/\.[^/.]+$/, '') || 'document';

  const mhtml = `MIME-Version: 1.0
Content-Type: multipart/related; boundary="----=_NextPart_WordDocument"

------=_NextPart_WordDocument
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: 8bit

<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${cleanName}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page WordSection1 { size: 8.5in 11.0in; margin: 1.0in 1.0in 1.0in 1.0in; }
    div.WordSection1 { page: WordSection1; }
    body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #111827; }
    p { margin-bottom: 8pt; line-height: 1.5; }
    h1 { font-size: 20pt; font-weight: bold; margin-top: 14pt; margin-bottom: 6pt; }
    h2 { font-size: 15pt; font-weight: bold; margin-top: 12pt; margin-bottom: 4pt; }
  </style>
</head>
<body>
  <div class="WordSection1">
    ${fullHtml}
  </div>
</body>
</html>

------=_NextPart_WordDocument--`;

  const blob = new Blob([mhtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanName}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Parses file object into HTML string suitable for Rich Text Editor.
 * Supported inputs: docx, pdf, xlsx, xls, csv, txt, md, html, json, images
 */
export async function parseFileToHtml(file) {
  if (!file) throw new Error('No file selected');

  const name = file.name || '';
  const ext = name.split('.').pop().toLowerCase();

  // 1. Word Document (.docx, .doc)
  if (ext === 'docx' || ext === 'doc') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer }, mammothOptions);
      let html = result.value || '';
      if (!html.trim()) {
        html = '<p><em>(Empty Word Document)</em></p>';
      }
      return html;
    } catch (err) {
      console.warn('Mammoth docx parse failed, falling back to text:', err);
      const text = await file.text();
      return textToHtmlParagraphs(text);
    }
  }

  // 2. PDF Document (.pdf)
  if (ext === 'pdf') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullHtml = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        let pageText = '';
        let lastY = null;

        for (const item of textContent.items) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
            pageText += '\n';
          } else if (pageText.length > 0 && !pageText.endsWith('\n')) {
            pageText += ' ';
          }
          pageText += item.str;
          lastY = item.transform[5];
        }

        fullHtml += `<div class="pdf-page-block mb-4" data-page="${pageNum}">`;
        fullHtml += `<h4 style="color: var(--primary); font-size: 0.85rem; border-bottom: 1px dashed var(--border-color); padding-bottom: 4px; margin-top: 12px;">--- Page ${pageNum} ---</h4>`;
        fullHtml += textToHtmlParagraphs(pageText);
        fullHtml += `</div>`;
      }

      return fullHtml || '<p><em>(No text extracted from PDF)</em></p>';
    } catch (err) {
      console.error('PDF parsing error:', err);
      throw new Error(`Failed to parse PDF file: ${err.message || 'Corrupted or password-protected PDF'}`);
    }
  }

  // 3. Excel & CSV (.xlsx, .xls, .csv)
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      let combinedHtml = '';

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rawTableHtml = XLSX.utils.sheet_to_html(sheet, { header: '', footer: '' });

        // Clean up sheet HTML table
        const cleanTable = rawTableHtml
          .replace(/<table/g, '<table class="editor-table" style="width:100%; border-collapse:collapse; margin:16px 0; font-size:14px; border:1px solid #374151;"')
          .replace(/<td/g, '<td style="border:1px solid #4b5563; padding:8px 12px;"')
          .replace(/<th/g, '<th style="border:1px solid #4b5563; padding:8px 12px; background-color:rgba(99,102,241,0.15); font-weight:600;"');

        combinedHtml += `<div class="excel-sheet-block mb-6">`;
        if (workbook.SheetNames.length > 1) {
          combinedHtml += `<h3 style="color:var(--text-primary); margin-bottom:8px;">Sheet: ${sheetName}</h3>`;
        }
        combinedHtml += cleanTable;
        combinedHtml += `</div>`;
      });

      return combinedHtml || '<p><em>(Empty Spreadsheet)</em></p>';
    } catch (err) {
      console.error('Spreadsheet parse error:', err);
      throw new Error(`Failed to parse spreadsheet file: ${err.message}`);
    }
  }

  // 4. Image files (.png, .jpg, .jpeg, .webp, .svg, .gif, .bmp)
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp'].includes(ext)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const imgHtml = `
          <div style="text-align: center; margin: 20px 0;">
            <img src="${dataUrl}" alt="${file.name}" style="max-width: 100%; max-height: 500px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);" />
            <p style="font-size: 0.85rem; color: #9ca3af; margin-top: 8px;">Image: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)</p>
          </div>
        `;
        resolve(imgHtml);
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  // 5. Text / Markdown / HTML / JSON / Code files
  const rawText = await file.text();

  if (ext === 'html' || ext === 'htm') {
    const match = rawText.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return match ? match[1] : rawText;
  }

  if (ext === 'json') {
    try {
      const parsed = JSON.parse(rawText);
      const prettyJson = JSON.stringify(parsed, null, 2);
      return `<pre style="background:#1e1e2e; color:#a6adc8; padding:16px; border-radius:8px; overflow-x:auto; font-family:monospace;"><code>${escapeHtml(prettyJson)}</code></pre>`;
    } catch (e) {
      return `<pre style="background:#1e1e2e; color:#f38ba8; padding:16px; border-radius:8px;"><code>${escapeHtml(rawText)}</code></pre>`;
    }
  }

  if (ext === 'md' || ext === 'markdown') {
    return markdownToHtml(rawText);
  }

  // Generic Plain Text
  return textToHtmlParagraphs(rawText);
}

/**
 * Converts plain text string to HTML paragraphs.
 */
function textToHtmlParagraphs(text) {
  if (!text) return '<p></p>';
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs
    .map(p => {
      const clean = escapeHtml(p.trim()).replace(/\n/g, '<br/>');
      return clean ? `<p style="margin-bottom:1em; line-height:1.6;">${clean}</p>` : '';
    })
    .filter(Boolean)
    .join('');
}

/**
 * Simple client-side Markdown to HTML converter.
 */
function markdownToHtml(md) {
  if (!md) return '<p></p>';
  let html = md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/!\[(.*?)\]\((.*?)\)/gim, "<img alt='$1' src='$2' style='max-width:100%; border-radius:6px;' />")
    .replace(/\[(.*?)\]\((.*?)\)/gim, "<a href='$2' target='_blank' rel='noreferrer'>$1</a>")
    .replace(/\n\s*\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  return `<p>${html}</p>`;
}

/**
 * Helper to escape HTML characters.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Converts HTML content from editor into desired output format and downloads the result.
 */
export async function convertAndDownload(htmlContent, targetFormat, filename = 'converted_document', editorContainerEl = null) {
  const cleanFilename = filename.replace(/\.[^/.]+$/, '') || 'document';
  const format = targetFormat.toLowerCase();

  // Helper to trigger file download
  const triggerDownload = (blob, extension, mimeType) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanFilename}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // 1. DOCX / DOC (Word Document)
  if (format === 'docx' || format === 'doc') {
    const mhtml = `MIME-Version: 1.0
Content-Type: multipart/related; boundary="----=_NextPart_WordDocument"

------=_NextPart_WordDocument
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: 8bit

<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${cleanFilename}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page WordSection1 { size: 8.5in 11.0in; margin: 1.0in 1.0in 1.0in 1.0in; }
    div.WordSection1 { page: WordSection1; }
    body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #111827; }
    h1 { font-size: 24pt; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; color: #1f2937; }
    h2 { font-size: 18pt; font-weight: bold; margin-top: 14pt; margin-bottom: 4pt; color: #1f2937; }
    h3 { font-size: 14pt; font-weight: bold; margin-top: 12pt; margin-bottom: 4pt; color: #1f2937; }
    p { margin-bottom: 10pt; line-height: 1.5; }
    table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
    td, th { border: 1px solid #d1d5db; padding: 6pt 8pt; text-align: left; }
    th { background-color: #f3f4f6; font-weight: bold; }
    blockquote { border-left: 3pt solid #6366f1; padding-left: 10pt; margin: 10pt 0; color: #4b5563; font-style: italic; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <div class="WordSection1">
    ${htmlContent}
  </div>
</body>
</html>

------=_NextPart_WordDocument--`;
    const blob = new Blob([mhtml], { type: 'application/msword;charset=utf-8' });
    return triggerDownload(blob, 'doc', 'application/msword');
  }

  // 2. PDF
  if (format === 'pdf') {
    const tempContainer = document.createElement('div');
    tempContainer.style.padding = '30px';
    tempContainer.style.background = '#ffffff';
    tempContainer.style.color = '#000000';
    tempContainer.style.fontFamily = 'Arial, sans-serif';
    tempContainer.style.lineHeight = '1.6';
    tempContainer.innerHTML = htmlContent;
    document.body.appendChild(tempContainer);

    const opt = {
      margin: 10,
      filename: `${cleanFilename}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(tempContainer).save();
    } finally {
      document.body.removeChild(tempContainer);
    }
    return;
  }

  // 3. Excel (.xlsx) or CSV (.csv)
  if (format === 'xlsx' || format === 'csv') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    const tables = tempDiv.querySelectorAll('table');
    const wb = XLSX.utils.book_new();

    if (tables.length > 0) {
      tables.forEach((tbl, idx) => {
        const ws = XLSX.utils.table_to_sheet(tbl);
        XLSX.utils.book_append_sheet(wb, ws, `Sheet ${idx + 1}`);
      });
    } else {
      const text = tempDiv.innerText || tempDiv.textContent || '';
      const rows = text.split('\n').map(line => [line]);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet 1');
    }

    if (format === 'csv') {
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const csvStr = XLSX.utils.sheet_to_csv(firstSheet);
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      return triggerDownload(blob, 'csv', 'text/csv');
    } else {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      return triggerDownload(blob, 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
  }

  // 4. Image (.png or .jpeg)
  if (format === 'png' || format === 'jpg' || format === 'jpeg') {
    const targetEl = editorContainerEl || document.querySelector('.rich-editor-canvas');
    if (!targetEl) throw new Error('Editor element unavailable for image conversion.');

    const isJpeg = format === 'jpg' || format === 'jpeg';
    const dataUrl = isJpeg 
      ? await toJpeg(targetEl, { quality: 0.95, backgroundColor: '#13141c' })
      : await toPng(targetEl, { backgroundColor: '#13141c' });

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${cleanFilename}.${isJpeg ? 'jpg' : 'png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // 5. HTML (.html)
  if (format === 'html') {
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanFilename}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background-color: #f5f5f5; }
    img { max-width: 100%; height: auto; }
    blockquote { border-left: 4px solid #4f46e5; margin: 0; padding-left: 16px; color: #666; }
    pre { background: #f4f4f5; padding: 12px; border-radius: 6px; overflow-x: auto; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
    return triggerDownload(blob, 'html', 'text/html');
  }

  // 6. Markdown (.md)
  if (format === 'md') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    let mdText = htmlToMarkdown(tempDiv);
    const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8;' });
    return triggerDownload(blob, 'md', 'text/markdown');
  }

  // 7. JSON (.json)
  if (format === 'json') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const jsonStructure = {
      title: cleanFilename,
      exportedAt: new Date().toISOString(),
      rawHtml: htmlContent,
      plainText: tempDiv.innerText || tempDiv.textContent || '',
      paragraphs: Array.from(tempDiv.querySelectorAll('p, h1, h2, h3, h4, li')).map(el => el.innerText.trim()).filter(Boolean)
    };
    const blob = new Blob([JSON.stringify(jsonStructure, null, 2)], { type: 'application/json;charset=utf-8;' });
    return triggerDownload(blob, 'json', 'application/json');
  }

  // 8. Plain Text (.txt)
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const plainText = tempDiv.innerText || tempDiv.textContent || '';
  const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8;' });
  return triggerDownload(blob, 'txt', 'text/plain');
}

/**
 * Helper to turn DOM element into Markdown string.
 */
function htmlToMarkdown(element) {
  let text = '';
  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      const content = htmlToMarkdown(node);

      switch (tag) {
        case 'h1': text += `\n# ${content}\n\n`; break;
        case 'h2': text += `\n## ${content}\n\n`; break;
        case 'h3': text += `\n### ${content}\n\n`; break;
        case 'p': text += `${content}\n\n`; break;
        case 'strong': case 'b': text += `**${content}**`; break;
        case 'em': case 'i': text += `*${content}*`; break;
        case 'u': text += `<u>${content}</u>`; break;
        case 'code': text += `\`${content}\``; break;
        case 'pre': text += `\n\`\`\`\n${content}\n\`\`\`\n\n`; break;
        case 'blockquote': text += `\n> ${content}\n\n`; break;
        case 'li': text += `- ${content}\n`; break;
        case 'ul': case 'ol': text += `\n${content}\n`; break;
        case 'br': text += `\n`; break;
        case 'a': text += `[${content}](${node.getAttribute('href') || '#'})`; break;
        case 'img': text += `![${node.getAttribute('alt') || 'image'}](${node.getAttribute('src') || ''})`; break;
        default: text += content; break;
      }
    }
  });
  return text;
}
