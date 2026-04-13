"use client";
import { useState, useEffect } from "react";

type AdminEventRow = {
  event_type?: "visitor" | "package" | "emergency" | string;
  time_created?: string;
  message?: string;
  unit?: string;
};

export default function AdminPage() {
  const [events, setEvents] = useState<AdminEventRow[]>([]);

  async function loadEvents() {
    const res = await fetch("/api/events/list");
    const data = await res.json();
    setEvents(data);
  }

  useEffect(() => {
    loadEvents();
    const id = setInterval(loadEvents, 1500);
    return () => clearInterval(id);
  }, []);

  // 依類型分組
  const visitorEvents = events.filter(e => e.event_type === "visitor");
  const packageEvents = events.filter(e => e.event_type === "package");
  const emergencyEvents = events.filter(e => e.event_type === "emergency");

  // 取最大長度，讓表格對齊
  const maxRows = Math.max(visitorEvents.length, packageEvents.length, emergencyEvents.length);

  return (
    <div style={{ padding: "20px" }}>
      <h1>事件管理後台（分類表格）</h1>
      <table width="100%" border={1} style={{ marginTop: "20px", borderCollapse: "collapse", textAlign: "center" }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ width: "33%" }}>
              Visitor<br />訪客記錄
            </th>
            <th style={{ width: "33%" }}>
              Package<br />包裹記錄
            </th>
            <th style={{ width: "33%", color: "red" }}>
              Emergency<br />緊急記錄（紅色）
            </th>
          </tr>
        </thead>
        <tbody>
          {[...Array(maxRows)].map((_, i) => (
            <tr key={i}>
              {/* Visitor */}
              <td style={{ verticalAlign: "top", padding: "8px" }}>
                {visitorEvents[i] ? (
                  <>
                    <span style={{ color: "#b8860b", fontWeight: "bold" }}>{new Date(visitorEvents[i].time_created || "").toLocaleString()}</span><br />
                    {visitorEvents[i].message}<br />
                    {visitorEvents[i].unit && (
                      <span style={{ color: "purple" }}>for Unit {visitorEvents[i].unit}</span>
                    )}
                  </>
                ) : ""}
              </td>
              {/* Package */}
              <td style={{ verticalAlign: "top", padding: "8px" }}>
                {packageEvents[i] ? (
                  <>
                    <span style={{ color: "#b8860b", fontWeight: "bold" }}>{new Date(packageEvents[i].time_created || "").toLocaleString()}</span><br />
                    {packageEvents[i].message}<br />
                    {packageEvents[i].unit && (
                      <span style={{ color: "orange" }}>to Unit {packageEvents[i].unit}</span>
                    )}
                  </>
                ) : ""}
              </td>
              {/* Emergency */}
              <td style={{ verticalAlign: "top", padding: "8px", background: emergencyEvents[i] ? "#ffcccc" : undefined }}>
                {emergencyEvents[i] ? (
                  <>
                    <span style={{ color: "red", fontWeight: "bold" }}>{new Date(emergencyEvents[i].time_created || "").toLocaleString()}</span><br />
                    {emergencyEvents[i].message}<br />
                    {emergencyEvents[i].unit && (
                      <span style={{ color: "purple" }}>by Unit {emergencyEvents[i].unit}</span>
                    )}
                  </>
                ) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
