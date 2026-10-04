import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileQuestion,
  ExternalLink
} from 'lucide-react';
import {
  formatFileSize,
  getFileTypeLabel,
  isPdfFile,
  isImageFile,
  formatDocumentCategory
} from '../utils/documentUtils';

export interface ViewerDocument {
  id?: string;
  fileName: string;
  fileType?: string;
  fileDataUrl: string;
  fileSize?: number;
  documentCategory?: string;
  documentType?: string;
  status?: string;
  uploadedAt?: string;
  rejectionReason?: string;
  notes?: string;
  memberName?: string;
  memberId?: string;
  loanApplicationId?: string;
}

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: ViewerDocument | null;
  title?: string; // Default: "SUBMITTED DOCUMENT"
  onStatusAction?: (status: 'APPROVED' | 'REJECTED' | 'VERIFIED', reason?: string) => Promise<void> | void;
  canReview?: boolean;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  document: doc,
  title = 'SUBMITTED DOCUMENT',
  onStatusAction,
  canReview = false
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Reset zoom & rotation whenever a new document is opened
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setIsRejecting(false);
      setRejectionReasonInput('');
    }
  }, [isOpen, doc?.id, doc?.fileName]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !doc) return null;

  const pdf = isPdfFile(doc.fileType, doc.fileDataUrl, doc.fileName);
  const image = isImageFile(doc.fileType, doc.fileDataUrl, doc.fileName);
  const categoryLabel = formatDocumentCategory(doc.documentCategory || doc.documentType);
  const typeLabel = getFileTypeLabel(doc.fileType, doc.fileName, doc.fileDataUrl);
  const sizeLabel = formatFileSize(doc.fileSize || (doc.fileDataUrl ? Math.round(doc.fileDataUrl.length * 0.75) : undefined));

  const handleZoomIn = () => setZoom(prev => Math.min(3, +(prev + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom(prev => Math.max(0.25, +(prev - 0.25).toFixed(2)));
  const handleRotateCw = () => setRotation(prev => (prev + 90) % 360);
  const handleRotateCcw = () => setRotation(prev => (prev - 90 + 360) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const formattedUploadDate = doc.uploadedAt
    ? new Date(doc.uploadedAt).toLocaleString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recorded at Submission';

  const normalizedStatus = (doc.status || 'PENDING').toUpperCase();

  const handleApprove = async () => {
    if (!onStatusAction) return;
    setIsProcessing(true);
    try {
      await onStatusAction(title.includes('LOAN') ? 'APPROVED' : 'VERIFIED');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!onStatusAction) return;
    if (!rejectionReasonInput.trim()) return;
    setIsProcessing(true);
    try {
      await onStatusAction('REJECTED', rejectionReasonInput.trim());
      setIsRejecting(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-viewer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* DOCUMENT HEADER & METADATA SECTION */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {title}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase inline-flex items-center gap-1 ${
                  normalizedStatus === 'APPROVED' || normalizedStatus === 'VERIFIED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : normalizedStatus === 'REJECTED'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {normalizedStatus === 'APPROVED' || normalizedStatus === 'VERIFIED' ? (
                  <CheckCircle2 size={11} />
                ) : normalizedStatus === 'REJECTED' ? (
                  <AlertCircle size={11} />
                ) : (
                  <Clock size={11} />
                )}
                {normalizedStatus}
              </span>
              {doc.loanApplicationId && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                  Loan App #{doc.loanApplicationId}
                </span>
              )}
            </div>

            <h3 id="document-viewer-title" className="text-base sm:text-lg font-bold text-white truncate" title={doc.fileName}>
              {doc.fileName}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
              <div>
                <span className="text-slate-400">Category: </span>
                <strong className="text-white">{categoryLabel}</strong>
              </div>
              <div>
                <span className="text-slate-400">Format: </span>
                <span className="font-mono text-emerald-400">{typeLabel}</span>
              </div>
              <div>
                <span className="text-slate-400">Size: </span>
                <span className="font-mono">{sizeLabel}</span>
              </div>
              <div>
                <span className="text-slate-400">Uploaded: </span>
                <span className="font-mono text-slate-200">{formattedUploadDate}</span>
              </div>
              {doc.memberName && (
                <div>
                  <span className="text-slate-400">Member: </span>
                  <span className="text-slate-200 font-semibold">{doc.memberName}</span>
                </div>
              )}
            </div>

            {/* Rejection / Note feedback if present */}
            {(doc.rejectionReason || doc.notes) && (
              <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2 mt-2">
                <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-rose-300">Staff Note / Rejection Reason: </span>
                  <span>{doc.rejectionReason || doc.notes}</span>
                </div>
              </div>
            )}
          </div>

          {/* Top Right Controls & Actions */}
          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {doc.fileDataUrl && (
              <a
                href={doc.fileDataUrl}
                download={doc.fileName}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Download this file"
              >
                <Download size={14} />
                <span>Download</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              title="Close Viewer (Esc)"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* IMAGE TOOLBAR (Zoom, Rotate, Fit Controls) */}
        {image && doc.fileDataUrl && (
          <div className="bg-slate-800/90 border-b border-slate-700 px-4 py-2 flex items-center justify-between gap-2 text-white text-xs shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-mono text-slate-400 uppercase mr-1">Controls:</span>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.25}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-lg transition-all cursor-pointer"
                title="Zoom Out (-25%)"
              >
                <ZoomOut size={14} />
              </button>
              <span className="font-mono text-xs px-2 py-0.5 bg-slate-900 rounded font-bold min-w-[54px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-lg transition-all cursor-pointer"
                title="Zoom In (+25%)"
              >
                <ZoomIn size={14} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleRotateCcw}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                title="Rotate 90° Counter-Clockwise"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Rotate -90°</span>
              </button>
              <button
                type="button"
                onClick={handleRotateCw}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                title="Rotate 90° Clockwise"
              >
                <RotateCw size={14} />
                <span className="hidden sm:inline">Rotate +90°</span>
              </button>
              {(zoom !== 1 || rotation !== 0) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                  title="Fit to Screen & Reset View"
                >
                  <Maximize2 size={13} />
                  <span>Fit Screen</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* MAIN VIEWER CANVAS */}
        <div className="flex-1 bg-slate-950 min-h-[380px] sm:min-h-[460px] max-h-[65vh] overflow-auto flex items-center justify-center p-4 relative">
          {!doc.fileDataUrl ? (
            /* Missing Document File State */
            <div className="text-center p-8 max-w-md bg-slate-900 border border-dashed border-slate-700 rounded-2xl space-y-3">
              <FileQuestion size={40} className="text-amber-400 mx-auto" />
              <h4 className="font-bold text-white text-base">File Data Not Available</h4>
              <p className="text-xs text-slate-400">
                The document metadata was found, but the file content could not be rendered from the store. This may occur if the member only submitted an application placeholder without an attached file.
              </p>
              <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-mono">
                {doc.fileName}
              </span>
            </div>
          ) : pdf ? (
            /* Embedded PDF Viewer */
            <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-between space-y-3">
              <iframe
                src={doc.fileDataUrl}
                title={doc.fileName}
                className="w-full flex-1 min-h-[480px] rounded-xl border border-slate-800 bg-white"
              />
              <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3 w-full shrink-0">
                <span className="flex items-center gap-1.5">
                  <FileText size={14} className="text-rose-400" />
                  Inline PDF Preview
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500">
                    If browser blocks embedded PDF rendering:
                  </span>
                  <a
                    href={doc.fileDataUrl}
                    download={doc.fileName}
                    className="text-emerald-400 hover:text-emerald-300 font-bold underline flex items-center gap-1"
                  >
                    <Download size={12} /> Download PDF File
                  </a>
                </div>
              </div>
            </div>
          ) : image ? (
            /* High-Fidelity Image Viewer with Pan & Zoom */
            <div className="w-full h-full flex items-center justify-center p-2 overflow-auto">
              <img
                src={doc.fileDataUrl}
                alt={doc.fileName}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out'
                }}
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            /* Other / Unsupported Document Types */
            <div className="text-center p-8 max-w-md bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl w-16 h-16 mx-auto flex items-center justify-center border border-emerald-500/20">
                <FileText size={32} />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">{doc.fileName}</h4>
                <p className="text-xs text-slate-400 mt-1 font-mono">{typeLabel} • {sizeLabel}</p>
              </div>
              <p className="text-xs text-slate-400">
                Direct in-browser visual preview is not supported for this file format. You can download and open this document with your system's native application.
              </p>
              <a
                href={doc.fileDataUrl}
                download={doc.fileName}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                <Download size={14} /> Download & Open File
              </a>
            </div>
          )}
        </div>

        {/* FOOTER & STAFF VERIFICATION ACTIONS (If Enabled) */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span>Authenticated document viewing record. Access restricted to authorized personnel.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {canReview && onStatusAction && !isRejecting && (
              <>
                <button
                  type="button"
                  onClick={() => setIsRejecting(true)}
                  disabled={isProcessing}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Reject Document
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>{title.includes('LOAN') ? 'Approve Document' : 'Verify Document'}</span>
                </button>
              </>
            )}

            {isRejecting && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Specify reason for document rejection..."
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  className="text-xs px-3 py-1.5 bg-white border border-rose-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 w-full sm:w-64"
                />
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={!rejectionReasonInput.trim() || isProcessing}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  Confirm Reject
                </button>
                <button
                  type="button"
                  onClick={() => setIsRejecting(false)}
                  className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
