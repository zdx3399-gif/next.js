import { notifyEmergencyContact, supabaseServer } from '@/lib/server/line-emergency';

export const runtime = 'nodejs';

const webhookSecret = process.env.IOT_WEBHOOK_SECRET;

export async function POST(req) {
  console.log('🚨 [IoT 緊急事件] Webhook 收到觸發');

  try {
    const inboundSecret = req.headers.get('x-webhook-secret');
    if (!webhookSecret) {
      console.error('[IoT 緊急事件] ❌ 未設定 IOT_WEBHOOK_SECRET');
      return Response.json({ success: false, message: 'Server secret not configured' }, { status: 500 });
    }

    if (!inboundSecret || inboundSecret !== webhookSecret) {
      console.warn('[IoT 緊急事件] ⚠️ secret 驗證失敗');
      return Response.json({ success: false, message: 'Unauthorized webhook' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[IoT 緊急事件] Webhook 內容:', JSON.stringify(body, null, 2));

    const { type, table, record } = body;

    if (!record || typeof record !== 'object') {
      return Response.json({ success: false, message: 'Missing webhook record' }, { status: 400 });
    }

    if (type !== 'INSERT' || table !== 'iot_events') {
      return Response.json({ success: false, message: 'Invalid webhook data: only iot_events INSERT is supported' }, { status: 400 });
    }

    const eventType = record.event_type || record?.event_data?.event_type;

    if (eventType !== 'emergency') {
      return Response.json({ success: false, message: 'Not an emergency event' }, { status: 400 });
    }

    const operatorProfileId = record.operator_profile_id || record?.event_data?.operator_profile_id;
    if (!operatorProfileId) {
      return Response.json({ success: false, message: 'Missing operator profile ID' }, { status: 400 });
    }

    let incidentId = record.linked_record_type === 'emergency' ? record.linked_record_id : null;

    if (!incidentId) {
      const eventData = record.event_data || {};
      const { data: incident, error: incidentError } = await supabaseServer
        .from('emergency_incidents')
        .insert([
          {
            source: 'system',
            reporter_profile_id: operatorProfileId,
            event_type: 'emergency',
            location: eventData.location || record.device_id || 'IoT 裝置',
            description: eventData.description || record.message || 'IoT 緊急事件',
            status: 'submitted',
            source_record_id: record.id,
          },
        ])
        .select('id')
        .single();

      if (!incidentError && incident?.id) {
        incidentId = incident.id;
        await supabaseServer
          .from('iot_events')
          .update({
            linked_record_type: 'emergency',
            linked_record_id: incident.id,
          })
          .eq('id', record.id);
      }
    }

    const notifyResult = await notifyEmergencyContact(operatorProfileId, 'IoT 緊急求助');

    const updatePayload = {
      processed: !!notifyResult.success,
      processed_at: notifyResult.success ? new Date().toISOString() : null,
      message: notifyResult.success
        ? `Emergency notification sent to ${notifyResult.contactName || 'unknown contact'}`
        : `Failed to send emergency notification: ${notifyResult.message}`,
      linked_record_type: incidentId ? 'emergency' : record.linked_record_type,
      linked_record_id: incidentId || record.linked_record_id || null,
    };

    if (!notifyResult.success) {
      await supabaseServer
        .from('iot_events')
        .update(updatePayload)
        .eq('id', record.id);

      return Response.json(
        {
          success: false,
          message: notifyResult.message,
        },
        { status: 500 },
      );
    }

    await supabaseServer
      .from('iot_events')
      .update(updatePayload)
      .eq('id', record.id);

    return Response.json(
      {
        success: true,
        message: 'Emergency notification sent successfully',
        iotLogId: record.id,
        incidentId,
        emergencyContactName: notifyResult.contactName,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[IoT 緊急事件] ❌ Webhook 處理失敗:', err);
    return Response.json(
      {
        success: false,
        message: 'Internal server error',
        error: err?.message || 'unknown error',
      },
      { status: 500 },
    );
  }
}
