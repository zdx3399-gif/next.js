"use client"

import { useState, useEffect, useCallback } from "react"
import {
  type FinanceRecord,
  type ExpenseRecord,
  fetchAllFinanceRecords,
  fetchUserFinanceRecords,
  createFinanceRecord,
  updateFinanceRecord,
  deleteFinanceRecord,
  fetchExpenseRecords,
  saveExpenseRecord,
  removeExpenseRecord,
} from "../api/finance"

export function useFinance(userRoom?: string, userUnitId?: string) {
  const [records, setRecords] = useState<FinanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadRecords = useCallback(async () => {
    setLoading(true)
    const data = userRoom || userUnitId ? await fetchUserFinanceRecords(userRoom || "", userUnitId) : await fetchAllFinanceRecords()
    setRecords(data)
    setLoading(false)
  }, [userRoom, userUnitId])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  return { records, loading, refresh: loadRecords }
}

export function useFinanceExpenses() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    const data = await fetchExpenseRecords()
    setExpenses(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  const saveExpense = async (expense: Omit<ExpenseRecord, "id"> & { id?: string }) => {
    const result = await saveExpenseRecord(expense)
    if (result.success) {
      await loadExpenses()
    }
    return result
  }

  const deleteExpense = async (id: string) => {
    const result = await removeExpenseRecord(id)
    if (result.success) {
      await loadExpenses()
    }
    return result
  }

  return {
    expenses,
    loading,
    refresh: loadExpenses,
    saveExpense,
    deleteExpense,
  }
}

export function useFinanceAdmin() {
  const [records, setRecords] = useState<FinanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadRecords = useCallback(async () => {
    setLoading(true)
    const data = await fetchAllFinanceRecords()
    setRecords(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const updateRow = (index: number, field: string, value: any) => {
    setRecords((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addRow = () => {
    const newRow: FinanceRecord = {
      id: "",
      room: "",
      amount: 0,
      due: "",
      invoice: "",
      paid: false,
      monthly_fee: 0, // Added monthly_fee
    }
    setRecords((prev) => [...prev, newRow])
  }

  const saveRecord = async (record: Omit<FinanceRecord, 'id'> & { id?: string }, index: number) => {
    console.log("[v0] saveRecord called with:", { record, index })

    if (record.id) {
      console.log("[v0] Updating existing record")
      const result = await updateFinanceRecord(record.id, {
        amount: record.amount,
        due: record.due,
        invoice: record.invoice,
        paid: record.paid,
        unit_id: record.unit_id,
        monthly_fee: record.monthly_fee,
      })
      if (!result.success) {
        console.error("[v0] Update failed:", result.error)
        alert("儲存失敗: " + result.error)
        return false
      }
      console.log("[v0] Update successful")
    } else {
      console.log("[v0] Creating new record")
      const result = await createFinanceRecord({
        room: record.room,
        amount: record.amount,
        due: record.due,
        invoice: record.invoice,
        paid: record.paid,
        unit_id: record.unit_id,
        monthly_fee: record.monthly_fee,
      })
      if (!result.success) {
        console.error("[v0] Create failed:", result.error)
        alert("新增失敗: " + result.error)
        return false
      }
      console.log("[v0] Create successful, data:", result.data)
      if (result.data) {
        setRecords((prev) => {
          const updated = [...prev]
          updated[index] = result.data!
          return updated
        })
      }
    }
    await loadRecords()
    return true
  }

  const removeRecord = async (id: string) => {
    if (!confirm("確定要刪除此記錄嗎？")) return false
    const success = await deleteFinanceRecord(id)
    if (success) {
      setRecords((prev) => prev.filter((r) => r.id !== id))
    }
    return success
  }

  return {
    records,
    loading,
    refresh: loadRecords,
    updateRow,
    addRow,
    saveRecord,
    deleteRecord: removeRecord,
    updateRecord: saveRecord,
  }
}
