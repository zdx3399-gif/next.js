import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { writeServerAuditLog } from '@/lib/audit-server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    const { email, password, name, phone, role = 'resident', relationship = 'household_member', unit } = await req.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !password) {
      await writeServerAuditLog({
        supabase,
        operatorId: normalizedEmail || undefined,
        operatorRole: role,
        actionType: 'register_user',
        targetType: 'user',
        targetId: normalizedEmail || 'unknown',
        reason: 'Email 和密碼為必填',
        module: 'auth',
        status: 'blocked',
        errorCode: 'missing_required_fields',
      });
      return NextResponse.json(
        { success: false, message: 'Email 和密碼為必填' },
        { status: 400 }
      );
    }

    // 使用 Supabase Auth 註冊
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user) {
      console.error('❌ 註冊失敗:', error);
      await writeServerAuditLog({
        supabase,
        operatorId: normalizedEmail || undefined,
        operatorRole: role,
        actionType: 'register_user',
        targetType: 'user',
        targetId: normalizedEmail || 'unknown',
        reason: error?.message || '註冊失敗',
        module: 'auth',
        status: 'failed',
        errorCode: error?.message || 'auth_signup_failed',
      });
      return NextResponse.json(
        { success: false, message: error?.message || '註冊失敗' },
        { status: 400 }
      );
    }

    // 解析單位信息
    let unitId: string | null = null;
    if (unit) {
      // 簡單的單位查找或創建邏輯
      const { data: existingUnit, error: findUnitError } = await supabase
        .from('units')
        .select('id')
        .eq('unit_code', unit)
        .maybeSingle();

      if (existingUnit) {
        unitId = existingUnit.id;
      } else {
        // 創建新單位
        const { data: newUnit, error: createUnitError } = await supabase
          .from('units')
          .insert([{ unit_code: unit, unit_number: unit }])
          .select('id')
          .single();

        if (newUnit) {
          unitId = newUnit.id;
        }
      }
    }

    // 將用戶資訊寫入 profiles 表
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: data.user.id,
          email: normalizedEmail,
          password,
          name: name || null,
          phone: phone || null,
          role: role || 'resident',
          status: 'active',
          points_balance: 100,
          penalty_count: 0,
          booking_status: 'active',
          unit_id: unitId,
        },
      ])
      .select('*')
      .single();

    if (profileError || !profile) {
      console.error('❌ 建立 profile 失敗:', profileError);
      // 刪除已建立的 auth 用戶
      await supabase.auth.admin.deleteUser(data.user.id);
      await writeServerAuditLog({
        supabase,
        operatorId: data.user.id,
        operatorRole: role,
        actionType: 'register_user',
        targetType: 'user',
        targetId: data.user.id,
        reason: '建立用戶資訊失敗',
        module: 'auth',
        status: 'failed',
        errorCode: profileError?.message || 'profile_create_failed',
      });
      return NextResponse.json(
        { success: false, message: '建立用戶資訊失敗' },
        { status: 400 }
      );
    }

    // 創建 household_member 記錄
    if (unitId) {
      const { error: householdError } = await supabase
        .from('household_members')
        .insert([{
          name: name || null,
          role: role || 'resident',
          relationship: relationship || 'household_member',
          unit_id: unitId,
          profile_id: profile.id,
        }]);

      if (householdError) {
        console.warn('⚠️ 建立 household_member 失敗，但 profile 已建立:', householdError);
        // 不中斷流程，因為 profile 已經成功建立
      }
    }

    console.log('✅ 註冊成功:', normalizedEmail);

    await writeServerAuditLog({
      supabase,
      operatorId: profile.id,
      operatorRole: profile.role,
      actionType: 'register_user',
      targetType: 'user',
      targetId: profile.id,
      reason: normalizedEmail,
      module: 'auth',
      status: 'success',
      afterState: { role: profile.role, status: profile.status, unit_id: profile.unit_id },
    });

    return NextResponse.json({
      success: true,
      message: '註冊成功',
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
        status: profile.status,
        unit_id: profile.unit_id,
        line_user_id: profile.line_user_id,
        line_display_name: profile.line_display_name,
        line_avatar_url: profile.line_avatar_url,
        line_status_message: profile.line_status_message,
        line_bound: !!profile.line_user_id,
        created_at: profile.created_at
      },
    });
  } catch (error: any) {
    console.error('❌ 註冊錯誤:', error);
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    );
  }
}