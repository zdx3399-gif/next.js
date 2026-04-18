// app/api/maintenance/complete/route.ts
// Maintenance completion API with LINE notification

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { writeServerAuditLog } from '@/lib/audit-server'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'placeholder-key'
)

const LINE_API = 'https://api.line.me/v2/bot/message/push'
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN

interface CompleteRequest {
  maintenanceId: string
  final_cost?: number
  completion_note?: string
  completion_photo_url?: string
  generate_fee?: boolean  // Whether to generate a fee record
  operatorId?: string | null
  operatorRole?: string
}

export async function POST(req: Request) {
  try {
    const body: CompleteRequest = await req.json()

    const {
      maintenanceId,
      final_cost,
      completion_note,
      completion_photo_url,
      generate_fee = false,
      operatorId,
      operatorRole
    } = body

    if (!maintenanceId) {
      await writeServerAuditLog({
        supabase,
        operatorId: operatorId || undefined,
        operatorRole: operatorRole || 'unknown',
        actionType: 'complete_maintenance',
        targetType: 'maintenance',
        targetId: 'unknown',
        reason: '缺少維修單 ID',
        module: 'maintenance',
        status: 'blocked',
        errorCode: 'missing_maintenance_id',
      })
      return NextResponse.json(
        { error: '缺少維修單 ID' },
        { status: 400 }
      )
    }

    // 1) Get maintenance record
    const { data: maintenance, error: maintError } = await supabase
      .from('maintenance')
      .select('*')
      .eq('id', maintenanceId)
      .single()

    if (maintError || !maintenance) {
      console.error('查詢維修單失敗:', maintError)
      await writeServerAuditLog({
        supabase,
        operatorId: operatorId || undefined,
        operatorRole: operatorRole || 'unknown',
        actionType: 'complete_maintenance',
        targetType: 'maintenance',
        targetId: maintenanceId,
        reason: '找不到該維修單',
        module: 'maintenance',
        status: 'blocked',
        errorCode: 'maintenance_not_found',
      })
      return NextResponse.json(
        { error: '找不到該維修單' },
        { status: 404 }
      )
    }

    // 2) Update maintenance record to completed
    const { error: updateError } = await supabase
      .from('maintenance')
      .update({
        status: 'closed',
        cost: final_cost || maintenance.estimated_cost || 0,
        completion_note: completion_note || null,
        completion_photo_url: completion_photo_url || null,
        completed_at: new Date().toISOString()
      })
      .eq('id', maintenanceId)

    if (updateError) {
      console.error('更新維修單失敗:', updateError)
      await writeServerAuditLog({
        supabase,
        operatorId: operatorId || undefined,
        operatorRole: operatorRole || 'unknown',
        actionType: 'complete_maintenance',
        targetType: 'maintenance',
        targetId: maintenanceId,
        reason: updateError.message,
        module: 'maintenance',
        status: 'failed',
        errorCode: updateError.message,
      })
      return NextResponse.json(
        { error: '更新維修單失敗: ' + updateError.message },
        { status: 500 }
      )
    }

    // 3) Generate fee record if requested
    let feeGenerated = false
    let feeId: string | null = null

    if (generate_fee && final_cost && final_cost > 0 && maintenance.unit_id) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 14) // Due in 14 days

      const { data: feeData, error: feeError } = await supabase
        .from('fees')
        .insert({
          unit_id: maintenance.unit_id,
          amount: final_cost,
          due: dueDate.toISOString(),
          paid: false,
          note: `維修費用 - ${maintenance.equipment || ''} ${maintenance.item || ''}`,
          maintenance_id: maintenanceId
        })
        .select()
        .single()

      if (feeError) {
        console.warn('產生繳費單失敗:', feeError.message)
      } else {
        feeGenerated = true
        feeId = feeData?.id
      }
    }

    await writeServerAuditLog({
      supabase,
      operatorId: operatorId || undefined,
      operatorRole: operatorRole || 'unknown',
      actionType: 'complete_maintenance',
      targetType: 'maintenance',
      targetId: maintenanceId,
      reason: completion_note || '維修結案',
      module: 'maintenance',
      status: 'success',
      beforeState: { status: maintenance.status || 'progress', estimated_cost: maintenance.estimated_cost || 0 },
      afterState: { status: 'closed', final_cost: final_cost || maintenance.estimated_cost || 0, fee_generated: feeGenerated, fee_id: feeId },
    })

    // 4) Find reporter's LINE user ID
    let lineUserId: string | null = null
    let residentName = maintenance.reported_by_name || '住戶'

    if (maintenance.reported_by_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, line_user_id')
        .eq('id', maintenance.reported_by_id)
        .single()

      if (profile) {
        residentName = profile.name || residentName
        lineUserId = profile.line_user_id
      }
    }

    // 5) Send LINE completion notification
    let lineNotificationSent = false
    let lineError: string | null = null

    if (lineUserId && LINE_TOKEN) {
      const completedDate = new Date().toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      const message = {
        to: lineUserId,
        messages: [
          {
            type: 'flex',
            altText: '✅ 維修完成通知',
            contents: {
              type: 'bubble',
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '✅ 維修完成',
                    weight: 'bold',
                    size: 'xl',
                    color: '#1DB446'
                  }
                ],
                backgroundColor: '#F0FFF4',
                paddingAll: '15px'
              },
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: `${residentName}您好，`,
                    size: 'md',
                    color: '#333333',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: '您的維修案件已完成！',
                    size: 'md',
                    color: '#333333',
                    margin: 'sm'
                  },
                  {
                    type: 'separator',
                    margin: 'lg'
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'lg',
                    spacing: 'sm',
                    contents: [
                      {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                          {
                            type: 'text',
                            text: '📋 維修項目',
                            size: 'sm',
                            color: '#666666',
                            flex: 0
                          },
                          {
                            type: 'text',
                            text: `${maintenance.equipment || ''} - ${maintenance.item || ''}`,
                            size: 'sm',
                            color: '#333333',
                            align: 'end',
                            flex: 1
                          }
                        ]
                      },
                      {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                          {
                            type: 'text',
                            text: '📅 完成日期',
                            size: 'sm',
                            color: '#666666',
                            flex: 0
                          },
                          {
                            type: 'text',
                            text: completedDate,
                            size: 'sm',
                            color: '#333333',
                            align: 'end',
                            flex: 1
                          }
                        ]
                      },
                      ...(final_cost ? [{
                        type: 'box' as const,
                        layout: 'horizontal' as const,
                        contents: [
                          {
                            type: 'text' as const,
                            text: '💰 維修費用',
                            size: 'sm' as const,
                            color: '#666666',
                            flex: 0
                          },
                          {
                            type: 'text' as const,
                            text: `NT$ ${final_cost.toLocaleString()}`,
                            size: 'sm' as const,
                            color: '#FF5722',
                            weight: 'bold' as const,
                            align: 'end' as const,
                            flex: 1
                          }
                        ]
                      }] : []),
                      ...(completion_note ? [{
                        type: 'box' as const,
                        layout: 'vertical' as const,
                        margin: 'md' as const,
                        contents: [
                          {
                            type: 'text' as const,
                            text: '📝 備註',
                            size: 'sm' as const,
                            color: '#666666'
                          },
                          {
                            type: 'text' as const,
                            text: completion_note,
                            size: 'sm' as const,
                            color: '#333333',
                            wrap: true,
                            margin: 'sm' as const
                          }
                        ]
                      }] : [])
                    ]
                  },
                  ...(feeGenerated ? [{
                    type: 'box' as const,
                    layout: 'vertical' as const,
                    margin: 'lg' as const,
                    backgroundColor: '#FFF3E0',
                    cornerRadius: 'md' as const,
                    paddingAll: '10px' as const,
                    contents: [
                      {
                        type: 'text' as const,
                        text: '📄 已產生繳費單，請至系統查看',
                        size: 'sm' as const,
                        color: '#E65100',
                        wrap: true
                      }
                    ]
                  }] : [])
                ],
                paddingAll: '15px'
              },
              footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '感謝您的耐心等候',
                    size: 'xs',
                    color: '#999999',
                    align: 'center'
                  }
                ],
                paddingAll: '10px'
              }
            }
          }
        ]
      }

      try {
        const lineResponse = await fetch(LINE_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_TOKEN}`
          },
          body: JSON.stringify(message)
        })

        if (lineResponse.ok) {
          lineNotificationSent = true
          console.log('✅ LINE 完成通知發送成功')
        } else {
          const errorData = await lineResponse.json()
          lineError = errorData.message || 'LINE API 錯誤'
          console.error('❌ LINE 通知發送失敗:', errorData)
        }
      } catch (err: any) {
        lineError = err.message
        console.error('❌ LINE 通知錯誤:', err)
      }
    } else if (!lineUserId) {
      lineError = '住戶尚未綁定 LINE'
    } else if (!LINE_TOKEN) {
      lineError = '缺少 LINE_CHANNEL_ACCESS_TOKEN'
    }

    // 6) Delete the maintenance record after completion
    const { error: deleteError } = await supabase
      .from('maintenance')
      .delete()
      .eq('id', maintenanceId)

    if (deleteError) {
      console.warn('刪除維修單失敗:', deleteError.message)
    }

    return NextResponse.json({
      success: true,
      message: '結案成功',
      maintenanceId,
      feeGenerated,
      feeId,
      lineNotification: {
        sent: lineNotificationSent,
        error: lineError
      }
    })

  } catch (error: any) {
    console.error('結案 API 錯誤:', error)
    return NextResponse.json(
      { error: '伺服器錯誤: ' + error.message },
      { status: 500 }
    )
  }
}