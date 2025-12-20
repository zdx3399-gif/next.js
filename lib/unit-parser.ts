/**
 * Parses unit_number or unit_code to extract building, floor, and room components
 * Use this when you need to analyze or display unit information in detail
 *
 * NOTE: building, floor, room_number 欄位已從資料庫移除
 * 使用這些函數從 unit_number 或 unit_code 解析出組件
 */
export interface UnitComponents {
  building: string | null
  floor: number | null
  room: string | null
}

/**
 * Parse unit_number format (A-10-1001) into components
 * 用於從 unit_number 欄位解析出棟、樓層、房號資訊
 */
export function parseUnitNumber(unitNumber: string): UnitComponents {
  // Format: A-10-1001 => building-floor-room
  const parts = unitNumber.split("-")

  if (parts.length === 3) {
    return {
      building: parts[0],
      floor: Number.parseInt(parts[1], 10),
      room: parts[2],
    }
  }

  return {
    building: null,
    floor: null,
    room: null,
  }
}

/**
 * Parse unit_code format (A棟-10F-1001) into components
 * 用於從 unit_code 欄位解析出棟、樓層、房號資訊
 */
export function parseUnitCode(unitCode: string): UnitComponents {
  // Format: A棟-10F-1001 => building棟-floorF-room
  const parts = unitCode.split("-")

  if (parts.length === 3) {
    const building = parts[0].replace("棟", "")
    const floor = Number.parseInt(parts[1].replace("F", ""), 10)
    const room = parts[2]

    return {
      building,
      floor,
      room,
    }
  }

  return {
    building: null,
    floor: null,
    room: null,
  }
}

/**
 * Format unit components back to unit_number format
 * 用於將組件格式化為 unit_number 格式（儲存用）
 */
export function formatUnitNumber(building: string, floor: number, room: string): string {
  return `${building}-${floor}-${room}`
}

/**
 * Format unit components back to unit_code format
 * 用於將組件格式化為 unit_code 格式（顯示用）
 */
export function formatUnitCode(building: string, floor: number, room: string): string {
  return `${building}棟-${floor}F-${room}`
}
