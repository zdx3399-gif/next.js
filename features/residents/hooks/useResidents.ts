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
      ping_size: 0,
      car_spots: 0,
      moto_spots: 0,
      phone: "",
      email: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      role: "resident",
      relationship: "household_member", // Set default relationship
    }
    setResidents((prev) => [newResident, ...prev])
  }

  const updateRow = (index: number, field: keyof Resident, value: any) => {
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
        ping_size: resident.ping_size,
        car_spots: resident.car_spots,
        moto_spots: resident.moto_spots,
        phone: resident.phone,
        email: resident.email,
        emergency_contact_name: resident.emergency_contact_name,
        emergency_contact_phone: resident.emergency_contact_phone,
        role: resident.role,
        relationship: resident.relationship, // Include relationship in creation
      })
      if (result) {
        await loadResidents()
      }
    }
  }

  const handleDelete = async (id: string) => {
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
