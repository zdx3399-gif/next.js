import { createClient } from '@supabase/supabase-js';
import { Client } from '@line/bot-sdk';
import { writeServerAuditLog } from '@/lib/audit-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 延後到 request 才建立，避免 build 階段因環境變數缺失而報錯
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY.');
  }
  return createClient(url, serviceRoleKey || anonKey);
}

function getLineClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelAccessToken || !channelSecret) {
    throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET.');
  }
  return new Client({ channelAccessToken, channelSecret });
}

function mapMaintenanceStatusToRepair(status) {
  if (status === 'progress') return 'processing';
  if (status === 'closed') return 'completed';
  return 'pending';
}

function mapRepairStatusToMaintenance(status) {
  if (status === 'processing') return 'progress';
  if (status === 'completed' || status === 'cancelled') return 'closed';
  return 'open';
}

function toRepairResponse(row) {
  const status = mapMaintenanceStatusToRepair(row?.status);
  return {
    id: row?.id,
    repair_code: row?.id ? `M-${String(row.id).slice(0, 8)}` : null,
    user_id: row?.reported_by_id || null,
    category: row?.equipment || '一般報修',
    building: row?.unit_id ? String(row.unit_id) : null,
    location: row?.item || null,
    description: row?.description || '',
    priority: 'medium',
    status,
    assigned_to: row?.assignee || row?.handler || row?.assignee_id || row?.handler_id || null,
    notes: row?.admin_note || row?.note || row?.completion_note || '',
    created_at: row?.created_at,
    updated_at: row?.updated_at,
    completed_at: row?.completed_at || null,
  };
}

async function findLineUserIdByProfileId(supabase, profileId) {
  if (!profileId) return null;

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, line_user_id')
      .eq('id', profileId)
      .single();

    if (profile?.line_user_id) return profile.line_user_id;
    return null;
  } catch (e) {
    console.warn('[repairs] findLineUserIdByProfileId failed:', e);
    return null;
  }
}

// GET - 查詢報修單列表
export async function GET(req) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // pending/processing/completed/cancelled
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const repairId = searchParams.get('id'); // 查詢特定報修單

    // 查詢單一報修單詳情
    if (repairId) {
      const { data, error } = await supabase
        .from('maintenance')
        .select('*')
        .eq('id', repairId)
        .single();

      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      return Response.json({ success: true, data: toRepairResponse(data) });
    }

    // 查詢報修單列表
    let query = supabase
      .from('maintenance')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', mapRepairStatusToMaintenance(status));
    }

    const { data, error, count } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({
      success: true,
      data: (data || []).map(toRepairResponse),
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: count > offset + limit,
      },
    });
  } catch (err) {
    console.error('GET /api/repairs 錯誤:', err);
    return Response.json({ error: err.message || '伺服器錯誤' }, { status: 500 });
  }
}

// PATCH - 更新報修單狀態
export async function PATCH(req) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { id, status, priority, assigned_to, notes } = body;

    if (!id) {
      await writeServerAuditLog({
        supabase,
        operatorId: body?.updated_by || body?.user_id || null,
        operatorRole: 'admin',
        actionType: 'update_maintenance_request',
        targetType: 'maintenance_request',
        targetId: 'unknown',
        reason: '缺少報修單 ID',
        module: 'repairs',
        status: 'blocked',
        errorCode: 'missing_repair_id',
      });
      return Response.json({ error: '缺少報修單 ID' }, { status: 400 });
    }

    // 先獲取當前報修單資訊（用於比對狀態變更和推播通知）
    const { data: currentRepair } = await supabase
      .from('maintenance')
      .select('*')
      .eq('id', id)
      .single();

    if (!currentRepair) {
      await writeServerAuditLog({
        supabase,
        operatorId: body?.updated_by || body?.user_id || null,
        operatorRole: 'admin',
        actionType: 'update_maintenance_request',
        targetType: 'maintenance_request',
        targetId: id,
        reason: '找不到報修單',
        module: 'repairs',
        status: 'blocked',
        errorCode: 'repair_not_found',
      });
      return Response.json({ error: '找不到報修單' }, { status: 404 });
    }

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updateData.status = mapRepairStatusToMaintenance(status);
      if (status === 'completed' || status === 'cancelled') {
        updateData.completed_at = new Date().toISOString();
      }
    }
    if (assigned_to !== undefined) updateData.assignee = assigned_to;
    if (notes !== undefined) updateData.note = notes;
    if (priority) {
      updateData.admin_note = `priority=${priority}${notes ? `; ${notes}` : ''}`;
    }

    const { data, error } = await supabase
      .from('maintenance')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      await writeServerAuditLog({
        supabase,
        operatorId: body?.updated_by || body?.user_id || null,
        operatorRole: 'admin',
        actionType: 'update_maintenance_request',
        targetType: 'maintenance_request',
        targetId: id,
        reason: error.message,
        module: 'repairs',
        status: 'failed',
        errorCode: error.message,
      });
      return Response.json({ error: error.message }, { status: 400 });
    }

    const updatedRepair = data[0];

    // ===== 狀態變更推播通知 =====
    const prevStatus = mapMaintenanceStatusToRepair(currentRepair.status);
    if (status && status !== prevStatus) {
      try {
        const lineClient = getLineClient();

        const statusEmoji = {
          pending: '🟡',
          processing: '🔵',
          completed: '✅',
          cancelled: '❌',
        };

        const statusText = {
          pending: '待處理',
          processing: '處理中',
          completed: '已完成',
          cancelled: '已取消',
        };

        let notificationText = '';

        if (status === 'processing') {
          notificationText = `🔔 報修狀態更新\n\n您的報修 M-${String(updatedRepair.id).slice(0, 8)}\n${statusEmoji[status]} 目前狀態：${statusText[status]}\n\n我們正在處理您的報修，請稍候。`;
        } else if (status === 'completed') {
          notificationText = `✅ 您的報修已完成\n\n報修編號：M-${String(updatedRepair.id).slice(0, 8)}\n感謝您的通報\n\n如有任何問題，歡迎再次聯繫我們。`;
        } else if (status === 'cancelled') {
          notificationText = `❌ 報修已取消\n\n報修編號：M-${String(updatedRepair.id).slice(0, 8)}${notes ? '\n備註：' + notes : ''}`;
        } else {
          notificationText = `🔔 報修狀態更新\n\n您的報修 M-${String(updatedRepair.id).slice(0, 8)}\n${statusEmoji[status]} 目前狀態：${statusText[status]}`;
        }

        // 推播通知給報修住戶（先 profiles.line_user_id，再 line_users）
        const lineUserId = await findLineUserIdByProfileId(supabase, currentRepair.reported_by_id);
        if (lineUserId) {
          await lineClient.pushMessage(lineUserId, {
            type: 'text',
            text: notificationText,
          });
        }

        console.log(`[報修通知] 狀態更新：${status}`);
      } catch (pushError) {
        console.error('[報修通知] 推播失敗:', pushError);
        // 推播失敗不影響狀態更新，所以不回傳錯誤
      }
    }

    await writeServerAuditLog({
      supabase,
      operatorId: body?.updated_by || body?.user_id || null,
      operatorRole: 'admin',
      actionType: 'update_maintenance_request',
      targetType: 'maintenance_request',
      targetId: id,
      reason: '更新報修單狀態',
      beforeState: { status: currentRepair.status, note: currentRepair.note },
      afterState: { status: updatedRepair?.status, note: updatedRepair?.note },
      module: 'repairs',
      status: 'success',
    });

    return Response.json({ success: true, data: toRepairResponse(updatedRepair) });
  } catch (err) {
    console.error('PATCH /api/repairs 錯誤:', err);
    return Response.json({ error: err.message || '伺服器錯誤' }, { status: 500 });
  }
}

// POST - 管理員手動建立報修單
export async function POST(req) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { user_id, building, location, description, category, priority } = body;

    if (!location || !description) {
      await writeServerAuditLog({
        supabase,
        operatorId: user_id || null,
        operatorRole: user_id ? 'resident' : 'admin',
        actionType: 'create_maintenance_request',
        targetType: 'maintenance_request',
        targetId: 'unknown',
        reason: '缺少必要欄位',
        module: 'repairs',
        status: 'blocked',
        errorCode: 'missing_required_fields',
      });
      return Response.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('maintenance')
      .insert([{
        equipment: category || '一般報修',
        item: [building, location].filter(Boolean).join(' / ') || '未指定位置',
        description,
        status: 'open',
        reported_by_id: user_id || null,
        reported_by_name: user_id ? '住戶' : '管理員',
        note: priority ? `priority=${priority}` : '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select();

    if (error) {
      await writeServerAuditLog({
        supabase,
        operatorId: user_id || null,
        operatorRole: user_id ? 'resident' : 'admin',
        actionType: 'create_maintenance_request',
        targetType: 'maintenance_request',
        targetId: 'unknown',
        reason: error.message,
        module: 'repairs',
        status: 'failed',
        errorCode: error.message,
      });
      return Response.json({ error: error.message }, { status: 400 });
    }

    await writeServerAuditLog({
      supabase,
      operatorId: user_id || null,
      operatorRole: user_id ? 'resident' : 'admin',
      actionType: 'create_maintenance_request',
      targetType: 'maintenance_request',
      targetId: data?.[0]?.id || 'unknown',
      reason: '建立報修單',
      afterState: { category, building, location, priority },
      module: 'repairs',
      status: 'success',
    });

    return Response.json({ success: true, data: toRepairResponse(data[0]) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/repairs 錯誤:', err);
    return Response.json({ error: err.message || '伺服器錯誤' }, { status: 500 });
  }
}

// DELETE - 刪除報修單（管理員功能）
export async function DELETE(req) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id'); // 修正：原始碼為 sear.get('id')（typo）

    if (!id) {
      await writeServerAuditLog({
        supabase,
        operatorId: null,
        operatorRole: 'admin',
        actionType: 'delete_maintenance_request',
        targetType: 'maintenance_request',
        targetId: 'unknown',
        reason: '缺少報修單 ID',
        module: 'repairs',
        status: 'blocked',
        errorCode: 'missing_repair_id',
      });
      return Response.json({ error: '缺少報修單 ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('maintenance')
      .delete()
      .eq('id', id);

    if (error) {
      await writeServerAuditLog({
        supabase,
        operatorId: null,
        operatorRole: 'admin',
        actionType: 'delete_maintenance_request',
        targetType: 'maintenance_request',
        targetId: id,
        reason: error.message,
        module: 'repairs',
        status: 'failed',
        errorCode: error.message,
      });
      return Response.json({ error: error.message }, { status: 400 });
    }

    await writeServerAuditLog({
      supabase,
      operatorId: null,
      operatorRole: 'admin',
      actionType: 'delete_maintenance_request',
      targetType: 'maintenance_request',
      targetId: id,
      reason: '刪除報修單',
      module: 'repairs',
      status: 'success',
    });

    return Response.json({ success: true, message: '報修單已刪除' });
  } catch (err) {
    console.error('DELETE /api/repairs 錯誤:', err);
    return Response.json({ error: err.message || '伺服器錯誤' }, { status: 500 });
  }
}
