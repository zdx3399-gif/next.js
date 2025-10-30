"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { createTenantClient, getCurrentTenant, setCurrentTenant, type TenantId } from "./supabase"
import type { SupabaseClient } from "@supabase/supabase-js"

interface TenantContextType {
  tenantId: TenantId
  supabase: SupabaseClient
  switchTenant: (tenantId: TenantId) => void
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantId] = useState<TenantId>(getCurrentTenant())
  const [supabase, setSupabase] = useState<SupabaseClient>(createTenantClient(tenantId))

  const switchTenant = (newTenantId: TenantId) => {
    setCurrentTenant(newTenantId)
    setTenantId(newTenantId)
    setSupabase(createTenantClient(newTenantId))
  }

  useEffect(() => {
    // Update client when tenant changes
    setSupabase(createTenantClient(tenantId))
  }, [tenantId])

  return <TenantContext.Provider value={{ tenantId, supabase, switchTenant }}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider")
  }
  return context
}
