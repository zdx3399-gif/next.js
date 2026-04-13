"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner";

export function ArduinoConsole() {
  const [log, setLog] = useState("")
  const [connectionMode, setConnectionMode] = useState<"serial" | "wifi">("serial")
  const [isConnected, setIsConnected] = useState(false)

  // 將 log 依行分割並分類
  function parseLogs(logStr: string) {
    const lines = logStr.split("\n").filter(Boolean);
    const visitorLogs: string[] = [];
    const packageLogs: string[] = [];
    const emergencyLogs: string[] = [];
    lines.forEach(line => {
      // 包裹分類（明確指令）
      if (
        line.includes("包裹") || line.includes("Package") ||
        line.startsWith("IOT: P") || line.startsWith("Arduino: P") ||
        line.startsWith("IOT: PACKAGE") || line.startsWith("IOT: PACKAG") || line.startsWith("IOT: Pa") || line.startsWith("IOT: PACKAGE:") ||
        line.startsWith("Arduino: PACKAGE") || line.startsWith("Arduino: PACKAG") || line.startsWith("Arduino: Pa") || line.startsWith("Arduino: PACKAGE:")
      ) {
        packageLogs.push(line);
        return;
      }
      // 緊急分類（明確指令）
      if (
        line.includes("緊急") || line.includes("Emergency") ||
        line.startsWith("IOT: E") || line.startsWith("Arduino: E") ||
        line.startsWith("IOT: EMERGENCY") || line.startsWith("Arduino: EMERGENCY") ||
        line.includes("取消") || line.includes("Cancel") ||
        line.startsWith("IOT: C") || line.startsWith("Arduino: C")
      ) {
        emergencyLogs.push(line);
        return;
      }
      // 訪客分類（明確指令）
      if (
        line.includes("訪客") || line.includes("Visitor") ||
        line.startsWith("IOT: V") || line.startsWith("IOT: Vi") || line.startsWith("Arduino: V") || line.startsWith("Arduino: Vi")
      ) {
        visitorLogs.push(line);
        return;
      }
    });
    const maxRows = Math.max(visitorLogs.length, packageLogs.length, emergencyLogs.length);
    return { visitorLogs, packageLogs, emergencyLogs, maxRows };
  }
  const portRef = useRef<any>(null)
  const writerRef = useRef<any>(null)
  const readerRef = useRef<any>(null)
  const pendingAckQueueRef = useRef<string[]>([])

  const expectedAckByCommand: Record<string, string> = {
    V: "VISITOR",
    P: "PACKAGE",
    E: "EMERGENCY",
    C: "EMERGENCY STOP",
  }

  function appendLog(msg: string) {
    setLog((prev) => prev + msg + "\n")
  }

  async function disconnectSerial() {
    try {
      if (readerRef.current) {
        try {
          await readerRef.current.cancel()
        } catch {
          // ignore cancel errors when reader already closed
        }
        readerRef.current.releaseLock?.()
        readerRef.current = null
      }

      if (writerRef.current) {
        writerRef.current.releaseLock?.()
        writerRef.current = null
      }

      if (portRef.current) {
        await portRef.current.close()
        portRef.current = null
      }
    } catch {
      // ignore close errors to avoid blocking next connect
    } finally {
      pendingAckQueueRef.current = []
      setIsConnected(false)
    }
  }

  function handleModeChange(mode: "serial" | "wifi") {
    if (mode === connectionMode) return
    if (connectionMode === "serial") {
      void disconnectSerial()
    }
    setConnectionMode(mode)
    setIsConnected(false)
    appendLog(`🔄 已切換模式：${mode === "serial" ? "USB Serial" : "Wi-Fi"}`)
  }

  async function connectSerial() {
    try {
      await disconnectSerial()

      if (!("serial" in navigator)) {
        throw new Error("目前瀏覽器不支援 Web Serial")
      }

      const port = await (navigator as any).serial.requestPort()
      await port.open({ baudRate: 9600 })

      portRef.current = port
      writerRef.current = port.writable.getWriter()
      readerRef.current = port.readable.getReader()

      readSerial()
      setIsConnected(true)
      appendLog("✅ Connected to IOT!")
      toast.success("已成功連接 IOT！")
    } catch (err) {
      setIsConnected(false)
      appendLog("❌ Connection failed: " + (err instanceof Error ? err.message : String(err)))
      toast.error("連接 IOT 失敗！")
    }
  }

  async function connectWifi() {
    try {
      const res = await fetch("/api/iot", { method: "GET" })
      const data = await res.json()

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "IOT 連線檢查失敗")
      }

      setIsConnected(true)
      appendLog("✅ Connected to IOT (Wi-Fi)!")
      toast.success("已成功連接 IOT（Wi-Fi）！")
    } catch (err) {
      setIsConnected(false)
      appendLog("❌ Wi-Fi connection failed: " + (err instanceof Error ? err.message : String(err)))
      toast.error("連接 IOT（Wi-Fi）失敗！")
    }
  }

  async function connectIot() {
    if (connectionMode === "serial") {
      await connectSerial()
      return
    }
    await connectWifi()
  }

  async function sendCommand(cmd: string) {
    if (!isConnected) {
      appendLog("❌ Not connected!")
      return
    }

    if (connectionMode === "serial") {
      if (!writerRef.current) {
        appendLog("❌ Not connected!")
        return
      }

      try {
        const data = new TextEncoder().encode(cmd + "\n")
        await writerRef.current.write(data)
        appendLog(`✅ 已送出指令：${cmd}`)
        const expectedAck = expectedAckByCommand[cmd]
        if (expectedAck) {
          pendingAckQueueRef.current.push(expectedAck)
        }
      } catch (err) {
        appendLog("❌ Send error: " + (err instanceof Error ? err.message : String(err)))
      }
      return
    }

    try {
      const res = await fetch("/api/iot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd }),
      })

      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "傳送指令失敗")
      }
      appendLog(`✅ 已送出指令：${cmd}`)
    } catch (err) {
      appendLog("❌ Send error: " + (err instanceof Error ? err.message : String(err)))
    }
  }

  useEffect(() => {
    return () => {
      void disconnectSerial()
    }
  }, [])

  function shouldSuppressDeviceLog(rawText: string) {
    const expectedAck = pendingAckQueueRef.current[0]
    if (!expectedAck) return false

    const normalized = rawText.trim().toUpperCase()
    if (normalized === expectedAck) {
      pendingAckQueueRef.current.shift()
      return true
    }

    return false
  }

  // 顯示按鈕提示
  function handleButtonClick(type: string, cmd: string) {
    appendLog(`已通知住戶：${type}`);
    sendCommand(cmd);
  }

  async function readSerial() {
    if (!readerRef.current) return

    while (true) {
      try {
        const { value, done } = await readerRef.current.read()
        if (done) break

        const text = new TextDecoder().decode(value)
        const messages = text
          .split(/\r?\n/)
          .map((msg) => msg.trim())
          .filter(Boolean)

        messages.forEach((message) => {
          if (shouldSuppressDeviceLog(message)) return
          appendLog("📥 IOT: " + message)
        })
      } catch (err) {
        appendLog("❌ Read error: " + (err instanceof Error ? err.message : String(err)))
        break
      }
    }
  }

  return (
    <div
      className="space-y-4 p-4 rounded-lg border"
      style={{
        background: 'var(--theme-bg-card)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text-primary)',
      }}
    >
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🤖</span> IOT 控制台
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleModeChange("serial")}
          className="px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          style={{
            background: connectionMode === "serial" ? 'var(--theme-accent)' : 'var(--theme-bg-secondary)',
            color: connectionMode === "serial" ? 'var(--theme-accent-foreground)' : 'var(--theme-text-primary)',
          }}
        >
          USB Serial
        </button>
        <button
          onClick={() => handleModeChange("wifi")}
          className="px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          style={{
            background: connectionMode === "wifi" ? 'var(--theme-accent)' : 'var(--theme-bg-secondary)',
            color: connectionMode === "wifi" ? 'var(--theme-accent-foreground)' : 'var(--theme-text-primary)',
          }}
        >
          Wi-Fi
        </button>
      </div>

      <button
        onClick={connectIot}
        className="w-full sm:w-auto px-6 py-2 rounded-lg font-semibold transition-colors"
        style={{
          background: 'var(--theme-accent)',
          color: 'var(--theme-accent-foreground)',
        }}
      >
        🔌 連接 IOT（{connectionMode === "serial" ? "USB" : "Wi-Fi"}）
      </button>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={() => handleButtonClick("訪客", "V")}
          className="px-4 py-2 rounded-lg transition-colors text-sm"
          style={{
            background: 'var(--theme-bg-secondary)',
            color: 'var(--theme-text-primary)',
          }}
        >
          🔔 訪客
        </button>
        <button
          onClick={() => handleButtonClick("包裹", "P")}
          className="px-4 py-2 rounded-lg transition-colors text-sm"
          style={{
            background: 'var(--theme-bg-secondary)',
            color: 'var(--theme-text-primary)',
          }}
        >
          📦 包裹
        </button>
        <button
          onClick={() => handleButtonClick("緊急事件", "E")}
          className="px-4 py-2 rounded-lg transition-colors text-sm"
          style={{
            background: 'var(--theme-danger)',
            color: 'var(--theme-bg-card)',
          }}
        >
          🚨 緊急事件
        </button>
        <button
          onClick={() => handleButtonClick("緊急取消", "C")}
          className="px-4 py-2 rounded-lg transition-colors text-sm"
          style={{
            background: 'var(--theme-accent-hover)',
            color: 'var(--theme-bg-card)',
          }}
        >
          🛑 緊急取消
        </button>
      </div>

      {/* 三欄分類表格顯示 log */}
      <div style={{ marginTop: "16px" }}>
        {(() => {
          const { visitorLogs, packageLogs, emergencyLogs, maxRows } = parseLogs(log);
          return (
            <table
              width="100%"
              border={1}
              style={{
                borderCollapse: "collapse",
                textAlign: "center",
                background: 'var(--theme-bg-card)',
                color: 'var(--theme-text-primary)',
                fontFamily: "monospace"
              }}
            >
              <thead>
                <tr style={{ background: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}>
                  <th style={{ width: "30%" }}>訪客</th>
                  <th style={{ width: "20%" }}>包裹</th>
                  <th style={{ width: "50%", color: 'var(--theme-danger)' }}>緊急</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(maxRows)].map((_, i) => (
                  <tr key={i} style={{ background: 'var(--theme-bg-card)', color: 'var(--theme-text-primary)' }}>
                    <td style={{ verticalAlign: "top", padding: "6px" }}>{visitorLogs[i] || ""}</td>
                    <td style={{ verticalAlign: "top", padding: "6px" }}>{packageLogs[i] || ""}</td>
                    <td
                      style={{
                        verticalAlign: "top",
                        padding: "6px",
                        background: emergencyLogs[i] ? 'var(--theme-danger)' : 'var(--theme-bg-card)',
                        color: emergencyLogs[i] ? 'var(--theme-bg-card)' : 'var(--theme-text-primary)',
                      }}
                    >
                      {emergencyLogs[i] || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()}
      </div>

      <button
        onClick={() => setLog("")}
        className="w-full px-4 py-2 rounded-lg transition-colors text-sm"
        style={{
          background: 'var(--theme-bg-secondary)',
          color: 'var(--theme-text-primary)',
        }}
      >
        🗑️ 清除日誌
      </button>
    </div>
  )
}
