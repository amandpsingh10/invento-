import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { PartsUploadPreviewResult, PartsImportResult } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { cn, formatCurrency } from "@/lib/utils";
import { saveFileToDevice } from "@/lib/nativeFile";
import { PART_CATEGORY_LABELS, type PartCategoryCode } from "@/lib/partCategory";

type Step = "upload" | "preview" | "done";

/**
 * Bulk "Add Parts by Excel" — pure Part-master upsert (create or update by
 * Part No), unlike Upload Purchase: no Store/Bin/Rack/Quantity, no
 * Purchase/Inventory/StockLedger records. Mirrors UploadPurchasePage.tsx's
 * upload → preview & validate → import flow exactly, just against
 * /parts/* instead of /purchases/*.
 */
export function BulkUploadPartsPage() {
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<PartsUploadPreviewResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<PartsImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();
  const navigate = useNavigate();

  async function downloadTemplate() {
    const res = await apiClient.get("/parts/template", { responseType: "blob" });
    const file = new File([res.data], "PARTS-INVENTORY-SYSTEM-Parts-Upload-Template.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const result = await saveFileToDevice(file);
    if (result === "shared") {
      push({ tone: "success", title: "Choose where to save", description: 'Pick "Save to Files" or "Drive" from the menu that opened.' });
    } else if (result === "downloaded") {
      push({ tone: "success", title: "Template downloaded" });
    }
  }

  async function handleFileSelected(file: File) {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      push({ tone: "error", title: "Unsupported file", description: "Only .xlsx and .xls files are supported." });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post<{ data: PartsUploadPreviewResult }>("/parts/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(res.data.data);
      setStep("preview");
    } catch (err) {
      push({ tone: "error", title: "Upload failed", description: getApiErrorMessage(err) });
    } finally {
      setUploading(false);
    }
  }

  async function downloadErrorReport() {
    if (!preview) return;
    const res = await apiClient.get(`/parts/upload/${preview.uploadedFileId}/error-report`, { responseType: "blob" });
    const file = new File([res.data], "PARTS-INVENTORY-SYSTEM-Rejected-Parts.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const result = await saveFileToDevice(file);
    if (result === "shared") {
      push({ tone: "success", title: "Choose where to save", description: 'Pick "Save to Files" or "Drive" from the menu that opened.' });
    } else if (result === "downloaded") {
      push({ tone: "success", title: "Error report downloaded" });
    }
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await apiClient.post<{ data: PartsImportResult }>("/parts/import", { uploadedFileId: preview.uploadedFileId });
      setImportResult(res.data.data);
      setStep("done");
      push({ tone: "success", title: "Parts imported", description: `${res.data.data.importedRows} row(s) imported successfully.` });
    } catch (err) {
      push({ tone: "error", title: "Import failed", description: getApiErrorMessage(err) });
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep("upload");
    setPreview(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      <PageHeader
        title="Bulk Upload Parts"
        subtitle="Download the template, fill in part details and upload to add or update the Parts master in bulk."
        breadcrumbs={["Administration", "Parts", "Bulk Upload"]}
        actions={
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Download Template
          </Button>
        }
      />

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500">
        {(["upload", "preview", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                step === s ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 text-slate-400 dark:border-navy-600 dark:text-slate-500"
              )}
            >
              {i + 1}
            </span>
            <span className={cn(step === s && "text-slate-700 dark:text-slate-300")}>
              {s === "upload" ? "Upload" : s === "preview" ? "Preview & Validate" : "Complete"}
            </span>
            {i < 2 && <span className="mx-1 text-slate-300 dark:text-slate-600">—</span>}
          </div>
        ))}
      </div>

      {step === "upload" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Upload your parts Excel file</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Supported formats: .xlsx, .xls (max 10 MB)</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
            />
            <Button onClick={() => fileInputRef.current?.click()} isLoading={uploading} size="lg">
              <Upload className="h-4 w-4" /> {uploading ? "Validating..." : "Select File"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "preview" && preview && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Rows</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{preview.totalRows}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Valid Rows</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{preview.validRows}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Invalid Rows</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{preview.invalidRows}</p>
              </CardContent>
            </Card>
          </div>

          {preview.invalidRows > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                {preview.invalidRows} row(s) have errors and will be skipped. Only valid rows will be imported.
              </div>
              <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                <Download className="h-4 w-4" /> Download Error Report
              </Button>
            </div>
          )}

          {preview.rows.some((r) => r.ndpMismatch) && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              NDP does not match the calculated value on {preview.rows.filter((r) => r.ndpMismatch).length} row(s). The
              system-calculated NDP (MRP ÷ (1 + Tax% ÷ 100)) will be used instead of the uploaded value.
            </div>
          )}

          <Card>
            <div className="max-h-[28rem] overflow-auto thin-scroll">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-slate-100 bg-slate-50 font-semibold uppercase tracking-wide text-slate-500 dark:border-navy-800 dark:bg-navy-800/40 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Part No</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Tax %</th>
                    <th className="px-3 py-2 text-right">MRP</th>
                    <th className="px-3 py-2 text-right">NDP</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Barcode</th>
                    <th className="px-3 py-2 text-right">Min Stock</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Validity</th>
                    <th className="px-3 py-2">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber} className={cn(!row.isValid && "bg-red-50/50 dark:bg-red-500/10")}>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-medium">{row.partNo}</td>
                      <td className="px-3 py-2">{row.partDescription}</td>
                      <td className="px-3 py-2 text-right">{row.taxPercent ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{row.mrp !== null ? formatCurrency(row.mrp) : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {row.ndp !== null ? formatCurrency(row.ndp) : "—"}
                        {row.ndpMismatch && (
                          <p className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            NDP mismatch — recalculated
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.unit || "—"}</td>
                      <td className="px-3 py-2">
                        {row.category ? PART_CATEGORY_LABELS[row.category as PartCategoryCode] ?? row.category : "—"}
                      </td>
                      <td className="px-3 py-2">{row.barcode || "—"}</td>
                      <td className="px-3 py-2 text-right">{row.minimumStockLevel}</td>
                      <td className="px-3 py-2">{row.status || "—"}</td>
                      <td className="px-3 py-2">
                        {row.isValid ? (
                          <Badge tone="success">
                            <CheckCircle2 className="h-3 w-3" /> Valid
                          </Badge>
                        ) : (
                          <Badge tone="danger">
                            <XCircle className="h-3 w-3" /> Invalid
                          </Badge>
                        )}
                      </td>
                      <td className="cell-wrap max-w-[240px] px-3 py-2 text-red-600 dark:text-red-400">{row.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Cancel Upload
            </Button>
            <Button onClick={handleImport} isLoading={importing} disabled={preview.validRows === 0}>
              Import {preview.validRows} Valid Row{preview.validRows === 1 ? "" : "s"}
            </Button>
          </div>
        </>
      )}

      {step === "done" && importResult && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Parts imported successfully</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {importResult.createdCount} new part(s) created and {importResult.updatedCount} existing part(s) updated
                {importResult.skippedRows > 0 ? ` — ${importResult.skippedRows} row(s) skipped.` : "."}
              </p>
            </div>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" onClick={reset}>
                Upload Another File
              </Button>
              <Button onClick={() => navigate("/admin-tenant/parts")}>View Parts</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
