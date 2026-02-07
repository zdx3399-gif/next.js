import { PDFDocument, PDFPage, rgb } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { meetingId } = await request.json()

    if (!meetingId) {
      return Response.json({ error: '缺少 meetingId' }, { status: 400 })
    }

    // 獲取會議資料
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single()

    if (meetingError || !meeting) {
      return Response.json({ error: '無法找到會議' }, { status: 404 })
    }

    // 建立 PDF
    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([612, 792]) // Letter size
    const { width, height } = page.getSize()

    const fontSize = 12
    const margin = 50
    let yPosition = height - margin

    // 標題
    page.drawText('Meeting Minutes / 會議紀錄', {
      x: margin,
      y: yPosition,
      size: 18,
      color: rgb(0, 0, 0),
      maxWidth: width - 2 * margin,
    })
    yPosition -= 30

    // 會議標題
    page.drawText('Topic / 主題:', {
      x: margin,
      y: yPosition,
      size: fontSize,
      color: rgb(0.2, 0.2, 0.2),
    })
    yPosition -= 5
    page.drawText(meeting.title || '(N/A)', {
      x: margin + 20,
      y: yPosition,
      size: fontSize - 1,
      color: rgb(0, 0, 0),
      maxWidth: width - 2 * margin - 20,
    })
    yPosition -= 20

    // 日期
    page.drawText('Date / 日期:', {
      x: margin,
      y: yPosition,
      size: fontSize,
      color: rgb(0.2, 0.2, 0.2),
    })
    yPosition -= 5
    const dateStr = meeting.meeting_date
      ? new Date(meeting.meeting_date).toLocaleString('en-US')
      : '(N/A)'
    page.drawText(dateStr, {
      x: margin + 20,
      y: yPosition,
      size: fontSize - 1,
      color: rgb(0, 0, 0),
    })
    yPosition -= 20

    // 地點
    page.drawText('Location / 地點:', {
      x: margin,
      y: yPosition,
      size: fontSize,
      color: rgb(0.2, 0.2, 0.2),
    })
    yPosition -= 5
    page.drawText(meeting.location || '(N/A)', {
      x: margin + 20,
      y: yPosition,
      size: fontSize - 1,
      color: rgb(0, 0, 0),
      maxWidth: width - 2 * margin - 20,
    })
    yPosition -= 20

    // 描述
    if (meeting.description) {
      page.drawText('Description / 描述:', {
        x: margin,
        y: yPosition,
        size: fontSize,
        color: rgb(0.2, 0.2, 0.2),
      })
      yPosition -= 5
      const descText = meeting.description.substring(0, 200)
      page.drawText(descText, {
        x: margin + 20,
        y: yPosition,
        size: fontSize - 1,
        color: rgb(0, 0, 0),
        maxWidth: width - 2 * margin - 20,
      })
      yPosition -= 20
    }

    // 主要要點
    if (meeting.key_takeaways && Array.isArray(meeting.key_takeaways) && meeting.key_takeaways.length > 0) {
      page.drawText('Key Takeaways / 主要要點:', {
        x: margin,
        y: yPosition,
        size: fontSize,
        color: rgb(0.2, 0.2, 0.2),
      })
      yPosition -= 15

      meeting.key_takeaways.forEach((takeaway, index) => {
        const text = `${index + 1}. ${takeaway}`
        page.drawText(text, {
          x: margin + 20,
          y: yPosition,
          size: fontSize - 2,
          color: rgb(0, 0, 0),
          maxWidth: width - 2 * margin - 40,
        })
        yPosition -= 15

        // 新增頁面如果空間不足
        if (yPosition < margin + 20) {
          page = pdfDoc.addPage([612, 792])
          yPosition = height - margin
        }
      })
      yPosition -= 10
    }

    // 備註
    if (meeting.notes) {
      page.drawText('Notes / 備註:', {
        x: margin,
        y: yPosition,
        size: fontSize,
        color: rgb(0.2, 0.2, 0.2),
      })
      yPosition -= 5
      const notesText = meeting.notes.substring(0, 300)
      page.drawText(notesText, {
        x: margin + 20,
        y: yPosition,
        size: fontSize - 1,
        color: rgb(0, 0, 0),
        maxWidth: width - 2 * margin - 20,
      })
    }

    // 頁尾
    const pages = pdfDoc.getPages()
    pages.forEach((p, pageNum) => {
      p.drawText(`Page ${pageNum + 1} of ${pages.length}`, {
        x: margin,
        y: margin - 20,
        size: 9,
        color: rgb(128, 128, 128),
      })
      p.drawText(`Generated: ${new Date().toLocaleString('en-US')}`, {
        x: width - margin - 150,
        y: margin - 20,
        size: 9,
        color: rgb(128, 128, 128),
      })
    })

    // 生成 PDF 字節
    const pdfBytes = await pdfDoc.save()

    // 返回 PDF
    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="meeting_${meeting.id.substring(0, 8)}.pdf"`,
      },
    })
  } catch (error) {
    console.error('[meeting/export-pdf] Error:', error)
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
