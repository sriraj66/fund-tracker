"use client";

import { useState, useRef } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { Upload, X, Loader2, CheckCircle, AlertCircle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase/config";

interface ImportButtonProps {
  endpoint: string;
  accept: string;
  label?: string;
  hint?: string;
  templateUrl?: string;
  onSuccess?: () => void;
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string; imported: number }
  | { status: "error"; message: string };

export default function ImportButton({ endpoint, accept, label = "Import Statement", hint, templateUrl, onSuccess }: ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useScrollLock(open);

  const handleFile = (file: File) => { setSelectedFile(file); setState({ status: "idle" }); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setState({ status: "loading" });

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setState({ status: "error", message: "Not authenticated." }); return; }

      const fd = new FormData();
      fd.append("file", selectedFile);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setState({ status: "error", message: data.error ?? "Unknown error" });
      } else {
        setState({ status: "success", message: data.message, imported: data.imported ?? data.count ?? 0 });
        onSuccess?.();
        setTimeout(() => { setOpen(false); setSelectedFile(null); setState({ status: "idle" }); }, 2500);
      }
    } catch {
      setState({ status: "error", message: "Network error. Please try again." });
    }
  };

  const handleClose = () => { setOpen(false); setSelectedFile(null); setState({ status: "idle" }); };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary">
        <Upload className="w-4 h-4" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative w-full sm:max-w-md bg-gray-900/95 backdrop-blur-sm border border-gray-800/60 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto overscroll-contain">
            <div className="sm:hidden flex justify-center mb-3 -mt-1">
              <div className="w-10 h-1 rounded-full bg-gray-700" />
            </div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex-1 min-w-0 pr-3">
                <h2 className="text-base font-semibold text-white">{label}</h2>
                {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
                {templateUrl && (
                  <a
                    href={templateUrl}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 mt-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Download template
                  </a>
                )}
              </div>
              <button onClick={handleClose} className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                dragOver ? "border-sky-400 bg-sky-500/10" : selectedFile ? "border-emerald-500/50 bg-emerald-500/5" : "border-gray-700 hover:border-gray-500 hover:bg-gray-800/30"
              )}
            >
              <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {selectedFile ? (
                <div>
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <p className="text-sm text-emerald-400 font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB — click to change</p>
                </div>
              ) : (
                <div>
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-300 font-medium">Drop file here or click to browse</p>
                  <p className="text-xs text-gray-500 mt-1">Accepts: <span className="text-sky-400">{accept}</span></p>
                </div>
              )}
            </div>

            {state.status === "success" && (
              <div className="mt-4 flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-emerald-400 font-medium">Import successful!</p>
                  <p className="text-xs text-emerald-300/70 mt-0.5">{state.message}</p>
                </div>
              </div>
            )}

            {state.status === "error" && (
              <div className="mt-4 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{state.message}</p>
              </div>
            )}

            <div className="flex gap-3 mt-5 pb-4">
              <button onClick={handleClose} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || state.status === "loading" || state.status === "success"}
                className="btn-primary flex-1 justify-center"
              >
                {state.status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
                {state.status === "loading" ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}