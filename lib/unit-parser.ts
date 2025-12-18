/**
 * Parses unit_number or unit_code to extract building, floor, and room components
 * Use this when you need to analyze or display unit information in detail
 */
export interface UnitComponents {
  building: string | null
  floor: number | null
  room: string | null
}

/**
 * Parse unit_number format (A-10-1001) into components
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
 */
export function formatUnitNumber(building: string, floor: number, room: string): string {
  return `${building}-${floor}-${room}`
}

/**
 * Format unit components back to unit_code format
 */
export function formatUnitCode(building: string, floor: number, room: string): string {
  return `${building}棟-${floor}F-${room}`
}
