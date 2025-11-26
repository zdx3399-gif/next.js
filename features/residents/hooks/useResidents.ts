"use client"

import { useState, useEffect, useCallback } from "react"
import { fetchResidents, createResident, updateResident, deleteResident, type Resident } from "../api/residents"

export function useResidents() {
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)

  const loadResidents = useCallback(async () => {
    setLoading(true)
    const data = await fetchResidents()
    setResidents(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadResidents()
  }, [loadResidents])

  const addNewRow = () => {
    const newResident: Resident = {
      name: "",
      room: "",
      phone: "",
      email: "",
      role: "resident",
    }
    setResidents((prev) => [newResident, ...prev])
  }

  const updateRow = (index: number, field: keyof Resident, value: string) => {
    setResidents((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSave = async (resident: Resident, index: number) => {
    if (resident.id) {
      const result = await updateResident(resident.id, resident)
      if (result) {
        await loadResidents()
      }
    } else {
      const result = await createResident({
        name: resident.name,
        room: resident.room,
        phone: resident.phone,
        email: resident.email,
        role: resident.role,
      })
      if (result) {
        await loadResidents()
      }
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm("確定要刪除此住戶嗎？")) {
      const success = await deleteResident(id)
      if (success) {
        await loadResidents()
      }
    }
  }

  return {
    residents,
    loading,
    addNewRow,
    updateRow,
    handleSave,
    handleDelete,
    refresh: loadResidents,
  }
}
