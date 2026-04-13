import { Client } from '@line/bot-sdk';
import { createClient } from '@supabase/supabase-js';

const supabaseServerKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-key';
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';

if (!supabaseUrl) {
  console.warn('⚠️ 未設定 SUPABASE_URL');
}

if (!supabaseServerKey) {
  console.warn('⚠️ 未設定 SUPABASE_SERVICE_ROLE_KEY，部分伺服器操作可能失敗。');
}

export const supabaseServer = createClient(supabaseUrl || '', supabaseServerKey || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dummy-access-token',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'dummy-channel-secret',
};

export const lineBotClient = new Client(lineConfig);

export async function notifyEmergencyContact(operatorProfileId, eventContext = 'IoT 緊急事件') {
  try {
    console.log(`🚨 [緊急通知] 準備推播給聯繫人，操作人員 ID: ${operatorProfileId}`);

    const { data: operatorProfile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, name, unit_id')
      .eq('id', operatorProfileId)
      .maybeSingle();

    if (profileError || !operatorProfile) {
      console.error('[緊急通知] ❌ 無法查詢住戶資訊:', profileError);
      return { success: false, message: '無法查詢住戶資訊' };
    }

    const { data: emergencyContact, error: emergencyContactError } = await supabaseServer
      .from('emergency_contacts')
      .select('contact_name, contact_phone, contact_line_user_id, verify_status')
      .eq('resident_profile_id', operatorProfileId)
      .eq('verify_status', 'verified')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (emergencyContactError) {
      console.error('[緊急通知] ❌ 無法查詢緊急聯絡人:', emergencyContactError);
      return { success: false, message: '無法查詢緊急聯絡人資料' };
    }

    if (!emergencyContact?.contact_line_user_id) {
      console.warn('[緊急通知] ⚠️ 住戶未設定已驗證的緊急聯絡人 LINE user ID');
      return { success: false, message: '住戶未設定已驗證的緊急聯絡人 LINE user ID' };
    }

    let roomInfo = '未提供';
    if (operatorProfile.unit_id) {
      const { data: unitData } = await supabaseServer
        .from('units')
        .select('unit_number, unit_code')
        .eq('id', operatorProfile.unit_id)
        .maybeSingle();

      if (unitData) {
        roomInfo = unitData.unit_number || unitData.unit_code || '未提供';
      }
    }

    const emergencyMessage = {
      type: 'text',
      text:
        '🚨 【緊急事件通知】\n\n' +
        `事件類型：${eventContext}\n` +
        `住戶姓名：${operatorProfile.name || '未提供'}\n` +
        `房號：${roomInfo}\n` +
        `聯繫電話：${emergencyContact.contact_phone || '未提供'}\n` +
        `事件時間：${new Date().toLocaleString('zh-TW', { hour12: false })}\n\n` +
        '⚠️ 請立即採取行動！',
    };

    await lineBotClient.pushMessage(emergencyContact.contact_line_user_id, emergencyMessage);

    console.log(`🚨 [緊急通知] ✅ 已發送給 ${emergencyContact.contact_name || '未命名聯絡人'}`);

    return {
      success: true,
      message: '緊急通知已發送',
      contactName: emergencyContact.contact_name,
    };
  } catch (err) {
    console.error('[緊急通知] ❌ 發送失敗:', err);
    return {
      success: false,
      message: `發送失敗: ${err?.message || 'unknown error'}`,
    };
  }
}


