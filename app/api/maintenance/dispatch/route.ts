// app/api/maintenance/dispatch/route.ts
// Maintenance dispatch API with LINE notification

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { writeServerAuditLog } from '@/lib/audit-server'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

const LINE_API = 'https://api.line.me/v2/bot/message/push'
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN

interface DispatchRequest {
  maintenanceId: string
  vendor_name: string
  worker_name: string
  worker_phone: string
  scheduled_at: string
  estimated_cost?: number
  admin_note?: string
  operatorId?: string | null
  operatorRole?: string
}

export async function POST(req: Request) {
  try {
    const body: DispatchRequest = await req.json()

    const {
      maintenanceId,
      vendor_name,
      worker_name,
      worker_phone,
      scheduled_at,
      estimated_cost,
      admin_note,
      operatorId,
      operatorRole
    } = body

    // Validate required fields
    if (!maintenanceId || !vendor_name || !worker_name || !scheduled_at) {
      await writeServerAuditLog({
        supabase,
        operatorId: operatorId || undefined,
        operatorRole: operatorRole || 'unknown',
        actionType: 'dispatch_maintenance',
        targetType: 'maintenance',
        targetId: maintenanceId || 'unknown',
        reason: '派工缺少必要欄位',
        module: 'maintenance',
        status: 'blocked',
        errorCode: 'missing_required_fields',
      })
      return NextResponse.json(
        { error: '缺少必填欄位' },
        { status: 400 }
      )
    }

    // 1) Get maintenance record with reporter info
    const { data: maintenance, error: maintError } = await supabase
      .from('maintenance')
      .select('*, reported_by_id, reported_by_name, equipment, item, description')
      .eq('id', maintenanceId)
      .single()

    if (maintError || !maintenance) {
      console.error('查詢維修單失敗:', maintError)
      await writeServerAuditLog({
        supabase,
        operatorId: operatorId || undefined,
        operatorRole: operatorRole || 'unknown',
        actionType: 'dispatch_maintenance',
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

    const existingLogs = Array.isArray(maintenance.logs) ? maintenance.logs : []
    const dispatchLog = {
      type: 'dispatch',
      at: new Date().toISOString(),
      vendor_name,
      worker_name,
      worker_phone,
      scheduled_at,
      estimated_cost: estimated_cost || null,
      admin_note: admin_note || null,
      status: 'dispatched'
    }

    // 2) Update maintenance record with dispatch info
    const { error: updateError } = await supabase
      .from('maintenance')
      .update({
        vendor_name,
        worker_name,
        worker_phone,
        scheduled_at,
        estimated_cost: estimated_cost || null,
        admin_note: admin_note || null,
        status: 'progress',
        dispatched_at: new Date().toISOString(),
        logs: [...existingLogs, dispatchLog]
      })
      .eq('id', maintenanceId)

    if (updateError) {
      console.error('更新維修單失敗:', updateError)
      await writeServerAuditLog({
        supabase,
        operatorId: operatorId || undefined,
        operatorRole: operatorRole || 'unknown',
        actionType: 'dispatch_maintenance',
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

    await writeServerAuditLog({
      supabase,
      operatorId: operatorId || undefined,
      operatorRole: operatorRole || 'unknown',
      actionType: 'dispatch_maintenance',
      targetType: 'maintenance',
      targetId: maintenanceId,
      reason: `${vendor_name} ${worker_name}`,
      module: 'maintenance',
      status: 'success',
      beforeState: { status: maintenance.status || 'open' },
      afterState: { status: 'progress', vendor_name, worker_name, scheduled_at, estimated_cost: estimated_cost || null },
    })

    // 3) Find reporter's LINE user ID
    let lineUserId: string | null = null
    let residentName = maintenance.reported_by_name || '住戶'

    if (maintenance.reported_by_id) {
      // First try profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, line_user_id')
        .eq('id', maintenance.reported_by_id)
        .single()

      if (profile) {
        residentName = profile.name || residentName
        lineUserId = profile.line_user_id

        // If not in profiles, check line_users table
        if (!lineUserId) {
          const { data: lineUser } = await supabase
            .from('line_users')
            .select('line_user_id')
            .eq('profile_id', profile.id)
            .maybeSingle()

          lineUserId = lineUser?.line_user_id || null
        }
      }
    }

    // 4) Send LINE notification if user has LINE bound
    let lineNotificationSent = false
    let lineError: string | null = null

    if (lineUserId && LINE_TOKEN) {
      const scheduledDate = new Date(scheduled_at)
      const formattedDate = scheduledDate.toLocaleDateString('zh-TW', {
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      })
      const formattedTime = scheduledDate.toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
      })

      const message = {
        to: lineUserId,
        messages: [
          {
            type: 'flex',
            altText: '📢 維修通知 - 您的報修單已受理',
            contents: {
              type: 'bubble',
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '🔧 維修通知',
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
                    text: '您的報修單已受理！',
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
                            text: '📋 報修項目',
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
                            text: '🏢 廠商',
                            size: 'sm',
                            color: '#666666',
                            flex: 0
                          },
                          {
                            type: 'text',
                            text: vendor_name,
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
                            text: '👷 維修師傅',
                            size: 'sm',
                            color: '#666666',
                            flex: 0
                          },
                          {
                            type: 'text',
                            text: worker_name,
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
                            text: '📅 預約時間',
                            size: 'sm',
                            color: '#666666',
                            flex: 0
                          },
                          {
                            type: 'text',
                            text: `${formattedDate} ${formattedTime}`,
                            size: 'sm',
                            color: '#1DB446',
                            weight: 'bold',
                            align: 'end',
                            flex: 1
                          }
                        ]
                      },
                      ...(estimated_cost ? [{
                        type: 'box' as const,
                        layout: 'horizontal' as const,
                        contents: [
                          {
                            type: 'text' as const,
                            text: '💰 預估費用',
                            size: 'sm' as const,
                            color: '#666666',
                            flex: 0
                          },
                          {
                            type: 'text' as const,
                            text: `NT$ ${estimated_cost.toLocaleString()}`,
                            size: 'sm' as const,
                            color: '#333333',
                            align: 'end' as const,
                            flex: 1
                          }
                        ]
                      }] : [])
                    ]
                  }
                ],
                paddingAll: '15px'
              },
              footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '如有任何問題，請聯繫管理室',
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
          console.log('✅ LINE 通知發送成功')
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

    return NextResponse.json({
      success: true,
      message: '派工成功',
      maintenanceId,
      lineNotification: {
        sent: lineNotificationSent,
        error: lineError
      }
    })

  } catch (error: any) {
    console.error('派工 API 錯誤:', error)
    return NextResponse.json(
      { error: '伺服器錯誤: ' + error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to check dispatch status
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const maintenanceId = searchParams.get('id')

  if (!maintenanceId) {
    return NextResponse.json({ error: '缺少維修單 ID' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('maintenance')
    .select('*, vendor_name, worker_name, worker_phone, scheduled_at, estimated_cost, status')
    .eq('id', maintenanceId)
    .single()

  if (error) {
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }

  return NextResponse.json({ data })
}