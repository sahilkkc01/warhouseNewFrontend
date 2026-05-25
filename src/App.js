import React, { useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import "./App.css";
import { MapModal, MapAreaModal } from "./maps/MapModal";

const socket = io("http://localhost:5010");
const BASE = "http://localhost:5010";

/* ─────────────────── Design Tokens ─────────────────── */
const C = {
  navy:      "#0f172a",
  navyMid:   "#1e293b",
  slate:     "#334155",
  muted:     "#64748b",
  subtle:    "#94a3b8",
  border:    "#e2e8f0",
  bg:        "#f1f5f9",
  bgCard:    "#ffffff",
  blue:      "#2563eb",
  blueSoft:  "#eff6ff",
  green:     "#16a34a",
  greenSoft: "#f0fdf4",
  amber:     "#d97706",
  amberSoft: "#fffbeb",
  red:       "#dc2626",
  redSoft:   "#fef2f2",
  cyan:      "#0891b2",
  purple:    "#7c3aed",
};

/* ─────────────────── Base Styles ─────────────────── */
const S = {
  th: {
    padding: "11px 14px", textAlign: "left", fontWeight: 700,
    fontSize: 11, textTransform: "uppercase", letterSpacing: ".07em",
    color: "#cbd5e1", background: C.navy, borderBottom: `2px solid ${C.slate}`,
  },
  td: {
    padding: "11px 14px", fontSize: 13, verticalAlign: "middle",
    color: C.navyMid, borderBottom: `1px solid ${C.border}`,
  },
  btn: (bg, size = "md") => ({
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: size === "sm" ? "5px 11px" : size === "lg" ? "10px 22px" : "8px 15px",
    border: "none", background: bg, color: "#fff", cursor: "pointer",
    borderRadius: 8, fontWeight: 600, fontSize: size === "sm" ? 11 : 13,
    transition: "opacity .15s", whiteSpace: "nowrap",
  }),
  badge: (bg, fg = "#fff") => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 9px", borderRadius: 20,
    fontSize: 11, fontWeight: 700, background: bg, color: fg, whiteSpace: "nowrap",
  }),
  card: {
    background: C.bgCard, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "14px 18px",
  },
  sectionTitle: {
    fontSize: 13, fontWeight: 800, color: C.navy, margin: "24px 0 12px",
    display: "flex", alignItems: "center", gap: 8,
    paddingBottom: 10, borderBottom: `2px solid ${C.border}`,
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(15,23,42,.65)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 16, backdropFilter: "blur(4px)",
  },
  modalBox: {
    width: "100%", maxWidth: 1100, maxHeight: "92vh",
    overflowY: "auto", background: C.bg,
    borderRadius: 16, boxShadow: "0 32px 80px rgba(0,0,0,.4)",
    display: "flex", flexDirection: "column",
  },
};

/* ─────────────────── Helpers ─────────────────── */
const parseSBList = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return []; } }
  if (typeof raw === "object") return [raw];
  return [];
};

const parseGrid = (raw) => {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
};

const autoDistribute = (total, truckNos) => {
  const init = {};
  if (truckNos.length > 0 && total > 0) {
    const base = Math.floor(total / truckNos.length);
    const rem  = total % truckNos.length;
    truckNos.forEach((t, i) => { init[t] = base + (i === truckNos.length - 1 ? rem : 0); });
  } else {
    truckNos.forEach((t) => { init[t] = 0; });
  }
  return init;
};

/* ─────────────────── Small Components ─────────────────── */
const Badge = ({ bg, fg, children }) => <span style={S.badge(bg, fg)}>{children}</span>;

const Btn = ({ bg, size, onClick, disabled, children, style = {} }) => (
  <button
    onClick={onClick} disabled={disabled}
    style={{ ...S.btn(bg, size), opacity: disabled ? .5 : 1, ...style }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = ".82"; }}
    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
  >
    {children}
  </button>
);

const InfoRow = ({ label, value, accent }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <span style={{ fontSize: 10, fontWeight: 700, color: C.subtle, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: accent || C.navy, wordBreak: "break-word" }}>{String(value ?? "—")}</span>
  </div>
);

/* ─────────────────── TallySheetModal ─────────────────── */
function TallySheetModal({ crn, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData]       = useState(null);
  const [error, setError]     = useState("");
  const printRef              = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${BASE}/api/tally-sheet?crn=${crn}`);
        if (!r.data?.success) throw new Error(r.data?.message || "Failed");
        setData(r.data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [crn]);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Tally Sheet - ${crn}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; padding: 20px; }
        .tally-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .tally-header .title { text-align: center; flex: 1; }
        .tally-header .title h2 { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
        .tally-header .title p { font-size: 11px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 16px; }
        .meta-row { display: flex; gap: 6px; font-size: 11px; }
        .meta-label { color: #555; min-width: 160px; }
        .meta-value { font-weight: bold; color: #000; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #1e293b; color: #fff; padding: 7px 8px; text-align: left; font-size: 10px; font-weight: bold; border: 1px solid #334155; }
        td { padding: 6px 8px; font-size: 10px; border: 1px solid #ccc; vertical-align: middle; }
        .total-row td { font-weight: bold; background: #f0f0f0; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; }
        .remarks { margin-top: 16px; font-size: 11px; }
        @media print { body { padding: 10px; } button { display: none; } }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const handleDownload = () => {
    if (!data) return;
    const { carting_data, shipping_bill_rows, crn: crnVal, gross_weight } = data;
    const shippingBills = parseSBList(carting_data?.shipping_bill_details_list);

    // Build CSV
    const header = ["S.No", "Truck Number", "SBill", "Pkg Code", "Cargo Description", "No of Pkgs", "Pkg Weight (KG)", "Grid Locations", "Area (SQM)", "Handling Type", "Start Time", "End Time", "Warehouse", "Location Code"];
    const realRows = (shipping_bill_rows || []).filter(r => r.WAREHOUSE);
    const rows = realRows.map((r, i) => {
      const sbData = shippingBills.find(s => String(s.shipping_bill_number) === String(r.SHIPPING_BILL_NO)) || {};
      const grids = parseGrid(r.GRID);
      return [
        i + 1,
        r.TRUCK_NO || "",
        r.SHIPPING_BILL_NO || "",
        sbData.package_type || "",
        sbData.commodity_description || "",
        r.NO_OF_PACKAGES || 0,
        r.PACKAGES_WEIGHT || 0,
        grids.join("; "),
        r.AREA || grids.length,
        r.HANDLING_TYPE || "",
        (r.START_TIME || "").replace("T", " "),
        (r.END_TIME || "").replace("T", " "),
        r.WAREHOUSE || "",
        r.LOCATION_CODE || "",
      ];
    });

    const totalPkgs = rows.reduce((s, r) => s + Number(r[5] || 0), 0);
    const totalArea = rows.reduce((s, r) => s + Number(r[8] || 0), 0);
    rows.push(["Total", "", "", "", "", totalPkgs, `${Number(gross_weight || 0).toFixed(2)} Tons`, "", totalArea, "", "", "", "", ""]);

    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `Tally_Sheet_${crnVal}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Tally Content renderer ── */
  const renderTallyContent = () => {
    if (!data) return null;
    const { carting_data, shipping_bill_rows, crn: crnVal, gross_weight, created_at } = data;
    const shippingBills  = parseSBList(carting_data?.shipping_bill_details_list);
    const sbNos          = [...new Set((shipping_bill_rows || []).map(r => r.SHIPPING_BILL_NO))];

    // Summary header fields (match PDF layout)
    const firstSB        = shippingBills[0] || {};
    const allTrucks      = [...new Set((shipping_bill_rows || []).map(r => r.TRUCK_NO).filter(Boolean))];
    const firstRow       = (shipping_bill_rows || []).find(r => r.WAREHOUSE) || {};
    const startTime      = firstRow.START_TIME ? firstRow.START_TIME.replace("T", " ") : "-";
    const endTime        = firstRow.END_TIME   ? firstRow.END_TIME.replace("T", " ")   : "-";
    const handlingType   = firstRow.HANDLING_TYPE || "-";
    const warehouseName  = firstRow.WAREHOUSE ? `${firstRow.WAREHOUSE} Warehouse` : "-";
    const exporter       = carting_data?.exporter_name || carting_data?.Exporter_Name || "-";
    const containerNo    = carting_data?.Container_details?.container_number || "-";
    const containerSize  = carting_data?.Container_details?.container_size   || "-";
    const containerType  = carting_data?.Container_details?.container_type   || "-";
    const gwPortCode     = carting_data?.gw_port_code || carting_data?.GW_Port_Code || "-";
    const chaCode        = carting_data?.cha_code     || carting_data?.CHA_Code     || "-";
    const slineCode      = carting_data?.sline_code   || carting_data?.Sline_Code   || "-";

    // All real grid rows (have WAREHOUSE)
    const realRows = (shipping_bill_rows || []).filter(r => r.WAREHOUSE);
    const totalPkgs = realRows.reduce((s, r) => s + Number(r.NO_OF_PACKAGES || 0), 0);
    const totalArea = realRows.reduce((s, r) => s + Number(r.AREA || parseGrid(r.GRID).length), 0);

    // Build a serial number counter for the tally (match PDF – one row per shipping bill per truck)
    // Aggregate by truck+SB for the table rows (combine multiple grid locations per truck+SB)
    const aggregated = [];
    const seen = new Set();
    for (const sbNo of sbNos) {
      const trucks = [...new Set(realRows.filter(r => r.SHIPPING_BILL_NO === sbNo).map(r => r.TRUCK_NO))];
      for (const truckNo of trucks) {
        const key = `${sbNo}__${truckNo}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const rowsForCombo = realRows.filter(r => r.SHIPPING_BILL_NO === sbNo && r.TRUCK_NO === truckNo);
        const sbData       = shippingBills.find(s => String(s.shipping_bill_number) === String(sbNo)) || {};
        const pkgs         = rowsForCombo.reduce((s, r) => s + Number(r.NO_OF_PACKAGES || 0), 0);
        const pkgWt        = rowsForCombo.reduce((s, r) => s + Number(r.PACKAGES_WEIGHT || 0), 0);
        const area         = rowsForCombo.reduce((s, r) => s + Number(r.AREA || parseGrid(r.GRID).length), 0);
        const allGrids     = rowsForCombo.flatMap(r => parseGrid(r.GRID).map(g => `${r.LOCATION_CODE || r.WAREHOUSE}${g}`));
        // Combine warehouse names for display
        const warehouses   = [...new Set(rowsForCombo.map(r => r.WAREHOUSE).filter(Boolean))].join(", ");
        const locs         = [...new Set(rowsForCombo.map(r => r.LOCATION_CODE).filter(Boolean))].join(", ");
        aggregated.push({ sbNo, truckNo, sbData, pkgs, pkgWt, area, allGrids, warehouses, locs, rowsForCombo });
      }
    }

    return (
      <div ref={printRef} className="tally-print-content">
        {/* Header */}
        <div className="tally-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, borderBottom: "2px solid #e2e8f0", paddingBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>S.No: <strong>{data.id || "—"}</strong></div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Date: <strong>{created_at ? created_at.split("T")[0].split("-").reverse().join("/") : new Date().toLocaleDateString("en-IN")}</strong></div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Cargo Handling Operator</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Container Carting Tally Sheet</div>
          </div>
          <div style={{ width: 80 }} />
        </div>

        {/* Meta Info Grid - 2 columns matching PDF */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 32px", marginBottom: 20 }}>
          {[
            ["Sbill Number", sbNos.join(", ") || "—"],
            ["Total No Of Trucks", allTrucks.length || "—"],
            ["CRN Number", crnVal],
            ["Sline Code", slineCode],
            ["Container Number", containerNo],
            ["Declared Gross Weight", `${Number(gross_weight || 0).toFixed(3)}`],
            ["Container Size", containerSize],
            ["Warehouse Name", warehouseName],
            ["Type", containerType || "FCL"],
            ["Start Date & Time", startTime],
            ["GW Port Code", gwPortCode],
            ["End Date & Time", endTime],
            ["Cha Code", chaCode],
            ["Excess / Short Packages", "0"],
            ["Total No. of Packages Declared", String(shippingBills.reduce((s, x) => s + Number(x.no_of_packages_declared || 0), 0))],
            ["Exporter Name", exporter],
            ["Handling Type", handlingType],
            ["", ""],
          ].map(([label, value], i) => (
            <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, padding: "3px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ color: "#64748b", minWidth: 170, flexShrink: 0 }}>{label}</span>
              {label && <span style={{ color: "#334155" }}>:</span>}
              <span style={{ fontWeight: label ? 600 : 400, color: "#0f172a" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Table - matches PDF layout exactly */}
        <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr>
                {["Truck Number", "SBill", "Pkg Code", "Cargo Description (Code)", "No of Pkgs", "Pkg Weight", "Grid Locations", "Area (SQM)"].map(h => (
                  <th key={h} style={{
                    background: "#1e293b", color: "#fff", padding: "9px 10px",
                    textAlign: "left", fontSize: 11, fontWeight: 700,
                    border: "1px solid #334155", whiteSpace: "nowrap"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aggregated.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 13 }}>No grid allocations found</td></tr>
              ) : (
                aggregated.map((row, i) => {
                  console.log(row);
                  const gridsDisplay = row.rowsForCombo.map(r => {
                    const grids = parseGrid(r.GRID);
                    return `${r.LOCATION_CODE || r.WAREHOUSE}${grids.length ? `: ${grids.join(",")}` : ""}`;
                  }).join(" | ");
                  const locShort = row.rowsForCombo.map(r => r.LOCATION_CODE || r.WAREHOUSE).filter(Boolean).join(", ");

                  return (
                    <tr key={i} style={{ background: i % 2 ? "#fafbfc" : "#fff" }}>
                      <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, border: "1px solid #e2e8f0", color: "#0f172a" }}>{row.truckNo}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, border: "1px solid #e2e8f0", color: "#2563eb", fontWeight: 700, fontFamily: "monospace" }}>{row.sbNo}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, border: "1px solid #e2e8f0", color: "#64748b" }}>{row.sbData.package_type || ""}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, border: "1px solid #e2e8f0", color: "#334155" }}>{row.sbData.commodity_description || ""}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, border: "1px solid #e2e8f0", textAlign: "center", fontWeight: 700, color: "#0f172a" }}>{row.pkgs}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, border: "1px solid #e2e8f0", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>{Number(row.sbData.package_weight).toFixed(5)}</td>
                      <td style={{ padding: "8px 10px", fontSize: 11, border: "1px solid #e2e8f0", color: "#7c3aed" }}>{locShort},</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, border: "1px solid #e2e8f0", textAlign: "center", color: "#334155" }}>{row.area},</td>
                    </tr>
                  );
                })
              )}

              {/* Empty filler rows like PDF */}
              {Array.from({ length: Math.max(0, 8 - aggregated.length) }).map((_, i) => (
                <tr key={`empty-${i}`} style={{ height: 32 }}>
                  {Array(8).fill(null).map((_, j) => (
                    <td key={j} style={{ border: "1px solid #e2e8f0", padding: "8px 10px" }}>&nbsp;</td>
                  ))}
                </tr>
              ))}

              {/* Total Row */}
              <tr style={{ background: "#f8fafc" }}>
                <td style={{ padding: "9px 10px", fontWeight: 800, fontSize: 12, border: "1px solid #e2e8f0", color: "#0f172a" }}>Total</td>
                <td style={{ border: "1px solid #e2e8f0" }} />
                <td style={{ border: "1px solid #e2e8f0" }} />
                <td style={{ border: "1px solid #e2e8f0" }} />
                <td style={{ padding: "9px 10px", fontWeight: 800, fontSize: 13, border: "1px solid #e2e8f0", textAlign: "center", color: "#0f172a" }}>{totalPkgs}</td>
                <td style={{ padding: "9px 10px", fontWeight: 800, fontSize: 12, border: "1px solid #e2e8f0", textAlign: "right", color: "#0f172a" }}>{Number(gross_weight || 0).toFixed(2)} Tons</td>
                <td style={{ border: "1px solid #e2e8f0" }} />
                <td style={{ padding: "9px 10px", fontWeight: 800, fontSize: 12, border: "1px solid #e2e8f0", textAlign: "center", color: "#0f172a" }}>{totalArea}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Remarks */}
        <div style={{ marginTop: 18, fontSize: 12, color: "#334155", fontWeight: 600 }}>
          Remarks :
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 60, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 11, color: "#64748b", maxWidth: 340, lineHeight: 1.6 }}>
            Said to contain received cargo in sound condition and to my entire satisfaction.
          </div>
          <div style={{ textAlign: "right", fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>Tallied By</div>
            <div style={{ color: "#94a3b8", marginTop: 4 }}>--</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ ...S.overlay, zIndex: 3000 }}>
      <div style={{
        width: "100%", maxWidth: 1080, maxHeight: "95vh",
        background: "#fff", borderRadius: 16,
        boxShadow: "0 32px 80px rgba(0,0,0,.45)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Modal header */}
        <div style={{
          background: C.navy, padding: "14px 22px",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🧾</span>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Container Carting Tally Sheet</div>
              <div style={{ color: C.subtle, fontSize: 12, marginTop: 1 }}>
                CRN: <span style={{ color: "#60a5fa", fontFamily: "monospace", fontWeight: 700 }}>{crn}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!loading && !error && (
              <>
                <Btn bg={C.blue} size="sm" onClick={handlePrint}>🖨 Print</Btn>
                {/* <Btn bg={C.green} size="sm" onClick={handleDownload}>⬇ Download CSV</Btn> */}
              </>
            )}
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,.12)", border: "none",
              color: "#fff", width: 32, height: 32, borderRadius: 8,
              cursor: "pointer", fontSize: 16, fontWeight: 700, marginLeft: 4,
            }}>✕</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", padding: "22px 28px 32px", flex: 1, background: "#fff" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
              <div style={{ fontWeight: 600 }}>Loading tally sheet…</div>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: 60, color: C.red }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontWeight: 600 }}>{error}</div>
            </div>
          ) : renderTallyContent()}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── FinishModal ─────────────────── */
function FinishModal({ sbNo, trucksForSb, grossWeight, declaredPackages, existingRows, isModify, jobCreatedAt, crn, onDone, onCancel }) {
  const firstRow = existingRows?.[0] || {};
  const [handlingType, setHandlingType] = useState(firstRow.HANDLING_TYPE || "");
  const [startTime,    setStartTime]    = useState(firstRow.START_TIME    || "");
  const [endTime,      setEndTime]      = useState(firstRow.END_TIME      || "");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");

  const [gridPkgs, setGridPkgs] = useState(() => {
    const init = {};
    const rows = existingRows.filter((r) => r.WAREHOUSE);
    if (!rows.length) return init;
    const hasExistingValues = rows.some((r) => Number(r.NO_OF_PACKAGES || 0) > 0);
    if (hasExistingValues) {
      rows.forEach((r) => { init[r.ID] = Number(r.NO_OF_PACKAGES || 0); });
      return init;
    }
    const base = Math.floor(declaredPackages / rows.length);
    const rem  = declaredPackages % rows.length;
    rows.forEach((r, i) => { init[r.ID] = base + (i === rows.length - 1 ? rem : 0); });
    return init;
  });

  const totalPackages = Object.values(gridPkgs).reduce((s, v) => s + Number(v || 0), 0);
  const unitWeight    = totalPackages > 0 ? grossWeight / totalPackages : 0;
  const remaining     = declaredPackages - totalPackages;
  const isOver        = totalPackages > declaredPackages;
  const isExact       = totalPackages === declaredPackages;
  const minStart      = jobCreatedAt || "";

  const validate = () => {
    if (!handlingType)                    { setError("Please select Handling Type");                                           return false; }
    if (!startTime)                       { setError("Please enter Start Time");                                               return false; }
    if (!endTime)                         { setError("Please enter End Time");                                                 return false; }
    if (totalPackages <= 0)               { setError("Enter package count for at least one truck");                            return false; }
    if (totalPackages > declaredPackages) { setError(`Total packages cannot exceed declared (${declaredPackages})`);           return false; }
    if (minStart && startTime < minStart) { setError(`Start time cannot be before shipping bill date (${minStart.replace("T"," ")})`); return false; }
    if (endTime <= startTime)             { setError("End time must be after start time");                                     return false; }
    return true;
  };

  const handleSubmit = async () => {
    setError("");
    if (!validate()) return;
    setSaving(true);
    const gridPackagesArr = existingRows
      .filter((r) => r.WAREHOUSE)
      .map((r) => ({ row_id: r.ID, truck_no: r.TRUCK_NO, no_of_packages: Number(gridPkgs[r.ID] || 0) }));
    try {
      const endpoint = isModify ? "/api/final-modify-shipping-bill" : "/api/finish-shipping-bill";
      const r = await axios.post(`${BASE}${endpoint}`, {
        crn, shipping_bill_no: sbNo,
        handling_type: handlingType, start_time: startTime, end_time: endTime,
        grid_packages: gridPackagesArr,
      });
      if (!r.data?.success) { setError(r.data?.message || "Unknown error"); return; }
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...S.overlay, zIndex: 2000 }}>
      <div style={{ background: C.bgCard, borderRadius: 16, width: "100%", maxWidth: 540, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 72px rgba(0,0,0,.4)" }}>
        <div style={{ background: isModify ? C.amber : C.green, padding: "16px 22px", borderRadius: "16px 16px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{isModify ? "✏️ Modify Final Record" : "✅ Finish Job"}</div>
            <div style={{ color: "rgba(255,255,255,.8)", fontSize: 12, marginTop: 2 }}>Shipping Bill #{sbNo}</div>
          </div>
          <button onClick={onCancel} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>✕</button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {minStart && (
            <div style={{ background: C.blueSoft, border: "1px solid #bfdbfe", borderRadius: 9, padding: "9px 13px", fontSize: 12, color: C.blue, display: "flex", alignItems: "center", gap: 8 }}>
              ℹ️ <span>Job started at <strong>{minStart.replace("T", " ")}</strong></span>
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>
              Handling Type <span style={{ color: C.red }}>*</span>
            </label>
            <select value={handlingType} onChange={(e) => { setHandlingType(e.target.value); setError(""); }}
              style={{ width: "100%", padding: "9px 13px", borderRadius: 8, border: `1.5px solid ${handlingType ? C.green : C.border}`, fontSize: 13, color: C.navy, background: handlingType ? C.greenSoft : "#fff", outline: "none" }}>
              <option value="">— Select Handling Type —</option>
              <option value="LCH">LCH</option>
              <option value="MCH">MCH</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Start Time", startTime, setStartTime, minStart], ["End Time", endTime, setEndTime, startTime || minStart]].map(([label, val, setter, min]) => (
              <div key={label}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  {label} <span style={{ color: C.red }}>*</span>
                </label>
                <input type="datetime-local" value={val} min={min}
                  onChange={(e) => { setter(e.target.value); setError(""); }}
                  style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1.5px solid ${val ? C.blue : C.border}`, fontSize: 13, boxSizing: "border-box", color: C.navy, background: val ? C.blueSoft : "#fff", outline: "none" }}
                />
              </div>
            ))}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>
                Packages per Grid<span style={{ color: C.red }}>*</span>
              </label>
            </div>

            <div style={{ background: C.border, borderRadius: 99, height: 5, marginBottom: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 99, width: `${Math.min(100, (totalPackages / declaredPackages) * 100)}%`, background: isOver ? C.red : isExact ? C.green : C.blue, transition: "width .3s, background .3s" }} />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {[
                { label: `Assigned: ${totalPackages}`, color: isExact ? C.green : isOver ? C.red : C.blue, bg: isExact ? C.greenSoft : isOver ? C.redSoft : C.blueSoft, border: isExact ? "#bbf7d0" : isOver ? "#fecaca" : "#bfdbfe" },
                { label: `Declared: ${declaredPackages}`, color: C.muted, bg: "#f8fafc", border: C.border },
                { label: `Remaining: ${remaining}`, color: remaining < 0 ? C.red : remaining === 0 ? C.green : C.amber, bg: "#f8fafc", border: C.border },
                { label: `Gross Wt: ${Number(grossWeight || 0).toFixed(2)} Tons`, color: C.muted, bg: "#f8fafc", border: C.border },
              ].map((chip) => (
                <div key={chip.label} style={{ background: chip.bg, border: `1px solid ${chip.border}`, borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 700, color: chip.color }}>{chip.label}</div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {trucksForSb.map((truckNo) => {
                const rows = existingRows.filter((r) => r.TRUCK_NO === truckNo && r.WAREHOUSE);
                return (
                  <div key={truckNo} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, background: "#fff" }}>
                    <div style={{ fontWeight: 800, color: C.navy, marginBottom: 10 }}>🚛 {truckNo}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {rows.map((row) => {
                        const pkgs   = Number(gridPkgs[row.ID] || 0);
                        const weight = Number((pkgs * unitWeight).toFixed(2));
                        return (
                          <div key={row.ID} style={{ display: "grid", gridTemplateColumns: "1fr 110px 100px", gap: 10, alignItems: "center", background: C.bg, borderRadius: 8, padding: 10 }}>
                            <div>
                              <div style={{ fontWeight: 700, color: C.navy }}>📍 {row.WAREHOUSE} / {row.LOCATION_CODE}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Area: {row.AREA || parseGrid(row.GRID).length} SQM</div>
                            </div>
                            <input type="number" min={0} value={gridPkgs[row.ID] ?? ""}
                              onChange={(e) => { setGridPkgs((p) => ({ ...p, [row.ID]: Math.max(0, Number(e.target.value) || 0) })); setError(""); }}
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 14, fontWeight: 700, textAlign: "center" }}
                            />
                            <div style={{ fontWeight: 700, color: C.green, textAlign: "right", fontSize: 13 }}>{weight} Tons</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div style={{ padding: "9px 13px", background: C.redSoft, border: "1px solid #fecaca", borderRadius: 8, color: C.red, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Btn bg={C.muted} onClick={onCancel}>Cancel</Btn>
            <Btn bg={isModify ? C.amber : C.green} onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving…" : isModify ? "💾 Save Changes" : "✅ Confirm Finish"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
export default function App() {
  const [gateData,    setGateData]    = useState([]);
  const [loadingCrn,  setLoadingCrn]  = useState("");
  const [modalOpen,   setModalOpen]   = useState(false);
  const [cartingData, setCartingData] = useState(null);

  const [trucks,          setTrucks]          = useState([]);
  const [truckBillChecks, setTruckBillChecks] = useState({});
  const [mappingSaved,    setMappingSaved]    = useState(false);
  const [gridRows,        setGridRows]        = useState([]);
  const [comboWarehouse,  setComboWarehouse]  = useState({});
  const [liveStarted,     setLiveStarted]     = useState({});
  const [mapVisible,      setMapVisible]      = useState(false);
  const [areaVisible,     setAreaVisible]     = useState(false);
  const [mapName,         setMapName]         = useState("Export");
  const [activeGridSel,   setActiveGridSel]   = useState(null);
  const [pendingGrids,    setPendingGrids]    = useState([]);
  const [SelectedGrids,   setSelectedGrids]   = useState({});
  const activeGridCtx = useRef(null);
  const [finishModal,    setFinishModal]    = useState(null);
  const [finalSubmitted, setFinalSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState("ACTIVE");

  /* ── NEW: tally sheet state ── */
  const [tallyModal, setTallyModal] = useState(null); // { crn }

  /* ── socket ── */
  useEffect(() => {
    socket.on("gateTransactions", (res) => {
      if (!res.success) return;
      const grouped = {};
      console.log("Received gate transactions:", res.data);
      res.data.forEach((item) => {
        if (!grouped[item.CONTAINER_NO]) grouped[item.CONTAINER_NO] = { ...item };
        else grouped[item.CONTAINER_NO].VEHICLE_NO += ", " + item.VEHICLE_NO;
      });
      setGateData(Object.values(grouped));
    });
    return () => socket.off("gateTransactions");
  }, []);

  /* ── live update loop ── */
  useEffect(() => {
    if (!modalOpen || !cartingData?.crn) return;
    const crn = cartingData.crn;
    const liveSbNos = Object.entries(liveStarted).filter(([, v]) => v).map(([k]) => k);
    if (!liveSbNos.length) return;
    const interval = setInterval(async () => {
      for (const sbNo of liveSbNos) {
        try {
          await axios.get(`${BASE}/api/live-job-update?crn=${crn}&shipping_bill_no=${sbNo}`);
          await refreshGridRows(crn);
        } catch { }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [modalOpen, cartingData?.crn, liveStarted]);

  const refreshGridRows = async (crn) => {
    try {
      const r = await axios.get(`${BASE}/api/truck-shipping-bills?crn=${crn}`);
      setGridRows(r.data?.gridRows || []);
    } catch { }
  };

  /* ── start carting ── */
  const handleStart = async (crn) => {
    try {
      setLoadingCrn(crn);
      const res = await axios.post(`${BASE}/api/start-carting`, { crn_number: crn });
      alert(res.data.message);
    } catch { alert("API Failed"); }
    finally { setLoadingCrn(""); }
  };

  /* ── view modal ── */
  const handleView = async (crn) => {
    try {
      const [cartRes, truckRes, billRes] = await Promise.all([
        axios.get(`${BASE}/api/carting?crn=${crn}`),
        axios.get(`${BASE}/api/trucks-for-crn?crn=${crn}`),
        axios.get(`${BASE}/api/truck-shipping-bills?crn=${crn}`),
      ]);

      setCartingData({ ...cartRes.data.data.CCLS_CARTING_DATA, crn });
      setTrucks(truckRes.data.trucks || []);

      const rows = billRes.data?.gridRows || [];
      const isFinalSubmitted = rows.some((r) => r.JOB_STATUS === "FINAL_SUBMITTED");
      setFinalSubmitted(isFinalSubmitted);
      setGridRows(rows);

      const hasMappings = rows.length > 0;
      setMappingSaved(hasMappings);

      if (hasMappings) {
        const checks = {};
        rows.forEach((r) => { checks[`${r.TRUCK_NO}||${r.SHIPPING_BILL_NO}`] = true; });
        setTruckBillChecks(checks);
      } else {
        setTruckBillChecks({});
      }

      const liveMap = {};
      rows.forEach((r) => {
        if (r.JOB_STATUS !== "FINISHED" && r.WAREHOUSE) liveMap[r.SHIPPING_BILL_NO] = true;
      });
      setLiveStarted(liveMap);

      setModalOpen(true);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch carting data");
    }
  };

  /* ── save mapping ── */
  const handleSaveMapping = async (crn) => {
    const mappedTruckNos = new Set();
    const mappings = [];
    Object.entries(truckBillChecks).forEach(([key, checked]) => {
      if (!checked) return;
      const [truckNo, sbNo] = key.split("||");
      if (!trucks.some((t) => t.TRUCK_NO === truckNo)) return;
      mappedTruckNos.add(truckNo);
      mappings.push({ truck_no: truckNo, shipping_bill_no: sbNo });
    });
    const unmapped = trucks.filter((t) => !mappedTruckNos.has(t.TRUCK_NO));
    if (unmapped.length > 0) {
      alert(`All trucks must be mapped.\nUnmapped: ${unmapped.map((t) => t.TRUCK_NO).join(", ")}`);
      return;
    }
    if (!mappings.length) { alert("Select at least one truck → SB mapping."); return; }
    try {
      await axios.post(`${BASE}/api/save-shipping-bill-mapping`, { mappings, crn });
      await refreshGridRows(crn);
      setMappingSaved(true);
      alert("Mapping saved!");
    } catch (err) {
      alert("Save failed: " + (err.response?.data?.message || err.message));
    }
  };

  /* ── open grid map ── */
  const openMap = (crn, truckNo, sbNo, existingRow) => {
    activeGridCtx.current = { crn, truckNo, sbNo, rowId: existingRow?.ID ?? null };
    if (existingRow?.WAREHOUSE) {
      setMapName(existingRow.WAREHOUSE);
      setActiveGridSel({ warehouse_name: existingRow.WAREHOUSE, location_code: existingRow.LOCATION_CODE });
      setPendingGrids(parseGrid(existingRow.GRID).map(String));
      setAreaVisible(true);
    } else {
      const wh = comboWarehouse[`${truckNo}||${sbNo}`] || "Export";
      setMapName(wh);
      setActiveGridSel(null);
      setPendingGrids([]);
      setMapVisible(true);
    }
  };

  const handleGridToggle = (area) => {
    setPendingGrids((prev) => prev.includes(String(area)) ? prev.filter((g) => g !== String(area)) : [...prev, String(area)]);
  };

  const handleConfirmGrids = useCallback(async () => {
    const ctx = activeGridCtx.current;
    if (!ctx || !activeGridSel) { setAreaVisible(false); return; }
    const { crn, truckNo, sbNo, rowId } = ctx;
    const warehouse    = activeGridSel.warehouse_name || mapName;
    const locationCode = activeGridSel.location_code;
    const grids        = (pendingGrids || []).map(String);
    try {
      await axios.post(`${BASE}/api/save-grid-allocation`, {
        crn, truck_no: truckNo, shipping_bill_no: sbNo,
        warehouse, location_code: locationCode,
        grids, area: grids.length,
        ...(rowId ? { row_id: rowId } : {}),
      });
      await refreshGridRows(crn);
    } catch (err) {
      alert("Save failed: " + err.message);
    }
    setAreaVisible(false);
    setPendingGrids([]);
    activeGridCtx.current = null;
  }, [activeGridSel, mapName, pendingGrids]);

  useEffect(() => {
    window.handleConfirmGrids = handleConfirmGrids;
    return () => { delete window.handleConfirmGrids; };
  }, [handleConfirmGrids]);

  const removeGridRow = async (rowId) => {
    try {
      await axios.delete(`${BASE}/api/delete-grid-allocation/${rowId}`);
      await refreshGridRows(cartingData?.crn);
    } catch (err) {
      alert("Remove failed: " + err.message);
    }
  };

  /* ── open finish modal ── */
  const openFinishModal = async (sbNo, crn) => {
    const trucksForSb      = [...new Set(gridRows.filter((r) => r.SHIPPING_BILL_NO === sbNo).map((r) => r.TRUCK_NO))];
    const existingRows     = gridRows.filter((r) => r.SHIPPING_BILL_NO === sbNo);
    const isModify         = existingRows.some((r) => r.JOB_STATUS === "FINISHED");
    const grossWeight      = Number(cartingData?.gross_weight || 0);
    const sbDataList       = parseSBList(cartingData?.shipping_bill_details_list);
    const sbData           = sbDataList.find((s) => String(s.shipping_bill_number) === String(sbNo));
    const jobCreatedAt     = sbData?.shipping_bill_date ? sbData.shipping_bill_date.slice(0, 16) : "";
    const declaredPackages = Number(sbData?.no_of_packages_declared || 0);
    setFinishModal({ sbNo, trucksForSb, grossWeight, declaredPackages, existingRows, isModify, jobCreatedAt, crn });
  };
const filteredGateData =
  activeTab === "FINISHED"
    ? gateData.filter((x) => x.IS_FINISHED === 1)
    : gateData.filter((x) => x.IS_FINISHED !== 1);
  /* ══════════════════════════════════ RENDER ══════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Nav */}
      <div style={{ background: C.navy, padding: "0 24px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 30, height: 30, background: C.blue, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📦</div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Sunic Export Carting</span>
          <span style={{ color: C.muted, fontSize: 13 }}>/ Gate Transactions</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
          <span style={{ color: C.subtle, fontSize: 12 }}>Live</span>
        </div>
      </div>

      <div style={{ padding: "22px 22px 40px" }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.navy }}>Gate Transactions</h1>
          <p style={{ margin: "3px 0 0", color: C.muted, fontSize: 13 }}>{gateData.length} active transaction{gateData.length !== 1 ? "s" : ""}</p>
        </div>
<div
  style={{
    display: "flex",
    gap: 10,
    marginBottom: 18,
  }}
>
  <button
    onClick={() => setActiveTab("ACTIVE")}
    style={{
      padding: "9px 18px",
      borderRadius: 10,
      border: "none",
      cursor: "pointer",
      fontWeight: 700,
      background:
        activeTab === "ACTIVE"
          ? C.blue
          : "#e2e8f0",
      color:
        activeTab === "ACTIVE"
          ? "#fff"
          : C.navy,
    }}
  >
    Active
  </button>

  <button
    onClick={() => setActiveTab("FINISHED")}
    style={{
      padding: "9px 18px",
      borderRadius: 10,
      border: "none",
      cursor: "pointer",
      fontWeight: 700,
      background:
        activeTab === "FINISHED"
          ? C.green
          : "#e2e8f0",
      color:
        activeTab === "FINISHED"
          ? "#fff"
          : C.navy,
    }}
  >
    Finished
  </button>
</div>
        <div style={{ background: C.bgCard, borderRadius: 13, boxShadow: "0 2px 14px rgba(0,0,0,.07)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr>{["#", "Gate", "Vehicle No.", "Permit No.", "CRN", "Status", "Action"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredGateData.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...S.td, textAlign: "center", padding: 40, color: C.subtle }}><div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>No active gate transactions</td></tr>
             ) : filteredGateData.map((item, i) => (
                  <tr key={i} style={{ background: i % 2 ? "#fafbfc" : "#fff" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f0f6ff"}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 ? "#fafbfc" : "#fff"}
                  >
                    <td style={{ ...S.td, color: C.muted, fontWeight: 700, width: 36 }}>{i + 1}</td>
                    <td style={S.td}><Badge bg={C.navyMid}>{item.GATE_NO}</Badge></td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{item.VEHICLE_NO}</td>
                    <td style={{ ...S.td, color: C.muted }}>{item.PERMIT_NO}</td>
                    <td style={S.td}><span style={{ fontWeight: 800, color: C.blue, fontFamily: "monospace", fontSize: 13 }}>{item.CONTAINER_NO}</span></td>
                    <td style={S.td}>
                      {item.IS_FINISHED === 1 ? (
  <Badge bg={C.blueSoft} fg={C.blue}>
    ✓ Finished
  </Badge>
) : item.IS_STARTED === 1 ? (
  <Badge bg={C.greenSoft} fg={C.green}>
    ● Active
  </Badge>
) : (
  <Badge bg="#fef3c7" fg={C.amber}>
    ◌ Pending
  </Badge>
)}
                    </td>
                    <td style={S.td}>
                      {item.IS_STARTED === 1 ? (
                        /* ── KEY CHANGE: show "View Tally" if final submitted, else "View" ── */
                        item.IS_FINISHED === 1 ? (
                          <Btn bg={C.purple} size="sm" onClick={() => setTallyModal({ crn: item.CONTAINER_NO })}>🧾 View Tally</Btn>
                        ) : (
                          <Btn bg={C.green} size="sm" onClick={() => handleView(item.CONTAINER_NO)}>👁 View</Btn>
                        )
                      ) : (
                        <Btn bg={C.blue} size="sm" onClick={() => handleStart(item.CONTAINER_NO)} disabled={loadingCrn === item.CONTAINER_NO}>
                          {loadingCrn === item.CONTAINER_NO ? "Starting…" : "▶ Start"}
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ════════════════ CARTING MODAL ════════════════ */}
      {modalOpen && cartingData && (() => {
        const crn           = cartingData.crn;
        const shippingBills = parseSBList(cartingData.shipping_bill_details_list);
        const sbNos         = shippingBills.map((s) => s.shipping_bill_number);

        const mappedTruckNos = new Set(Object.entries(truckBillChecks).filter(([, v]) => v).map(([k]) => k.split("||")[0]));
        const unmappedTrucks = trucks.filter((t) => !mappedTruckNos.has(t.TRUCK_NO));

        const getComboRows  = (truckNo, sbNo) => gridRows.filter((r) => r.TRUCK_NO === truckNo && r.SHIPPING_BILL_NO === sbNo);
        const getTrucksForSb = (sbNo) => [...new Set(gridRows.filter((r) => r.SHIPPING_BILL_NO === sbNo).map((r) => r.TRUCK_NO))];
        const isSbFinished  = (sbNo) => {
          const sbTrucks = getTrucksForSb(sbNo);
          if (!sbTrucks.length) return false;
          return sbTrucks.every((t) => {
            const rows = getComboRows(t, sbNo);
            return rows.length > 0 && rows.every((r) => r.JOB_STATUS === "FINISHED");
          });
        };
        const comboHasGrid  = (truckNo, sbNo) => getComboRows(truckNo, sbNo).some((r) => r.WAREHOUSE);

        return (
          <div style={S.overlay}>
            <div style={S.modalBox}>

              {/* Modal Header */}
              <div style={{ background: C.navy, padding: "16px 22px", borderRadius: "16px 16px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Carting Details</div>
                  <div style={{ color: C.subtle, fontSize: 12, marginTop: 2 }}>
                    CRN: <span style={{ color: "#60a5fa", fontFamily: "monospace", fontWeight: 700 }}>{crn}</span>
                    <span style={{ color: C.muted, margin: "0 10px" }}>|</span>
                    🚛 {trucks.length} truck{trucks.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <button onClick={() => setModalOpen(false)} style={{ background: "rgba(255,255,255,.1)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 17, fontWeight: 700 }}>✕</button>
              </div>

              <div style={{ overflowY: "auto", padding: "18px 22px 28px", flex: 1 }}>

                {/* Info Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10, marginBottom: 14 }}>
                  {Object.entries(cartingData)
                    .filter(([k]) => !["shipping_bill_details_list", "crn"].includes(k) && typeof cartingData[k] !== "object")
                    .map(([k, v]) => (
                      <div key={k} style={{ ...S.card, padding: "11px 15px" }}>
                        <InfoRow label={k.replaceAll("_", " ")} value={v} />
                      </div>
                    ))}
                  <div style={{ background: C.navy, borderRadius: 12, padding: "11px 15px", display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.subtle, textTransform: "uppercase", letterSpacing: ".06em" }}>Total Gross Weight</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{Number(cartingData?.gross_weight || 0).toFixed(2)}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>KG</span>
                  </div>
                </div>

                {/* Nested object cards */}
                {Object.entries(cartingData)
                  .filter(([k]) => !["shipping_bill_details_list", "crn"].includes(k) && typeof cartingData[k] === "object" && cartingData[k] !== null)
                  .map(([k, v]) => (
                    <div key={k} style={{ ...S.card, marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>{k.replaceAll("_", " ")}</div>
                      {Array.isArray(v)
                        ? v.map((item, idx) => (
                            <div key={idx} style={{ background: C.bg, borderRadius: 8, padding: 11, marginBottom: 7, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 9 }}>
                              {Object.entries(item).map(([kk, vv]) => <InfoRow key={kk} label={kk.replaceAll("_", " ")} value={vv} />)}
                            </div>
                          ))
                        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 9 }}>
                            {Object.entries(v).map(([kk, vv]) => <InfoRow key={kk} label={kk.replaceAll("_", " ")} value={vv} />)}
                          </div>
                      }
                    </div>
                  ))}

                {/* Shipping Bills Table */}
                <div style={S.sectionTitle}>📋 Shipping Bills <Badge bg={C.blue}>{shippingBills.length}</Badge></div>
                <div style={{ overflowX: "auto", borderRadius: 10, boxShadow: "0 1px 5px rgba(0,0,0,.05)", marginBottom: 4 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", background: C.bgCard, minWidth: 540 }}>
                    <thead><tr>{["#", "SB No.", "Date", "Commodity", "Pkgs", "Actual Wt.", "Calc. Wt.", "Type"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {shippingBills.map((sb, i) => {
                        const totalPkgs  = shippingBills.reduce((s, x) => s + Number(x.no_of_packages_declared || 0), 0);
                        const unitW      = totalPkgs > 0 ? Number(cartingData?.gross_weight || 0) / totalPkgs : 0;
                        const calculated = (Number(sb.no_of_packages_declared || 0) * unitW).toFixed(2);
                        return (
                          <tr key={i} style={{ background: i % 2 ? "#fafbfc" : "#fff" }}>
                            <td style={{ ...S.td, color: C.muted, fontWeight: 700 }}>{i + 1}</td>
                            <td style={S.td}><span style={{ fontWeight: 800, color: C.blue, fontFamily: "monospace" }}>{sb.shipping_bill_number}</span></td>
                            <td style={{ ...S.td, color: C.muted }}>
                              {sb.shipping_bill_date ? new Date(sb.shipping_bill_date).toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : "-"}
                            </td>
                            <td style={S.td}>{sb.commodity_description}</td>
                            <td style={S.td}><Badge bg={C.blueSoft} fg={C.blue}>{sb.no_of_packages_declared}</Badge></td>
                            <td style={{ ...S.td, color: C.muted }}>{sb.package_weight}</td>
                            <td style={S.td}><span style={{ color: C.green, fontWeight: 700 }}>{calculated}</span></td>
                            <td style={S.td}><Badge bg={C.greenSoft} fg={C.green}>{sb.package_type}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Truck → SB Mapping */}
                {!mappingSaved ? (
                  <>
                    <div style={S.sectionTitle}>🚛 Truck → Shipping Bill Mapping</div>
                    {unmappedTrucks.length > 0 && (
                      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 9, padding: "9px 15px", marginBottom: 12, fontSize: 13, color: "#92400e", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                        ⚠️ Unmapped: <strong>{unmappedTrucks.map((t) => t.TRUCK_NO).join(", ")}</strong>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                      {trucks.map((truck, idx) => {
                        const isMapped = Object.entries(truckBillChecks).some(([key, checked]) => checked && key.startsWith(`${truck.TRUCK_NO}||`));
                        return (
                          <div key={truck.TRUCK_NO} style={{ ...S.card, padding: "13px 17px", borderColor: isMapped ? "#bbf7d0" : "#fecaca", background: isMapped ? C.greenSoft : C.redSoft }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                              <div style={{ width: 26, height: 26, borderRadius: 7, background: C.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>{idx + 1}</div>
                              <span style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>🚛 {truck.TRUCK_NO}</span>
                              <Badge bg={isMapped ? C.green : C.red}>{isMapped ? "✓ Mapped" : "✗ Unmapped"}</Badge>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                              {sbNos.map((sbNo) => {
                                const key     = `${truck.TRUCK_NO}||${sbNo}`;
                                const checked = !!truckBillChecks[key];
                                return (
                                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", background: checked ? C.blueSoft : "#fff", border: `1.5px solid ${checked ? C.blue : C.border}`, borderRadius: 8, padding: "6px 11px", transition: "all .15s" }}>
                                    <input type="checkbox" checked={checked}
                                      onChange={(e) => setTruckBillChecks((p) => ({ ...p, [key]: e.target.checked }))}
                                      style={{ accentColor: C.blue, width: 13, height: 13 }}
                                    />
                                    <span style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: checked ? C.blue : C.muted }}>{sbNo}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Btn bg={unmappedTrucks.length > 0 ? C.muted : C.green} disabled={unmappedTrucks.length > 0} onClick={() => handleSaveMapping(crn)}>
                      💾 Save Truck Mapping
                    </Btn>
                    {unmappedTrucks.length > 0 && <span style={{ marginLeft: 10, fontSize: 12, color: C.red, fontWeight: 600 }}>Map all trucks first</span>}
                  </>
                ) : (
                  <div style={{ ...S.card, background: C.greenSoft, borderColor: "#bbf7d0", color: C.green, fontWeight: 700, marginTop: 24, marginBottom: 4, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                    ✅ Truck → Shipping Bill Mapping Completed
                    <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted, fontWeight: 500 }}>{gridRows.length} record{gridRows.length !== 1 ? "s" : ""} in DB</span>
                  </div>
                )}

                {/* Grid Allocation per SB */}
                {mappingSaved && (
                  <>
                    <div style={S.sectionTitle}>📦 Grid Allocation per Shipping Bill</div>
                    {shippingBills.map((sb, si) => {
                      const sbNo       = sb.shipping_bill_number;
                      const sbTrucks   = getTrucksForSb(sbNo);
                      const isFinished = isSbFinished(sbNo);
                      const isLive     = !!liveStarted[sbNo] && !isFinished;
                      const hasAnyGrid = sbTrucks.some((t) => comboHasGrid(t, sbNo));

                      const totalPkgs  = shippingBills.reduce((s, x) => s + Number(x.no_of_packages_declared || 0), 0);
                      const grossWt    = Number(cartingData?.gross_weight || 0);
                      const unitW      = totalPkgs > 0 ? grossWt / totalPkgs : 0;
                      const calcWeight = (Number(sb.no_of_packages_declared || 0) * unitW).toFixed(2);
                      const firstFinishedRow = gridRows.find((r) => r.SHIPPING_BILL_NO === sbNo && r.JOB_STATUS === "FINISHED");

                      return (
                        <div key={si} style={{ ...S.card, marginBottom: 16, borderColor: isFinished ? "#bbf7d0" : isLive ? "#bfdbfe" : C.border, borderWidth: 1.5, background: isFinished ? C.greenSoft : isLive ? C.blueSoft : C.bgCard }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                              <span style={{ fontWeight: 800, fontSize: 11, color: C.muted, textTransform: "uppercase" }}>#{si + 1}</span>
                              <span style={{ fontWeight: 800, fontSize: 15, color: C.navy, fontFamily: "monospace" }}>{sbNo}</span>
                              <Badge bg={isFinished ? C.green : isLive ? C.blue : C.amber}>
                                {finalSubmitted ? "🔒 Final Submitted" : isFinished ? "✅ Finished" : isLive ? "🔴 Live" : "⏳ Started"}
                              </Badge>
                              <Badge bg={C.navyMid}>{sbTrucks.length} 🚛</Badge>
                              <Badge bg={C.greenSoft} fg={C.green}>{calcWeight} Tons</Badge>
                            </div>
                            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                              {!isFinished && !isLive && hasAnyGrid && !finalSubmitted && (
                                <Btn bg={C.cyan} size="sm" onClick={() => setLiveStarted((p) => ({ ...p, [sbNo]: true }))}>▶ Start Live</Btn>
                              )}
                              {!isFinished && isLive && (
                                <Btn bg={C.green} size="sm" onClick={() => openFinishModal(sbNo, crn)}>✅ Finish Job</Btn>
                              )}
                              {isFinished && !finalSubmitted && (
                                <Btn bg={C.amber} size="sm" onClick={() => openFinishModal(sbNo, crn)}>✏️ Modify</Btn>
                              )}
                            </div>
                          </div>

                          {isFinished && firstFinishedRow && (
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", background: C.bgCard, borderRadius: 8, padding: "9px 13px", marginBottom: 12, border: "1px solid #bbf7d0" }}>
                              {firstFinishedRow.HANDLING_TYPE && <span style={{ fontWeight: 700, color: C.green, fontSize: 13 }}>📋 {firstFinishedRow.HANDLING_TYPE}</span>}
                              {firstFinishedRow.START_TIME    && <span style={{ color: C.navyMid, fontSize: 13 }}>▶ {firstFinishedRow.START_TIME.replace("T", " ")}</span>}
                              {firstFinishedRow.END_TIME      && <span style={{ color: C.navyMid, fontSize: 13 }}>⏹ {firstFinishedRow.END_TIME.replace("T", " ")}</span>}
                            </div>
                          )}

                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {sbTrucks.map((truckNo) => {
                              const comboRows     = getComboRows(truckNo, sbNo);
                              const comboKey      = `${truckNo}||${sbNo}`;
                              const wh            = comboWarehouse[comboKey] || "Export";
                              const truckFinished = comboRows.length > 0 && comboRows.every((r) => r.JOB_STATUS === "FINISHED");
                              const realRows      = comboRows.filter((r) => r.WAREHOUSE);
                              const stubRows      = comboRows.filter((r) => !r.WAREHOUSE);

                              return (
                                <div key={truckNo} style={{ border: `1.5px solid ${truckFinished ? "#bbf7d0" : C.border}`, borderRadius: 10, overflow: "hidden", background: truckFinished ? "#f0fdf4" : "#fafcff" }}>
                                  <div style={{ background: C.navyMid, padding: "9px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>🚛 {truckNo}</span>
                                      <Badge bg={truckFinished ? C.green : isLive ? C.blue : C.amber}>
                                        {truckFinished ? "✅ Done" : isLive ? "🔴 Live" : "⏳ Pending"}
                                      </Badge>
                                      <Badge bg={C.slate} fg={C.subtle}>{realRows.length} location{realRows.length !== 1 ? "s" : ""}</Badge>
                                    </div>
                                    {!truckFinished && !finalSubmitted && (
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <select value={wh}
                                          onChange={(e) => setComboWarehouse((p) => ({ ...p, [comboKey]: e.target.value }))}
                                          style={{ padding: "5px 10px", borderRadius: 7, border: `1.5px solid ${C.slate}`, fontSize: 12, color: "#fff", background: C.slate, cursor: "pointer", outline: "none" }}
                                        >
                                          <option value="Export">Export</option>
                                          <option value="Mazzanine">Mazzanine</option>
                                          <option value="OYC">OYC</option>
                                        </select>
                                        <Btn bg={C.purple} size="sm" onClick={() => {
                                          const stubRow = stubRows.length > 0 ? stubRows[0] : null;
                                          openMap(crn, truckNo, sbNo, stubRow?.WAREHOUSE ? stubRow : null);
                                        }}>
                                          🗺 Add Grid
                                        </Btn>
                                      </div>
                                    )}
                                  </div>

                                  {realRows.length > 0 ? (
                                    <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                                      {realRows.map((row) => {
                                        const grids = parseGrid(row.GRID);
                                        return (
                                          <div key={row.ID} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "9px 13px", background: "#fff", borderRadius: 8, border: `1px solid ${C.border}` }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                                              <span style={{ background: C.purple, color: "#fff", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>📦 {row.WAREHOUSE}</span>
                                              <span style={{ color: C.blue, fontWeight: 700 }}>{row.LOCATION_CODE}</span>
                                              <span style={{ color: C.subtle }}>→</span>
                                              <span style={{ color: C.green, fontWeight: 600 }}>
                                                {grids.length > 0 ? grids.join(", ") : <em style={{ color: C.subtle }}>No grids</em>}
                                              </span>
                                              <Badge bg={C.bg} fg={C.muted}>{row.AREA || grids.length} SQM</Badge>
                                            </div>
                                            <div style={{ display: "flex", gap: 6 }}>
                                              <Btn bg={truckFinished ? C.green : C.amber} size="sm" onClick={() => openMap(crn, truckNo, sbNo, row)}>
                                                {truckFinished ? "📝 View/Edit" : "✏ Edit"}
                                              </Btn>
                                              {!truckFinished && !finalSubmitted && (
                                                <Btn bg={C.red} size="sm" onClick={() => removeGridRow(row.ID)}>✕</Btn>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div style={{ textAlign: "center", padding: "16px", color: C.subtle, fontSize: 12 }}>
                                      <div style={{ fontSize: 22, marginBottom: 4 }}>🗺</div>
                                      Select warehouse and click <strong>Add Grid</strong> to allocate
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Final Submit Button */}
                {mappingSaved && !finalSubmitted && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
                    <Btn bg={C.red} onClick={async () => {
                      try {
                        const r = await axios.post(`${BASE}/api/final-submit-carting`, { crn });
                        if (!r.data?.success) { alert(r.data?.message || "Failed"); return; }
                        /* ── KEY CHANGE: close modal and show tally ── */
                        setModalOpen(false);
                        setCartingData(null);
                        setTallyModal({ crn });
                      } catch (err) {
                        alert(err.response?.data?.message || err.message);
                      }
                    }}>
                      🔒 Final Submit
                    </Btn>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Finish / Modify Modal */}
      {finishModal && (
        <FinishModal
          {...finishModal}
          onCancel={() => setFinishModal(null)}
          onDone={() => {
            const crn  = cartingData?.crn;
            const sbNo = finishModal.sbNo;
            setFinishModal(null);
            setLiveStarted((p) => ({ ...p, [sbNo]: false }));
            handleView(crn);
          }}
        />
      )}

      {/* ── Tally Sheet Modal ── */}
      {tallyModal && (
        <TallySheetModal
          crn={tallyModal.crn}
          onClose={() => setTallyModal(null)}
        />
      )}

      {/* Map Modals */}
      <MapModal
        isVisible={mapVisible} onClose={() => setMapVisible(false)}
        MapName={mapName} activeGridSelection={activeGridSel}
        setActiveGridSelection={setActiveGridSel}
        setModalVisible2={(val) => { setMapVisible(false); setAreaVisible(!!val); }}
        SelectedGrids={SelectedGrids} setSelectedGrids={setSelectedGrids}
      />
      <MapAreaModal
        isVisible2={areaVisible}
        onClose2={() => { setAreaVisible(false); setPendingGrids([]); activeGridCtx.current = null; }}
        MapName={mapName} activeGridSelection={activeGridSel}
        setActiveGridSelection={setActiveGridSel}
        gridArea={pendingGrids} setGridArea={handleGridToggle}
        SelectedGrids={SelectedGrids} setSelectedGrids={setSelectedGrids}
        onConfirmGrids={handleConfirmGrids}
        warehouseSelections={{}} setWarehouseSelections={() => {}}
        ModalIds={activeGridCtx.current ? `${activeGridCtx.current.crn}__${activeGridCtx.current.truckNo}__${activeGridCtx.current.sbNo}` : ""}
      />
    </div>
  );
}