'use client'

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * 生成會議 PDF
 * @param {Object} meeting - 會議對象
 * @param {string} elementId - HTML 元素 ID (可選，用於渲染特定內容)
 */
export async function exportMeetingToPDF(meeting, elementId = null) {
  try {
    const {
      title,
      meeting_date,
      location,
      key_takeaways,
      notes,
      description,
      attendees,
      created_at,
    } = meeting

    // 建立 PDF （使用 Chinese 字體，但需要在 jsPDF 配置中設定）
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // 使用標準字體，並手動管理字體編碼
    pdf.setFont('helvetica')

    // 標題
    pdf.setFontSize(16)
    pdf.text('Meeting Minutes / 會議紀錄', 105, 20, { align: 'center' })

    let yPos = 35

    // 會議標題
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Topic / 主題:', 20, yPos)
    pdf.setFont('helvetica', 'normal')
    yPos += 7
    const titleText = pdf.splitTextToSize((title || '(N/A)').substring(0, 80), 160)
    pdf.text(titleText, 30, yPos)
    yPos += titleText.length * 5 + 5

    // 會議日期
    pdf.setFont('helvetica', 'bold')
    pdf.text('Date / 日期:', 20, yPos)
    pdf.setFont('helvetica', 'normal')
    yPos += 7
    if (meeting_date) {
      const date = new Date(meeting_date).toLocaleString('zh-TW')
      pdf.text(date, 30, yPos)
    } else {
      pdf.text('(N/A)', 30, yPos)
    }
    yPos += 10

    // 地點
    pdf.setFont('helvetica', 'bold')
    pdf.text('Location / 地點:', 20, yPos)
    pdf.setFont('helvetica', 'normal')
    yPos += 7
    const locationText = pdf.splitTextToSize((location || '(N/A)').substring(0, 80), 160)
    pdf.text(locationText, 30, yPos)
    yPos += locationText.length * 5 + 5

    // 描述
    if (description) {
      pdf.setFont('helvetica', 'bold')
      pdf.text('Description / 描述:', 20, yPos)
      pdf.setFont('helvetica', 'normal')
      yPos += 7
      const descLines = pdf.splitTextToSize(description.substring(0, 200), 160)
      pdf.text(descLines, 30, yPos)
      yPos += descLines.length * 5 + 5
    }

    // 主要要點
    if (key_takeaways && key_takeaways.length > 0) {
      pdf.setFont('helvetica', 'bold')
      pdf.text('Key Takeaways / 主要要點:', 20, yPos)
      pdf.setFont('helvetica', 'normal')
      yPos += 7

      ;(Array.isArray(key_takeaways) ? key_takeaways : []).forEach((takeaway, index) => {
        const takeawayText = pdf.splitTextToSize(`${index + 1}. ${takeaway}`.substring(0, 150), 150)
        pdf.text(takeawayText, 25, yPos)
        yPos += takeawayText.length * 5
      })
      yPos += 5
    }

    // 備註
    if (notes) {
      pdf.setFont('helvetica', 'bold')
      pdf.text('Notes / 備註:', 20, yPos)
      pdf.setFont('helvetica', 'normal')
      yPos += 7
      const noteLines = pdf.splitTextToSize(notes.substring(0, 300), 160)
      pdf.text(noteLines, 30, yPos)
      yPos += noteLines.length * 5 + 5
    }

    // 頁尾
    pdf.setFont('helvetica')
    pdf.setFontSize(9)
    pdf.setTextColor(128, 128, 128)
    const pageCount = pdf.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)
      pdf.text(
        `Page ${i} of ${pageCount} | Generated: ${new Date().toLocaleString('en-US')}`,
        105,
        pdf.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }

    // 下載 PDF
    const sanitizedTitle = title
      ? title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
      : 'meeting'
    const fileName = `meeting_${sanitizedTitle}_${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)

    return {
      success: true,
      fileName,
      message: '✅ PDF exported successfully',
    }
  } catch (error) {
    console.error('PDF generation failed:', error)
    return {
      success: false,
      error: error.message,
      message: '❌ PDF export failed',
    }
  }
}

/**
 * 使用 HTML 元素生成 PDF（更複雜的版本）
 * @param {string} elementId - HTML 元素 ID
 * @param {string} fileName - 下載文件名
 */
export async function exportHTMLToPDF(elementId, fileName = 'document.pdf') {
  try {
    const element = document.getElementById(elementId)
    if (!element) {
      throw new Error(`找不到 ID 為 ${elementId} 的元素`)
    }

    // 轉換 HTML 為 canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    })

    // 建立 PDF
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const imgData = canvas.toDataURL('image/png')
    const imgWidth = canvas.width > canvas.height ? 297 : 210
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    let position = 0

    // 分頁處理
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pdf.internal.pageSize.getHeight()

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pdf.internal.pageSize.getHeight()
    }

    pdf.save(fileName)

    return {
      success: true,
      fileName,
      message: '✅ PDF exported successfully',
    }
  } catch (error) {
    console.error('HTML to PDF conversion failed:', error)
    return {
      success: false,
      error: error.message,
      message: '❌ PDF export failed',
    }
  }
}

/**
 * 透過後端 API 生成 PDF
 * @param {string} meetingId - 會議 ID
 */
export async function exportMeetingPDFViaAPI(meetingId) {
  try {
    const response = await fetch('/api/meeting/export-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ meetingId }),
    })

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`)
    }

    // 建立下載鏈接
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `meeting_${meetingId.substring(0, 8)}.pdf`
    document.body.appendChild(link)
    link.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(link)

    return {
      success: true,
      message: '✅ PDF exported successfully via API',
    }
  } catch (error) {
    console.error('API export failed:', error)
    return {
      success: false,
      error: error.message,
      message: '❌ PDF export failed',
    }
  }
