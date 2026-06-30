"use client";

import React, { useState, useMemo, useEffect } from "react";
import ToolLayout from "@/components/ToolLayout";
import mobilDatabase from "../lib/mobil_database.json";
import { Search, ShieldAlert, Download, FileSpreadsheet, Lock, CheckCircle2, AlertCircle, RefreshCw, Layers } from "lucide-react";

interface SKU {
  material_code: string;
  description: string;
  section: string;
  subcategory: string;
  package_group: string;
  article_size: string;
  pack_size: number;
  unit: string;
  list_price: number;
  rrp_unit: number;
  mrp_unit: number;
  rrp_pack: number;
  mrp_pack: number;
  prev_list_price: number;
  prev_mrp_unit: number;
  remarks: string;
}

export default function MobilSheetsConverter() {
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [subcatFilter, setSubcatFilter] = useState("All");
  const [clientId, setClientId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // Available filters
  const sections = useMemo(() => {
    const s = new Set<string>();
    (mobilDatabase as SKU[]).forEach((item) => s.add(item.section));
    return ["All", ...Array.from(s)];
  }, []);

  const subcategories = ["All", "Flagship", "Premium", "Standard"];

  // Filtered SKUs
  const filteredSKUs = useMemo(() => {
    return (mobilDatabase as SKU[]).filter((item) => {
      const matchSearch =
        item.material_code.includes(search) ||
        item.description.toLowerCase().includes(search.toLowerCase());
      const matchSection = sectionFilter === "All" || item.section === sectionFilter;
      const matchSubcat = subcatFilter === "All" || item.subcategory === subcatFilter;
      return matchSearch && matchSection && matchSubcat;
    });
  }, [search, sectionFilter, subcatFilter]);

  // Load GIS API script for OAuth
  useEffect(() => {
    if (typeof window !== "undefined") {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  // Format currency
  const fmt = (val: number) => {
    if (!val) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Immediate Offline CSV Backup
  const downloadCSV = () => {
    const headers = [
      "Material Code",
      "Material Description",
      "Section",
      "Subcategory",
      "Package Group",
      "Article Size",
      "Pack Size",
      "Unit",
      "List Price (w/o GST)",
      "RRP Unit (with GST)",
      "MRP Unit (with GST)",
      "RRP Pack (with GST)",
      "MRP Pack (with GST)",
      "Previous List Price (w/o GST)",
      "Previous MRP Unit (with GST)",
      "Remarks"
    ];

    const rows = filteredSKUs.map((s) => [
      `"${s.material_code}"`,
      `"${s.description}"`,
      `"${s.section}"`,
      `"${s.subcategory}"`,
      `"${s.package_group}"`,
      `"${s.article_size}"`,
      s.pack_size,
      `"${s.unit}"`,
      s.list_price || 0,
      s.rrp_unit || 0,
      s.mrp_unit || 0,
      s.rrp_pack || 0,
      s.mrp_pack || 0,
      s.prev_list_price || 0,
      s.prev_mrp_unit || 0,
      `"${s.remarks}"`
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Mobil_Lubricants_Prices_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Google OAuth Flow
  const authenticateGoogle = () => {
    if (!clientId.trim()) {
      setExportStatus({ type: "error", msg: "Please enter your Google OAuth Client ID first." });
      return;
    }

    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            setAccessToken(tokenResponse.access_token);
            setExportStatus({ type: "success", msg: "Authenticated successfully! Ready to export." });
          } else {
            setExportStatus({ type: "error", msg: "Authentication failed. No token received." });
          }
        },
      });
      client.requestAccessToken();
    } catch (e) {
      console.error(e);
      setExportStatus({ type: "error", msg: "Google Identity Client failed to load. Check console." });
    }
  };

  // Export to Google Sheets
  const exportToSheets = async () => {
    if (!accessToken) {
      setExportStatus({ type: "error", msg: "Please authenticate with Google first." });
      return;
    }

    setIsExporting(true);
    setExportStatus({ type: "info", msg: "Creating customized Google Spreadsheet..." });

    try {
      // 1. Create a spreadsheet
      const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            title: `Mobil Lubricants Price List - Effective 20th Apr 2026`,
          },
        }),
      });

      if (!createRes.ok) throw new Error("Failed to create spreadsheet.");
      const sheetInfo = await createRes.json();
      const spreadsheetId = sheetInfo.spreadsheetId;
      const sheetId = sheetInfo.sheets[0].properties.sheetId;

      // 2. Prepare headers and rows with exact styling
      const headers = [
        "Material Code",
        "Material Description",
        "Section",
        "Subcategory",
        "Package Group",
        "Article Size",
        "Pack Size",
        "Unit",
        "List Price (w/o GST)",
        "RRP Unit (with GST)",
        "MRP Unit (with GST)",
        "RRP Pack (with GST)",
        "MRP Pack (with GST)",
        "Previous List Price (w/o GST)",
        "Previous MRP Unit (with GST)",
        "Remarks"
      ];

      // Build data cells
      const rowsData: any[] = [];

      // Metadata Row
      rowsData.push({
        values: [
          {
            userEnteredValue: { stringValue: "Mobil CVL Lubricants Price List - Effective 20th Apr, 2026 (ExxonMobil corporate styled matrix)" },
            userEnteredFormat: {
              backgroundColor: { red: 0.88, green: 0.11, blue: 0.13 }, // Mobil Corporate Red (#e11b22)
              textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 1, green: 1, blue: 1 } },
              horizontalAlignment: "CENTER",
            }
          },
          ...Array(headers.length - 1).fill({
            userEnteredFormat: {
              backgroundColor: { red: 0.88, green: 0.11, blue: 0.13 },
            }
          })
        ]
      });

      // Header Row
      rowsData.push({
        values: headers.map((h) => ({
          userEnteredValue: { stringValue: h },
          userEnteredFormat: {
            backgroundColor: { red: 0.05, green: 0.19, blue: 0.36 }, // Mobil Corporate Navy (#0e305d)
            textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
            horizontalAlignment: h.includes("Price") || h.includes("RRP") || h.includes("MRP") || h === "Pack Size" ? "RIGHT" : "LEFT",
            borders: {
              bottom: { style: "SOLID", width: 2, color: { red: 0.88, green: 0.11, blue: 0.13 } }
            }
          }
        }))
      });

      // Populate SKUs
      filteredSKUs.forEach((s) => {
        rowsData.push({
          values: [
            { userEnteredValue: { stringValue: s.material_code }, userEnteredFormat: { textFormat: { fontFamily: "Courier New" }, horizontalAlignment: "CENTER" } },
            { userEnteredValue: { stringValue: s.description } },
            { userEnteredValue: { stringValue: s.section } },
            { userEnteredValue: { stringValue: s.subcategory } },
            { userEnteredValue: { stringValue: s.package_group } },
            { userEnteredValue: { stringValue: s.article_size } },
            { userEnteredValue: { numberValue: s.pack_size }, userEnteredFormat: { horizontalAlignment: "RIGHT" } },
            { userEnteredValue: { stringValue: s.unit }, userEnteredFormat: { horizontalAlignment: "CENTER" } },
            // Prices format: Currency
            ...[s.list_price, s.rrp_unit, s.mrp_unit, s.rrp_pack, s.mrp_pack, s.prev_list_price, s.prev_mrp_unit].map((p) => ({
              userEnteredValue: p ? { numberValue: p } : undefined,
              userEnteredFormat: p ? {
                numberFormat: { type: "CURRENCY", pattern: "[$₹-409]#,##0.00" },
                horizontalAlignment: "RIGHT"
              } : undefined
            })),
            { userEnteredValue: { stringValue: s.remarks || "" } }
          ]
        });
      });

      // 3. batchUpdate sheet properties (freeze 2 rows, set formatting, merge title cell, auto-resize columns)
      const updateBody = {
        requests: [
          // Merge Title Row
          {
            mergeCells: {
              range: {
                sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headers.length
              },
              mergeType: "MERGE_ALL"
            }
          },
          // Freeze first 2 rows
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: {
                  frozenRowCount: 2,
                },
              },
              fields: "gridProperties.frozenRowCount",
            },
          },
          // Populate Cells and Formats
          {
            updateCells: {
              range: {
                sheetId,
                startRowIndex: 0,
                endRowIndex: rowsData.length,
                startColumnIndex: 0,
                endColumnIndex: headers.length
              },
              rows: rowsData,
              fields: "userEnteredValue,userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,numberFormat,borders)"
            }
          },
          // Auto Resize Columns
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: headers.length
              }
            }
          }
        ]
      };

      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateBody),
      });

      if (!updateRes.ok) throw new Error("Failed to format spreadsheet.");

      setExportStatus({
        type: "success",
        msg: `Spreadsheet exported successfully!`,
      });

      // Open new sheet in a tab
      window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`, "_blank");
    } catch (err) {
      console.error(err);
      setExportStatus({ type: "error", msg: `Failed: ${(err as Error).message}` });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ToolLayout
      title="Mobil Lubricants Price Matrix"
      description="Directly extract the Mobil Commercial Vehicle Lubricants price list with 100% precision. Review specifications, download CSV backups, or publish structured sheets to Google Drive."
      category="pdf"
    >
      <div className="space-y-6">
        {/* ExxonMobil Theme Header Brand */}
        <div className="p-4 rounded-xl border border-red-500/30 bg-[#0e305d]/5 dark:bg-[#0e305d]/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-[#0e305d] to-[#e11b22] flex items-center justify-center text-white font-black tracking-tighter text-sm">
              MOBIL
            </div>
            <div>
              <span className="text-xs font-bold text-[#e11b22] uppercase tracking-widest block">ExxonMobil Distributor Suite</span>
              <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 block">CVL Price Matrix Converter</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={downloadCSV}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 hover:border-[#e11b22]/40 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 transition-all flex items-center space-x-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-[#e11b22]" />
              <span>CSV Backup</span>
            </button>
            <button
              onClick={exportToSheets}
              disabled={!accessToken || isExporting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0e305d] hover:bg-[#153e70] text-white disabled:opacity-50 transition-all flex items-center space-x-1.5 shadow-md"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export to Sheets</span>
            </button>
          </div>
        </div>

        {/* Filters and Search toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by SKU Code or Description (e.g. Delvac)..."
              className="w-full glass-input pl-9 text-xs py-2.5"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <select
              className="w-full glass-input text-xs py-2.5"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              <option value="All">All Sections</option>
              {sections.filter(s => s !== "All").map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              className="w-full glass-input text-xs py-2.5"
              value={subcatFilter}
              onChange={(e) => setSubcatFilter(e.target.value)}
            >
              <option value="All">All Tiers</option>
              {subcategories.filter(sc => sc !== "All").map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Google OAuth Panel */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/20 space-y-3">
          <div className="flex items-start space-x-2.5">
            <Lock className="w-4 h-4 text-indigo-500 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Google Drive & Sheets OAuth Integration</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                To export directly to your Google Drive, enter your Google OAuth Client ID. Authenticated credentials run strictly client-side.
              </p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-3">
            <input
              type="password"
              placeholder="Paste your Google OAuth Client ID (e.g., 123-abc.apps.googleusercontent.com)"
              className="w-full glass-input text-xs font-mono py-2"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <button
              onClick={authenticateGoogle}
              className="w-full md:w-auto px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all whitespace-nowrap shadow"
            >
              Authenticate API
            </button>
          </div>
          {exportStatus && (
            <div className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 border ${
              exportStatus.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400"
                : exportStatus.type === "error"
                ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400"
                : "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-400"
            }`}>
              {exportStatus.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : exportStatus.type === "error" ? (
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              ) : (
                <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
              )}
              <span>{exportStatus.msg}</span>
            </div>
          )}
        </div>

        {/* Tabular SKU Matrix */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#0e305d] text-white border-b-2 border-[#e11b22]">
                <tr>
                  <th className="p-3 text-center font-bold">Code</th>
                  <th className="p-3 font-bold">Product Description</th>
                  <th className="p-3 font-bold">Category Group</th>
                  <th className="p-3 text-center font-bold">Size</th>
                  <th className="p-3 text-right font-bold">Base Price (w/o GST)</th>
                  <th className="p-3 text-right font-bold">RRP (with GST)</th>
                  <th className="p-3 text-right font-bold">MRP (with GST)</th>
                  <th className="p-3 text-right font-bold">Prev Price</th>
                  <th className="p-3 font-bold">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white/40 dark:bg-slate-900/20">
                {filteredSKUs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                      No matching Mobil Commercial Lubricants SKUs found. Try adjusting search queries.
                    </td>
                  </tr>
                ) : (
                  filteredSKUs.map((sku) => (
                    <tr key={sku.material_code} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors">
                      <td className="p-3 font-mono text-center font-bold text-slate-600 dark:text-slate-400">{sku.material_code}</td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800 dark:text-slate-100 block">{sku.description}</span>
                        <span className="text-[10px] text-slate-400 block">{sku.section} • {sku.subcategory}</span>
                      </td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">
                        <span className="block">{sku.package_group}</span>
                        <span className="text-[10px] text-slate-400 block">{sku.article_size}</span>
                      </td>
                      <td className="p-3 text-center text-slate-700 dark:text-slate-300 font-medium">
                        {sku.pack_size} {sku.unit}
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-800 dark:text-slate-200">{fmt(sku.list_price)}</td>
                      <td className="p-3 text-right text-indigo-600 dark:text-indigo-400 font-bold">
                        {sku.rrp_unit ? (
                          <>
                            <span className="block">{fmt(sku.rrp_unit)} / Unit</span>
                            <span className="text-[9px] text-slate-400 block">Pack: {fmt(sku.rrp_pack)}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                        {sku.mrp_unit ? (
                          <>
                            <span className="block">{fmt(sku.mrp_unit)} / Unit</span>
                            <span className="text-[9px] text-slate-400 block">Pack: {fmt(sku.mrp_pack)}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td className="p-3 text-right text-slate-500 dark:text-slate-400">
                        {sku.prev_list_price ? (
                          <>
                            <span className="block font-medium">{fmt(sku.prev_list_price)} w/o GST</span>
                            {sku.prev_mrp_unit && (
                              <span className="text-[9px] text-slate-400 block">MRP: {fmt(sku.prev_mrp_unit)}</span>
                            )}
                          </>
                        ) : "—"}
                      </td>
                      <td className="p-3 text-slate-400 dark:text-slate-500 text-[10px] italic">{sku.remarks || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Table summary info */}
          <div className="bg-slate-100/40 dark:bg-slate-900/40 p-3 border-t border-slate-200 dark:border-slate-850 flex items-center justify-between text-[10px] text-slate-400">
            <span>Showing {filteredSKUs.length} of {mobilDatabase.length} SKUs in standard corporate price list matrix.</span>
            <span className="flex items-center space-x-1"><AlertCircle className="w-3 h-3 text-[#e11b22]" /> <span>Prices in INR (effective 20th Apr, 2026).</span></span>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
