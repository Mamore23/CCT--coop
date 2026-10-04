import React, { useState } from 'react';
import {
  FileText,
  Eye,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Check,
  X,
  FileQuestion,
  Inbox
} from 'lucide-react';
import { MemberDocument } from '../types';
import { DocumentViewerModal, ViewerDocument } from './DocumentViewerModal';
import {
  formatFileSize,
  getFileTypeLabel,
  isPdfFile,
  isImageFile,
  formatDocumentCategory
} from '../utils/documentUtils';

interface SubmittedDocumentsSectionProps {
  memberId: string;
  memberName: string;
  documents?: MemberDocument[];
  memberStatus?: string;
  token?: string;
  onDocumentStatusChange?: (docId: string, status: 'VERIFIED' | 'REJECTED', notes?: string) => void;
  canReview?: boolean;
}

export const SubmittedDocumentsSection: React.FC<SubmittedDocumentsSectionProps> = ({
  memberId,
  memberName,
  documents = [],
  memberStatus = 'PENDING',
  token,
  onDocumentStatusChange,
  canReview = true
}) => {
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<ViewerDocument | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const docsList = documents || [];

  const handleOpenPreview = (doc: MemberDocument) => {
    setSelectedDocForPreview({
      id: doc.id,
      fileName: doc.fileName || 'document.jpg',
      fileType: doc.fileType || (doc.fileDataUrl?.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg'),
      fileDataUrl: doc.fileDataUrl,
      fileSize: doc.fileSize,
      documentCategory: doc.documentCategory,
      documentType: doc.documentCategory,
      status: doc.status || 'PENDING',
      uploadedAt: doc.uploadedAt,
      notes: doc.notes,
      rejectionReason: doc.notes,
      memberName: doc.memberName || memberName,
      memberId: doc.memberId || memberId
    });
  };

  const handleQuickStatus = async (docId: string, status: 'VERIFIED' | 'REJECTED', notes?: string) => {
    if (token) {
      try {
        await fetch(`/api/documents/review/${docId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ status, notes })
        });
      } catch (err) {
        console.error('Error reviewing document:', err);
      }
    }
    if (onDocumentStatusChange) {
      onDocumentStatusChange(docId, status, notes);
    }
    // Update active preview state if open
    if (selectedDocForPreview && selectedDocForPreview.id === docId) {
      setSelectedDocForPreview(prev => prev ? { ...prev, status, notes } : null);
    }
    setRejectingDocId(null);
    setRejectReason('');
  };

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200" id="section-submitted-documents">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-indigo-100">
            <FileText size={18} />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              SUBMITTED DOCUMENTS
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {docsList.length}
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Registration and identity verification files uploaded by member applicant: <strong>{memberName}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
            <ShieldCheck size={12} />
            Member Registration Records
          </span>
        </div>
      </div>

      {/* Documents Grid / Empty State */}
      {docsList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docsList.map((doc, idx) => {
            const isPdf = isPdfFile(doc.fileType, doc.fileDataUrl, doc.fileName);
            const isImage = isImageFile(doc.fileType, doc.fileDataUrl, doc.fileName);
            const typeLabel = getFileTypeLabel(doc.fileType, doc.fileName, doc.fileDataUrl);
            const categoryLabel = formatDocumentCategory(doc.documentCategory);
            const sizeLabel = formatFileSize(doc.fileSize || (doc.fileDataUrl ? Math.round(doc.fileDataUrl.length * 0.75) : undefined));
            const status = (doc.status || 'PENDING').toUpperCase();

            return (
              <div
                key={doc.id || idx}
                className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top: Badges & Title */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold text-emerald-700 font-mono uppercase bg-emerald-50 px-2.5 py-0.5 rounded-md border border-indigo-100 truncate max-w-[170px]" title={categoryLabel}>
                      {categoryLabel}
                    </span>
                    <span
                      className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0 ${
                        status === 'VERIFIED' || status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {status === 'VERIFIED' || status === 'APPROVED' ? (
                        <CheckCircle2 size={10} />
                      ) : status === 'REJECTED' ? (
                        <AlertCircle size={10} />
                      ) : (
                        <Clock size={10} />
                      )}
                      {status}
                    </span>
                  </div>

                  <div>
                    <h5 className="font-bold text-slate-800 text-xs truncate" title={doc.fileName}>
                      {doc.fileName}
                    </h5>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-1">
                      <span>{typeLabel}</span>
                      <span>•</span>
                      <span>{sizeLabel}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Uploaded: {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'At Registration'}
                    </p>
                  </div>

                  {/* Notes / Rejection Reason if any */}
                  {doc.notes && (
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-100 text-[10px] text-rose-700">
                      <strong>Staff Note: </strong>{doc.notes}
                    </div>
                  )}
                </div>

                {/* Card Middle: Preview Thumbnail Box */}
                <div className="px-4 pb-2">
                  <div
                    onClick={() => handleOpenPreview(doc)}
                    className="relative group/thumb rounded-xl overflow-hidden border border-slate-200 bg-slate-50 h-32 flex items-center justify-center cursor-pointer transition-transform hover:scale-[1.01]"
                    title="Click to open preview"
                  >
                    {!doc.fileDataUrl ? (
                      <div className="flex flex-col items-center gap-1 text-slate-400 text-center p-2">
                        <FileQuestion size={24} />
                        <span className="text-[10px] font-mono">No visual preview</span>
                      </div>
                    ) : isPdf ? (
                      <div className="flex flex-col items-center gap-1.5 p-3 text-center">
                        <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                          <FileText size={26} />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 truncate max-w-[140px]">{doc.fileName}</span>
                        <span className="text-[9px] font-mono text-rose-600 font-semibold uppercase">PDF Document</span>
                      </div>
                    ) : isImage ? (
                      <img
                        src={doc.fileDataUrl}
                        alt={doc.fileName}
                        className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105 duration-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 p-3 text-center">
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                          <FileText size={26} />
                        </div>
                        <span className="text-[10px] font-mono text-slate-600 uppercase">{typeLabel}</span>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center gap-2 transition-all duration-200">
                      <span className="px-3 py-1.5 bg-white text-slate-900 font-bold text-xs rounded-xl shadow-md flex items-center gap-1">
                        <Eye size={13} /> View
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions: [VIEW] and [DOWNLOAD] */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(doc)}
                      className="flex-1 py-1.5 px-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-indigo-300 text-emerald-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Eye size={13} /> View
                    </button>

                    {doc.fileDataUrl && (
                      <a
                        href={doc.fileDataUrl}
                        download={doc.fileName}
                        className="py-1.5 px-3 bg-slate-200/70 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Download file directly"
                      >
                        <Download size={13} /> Download
                      </a>
                    )}
                  </div>

                  {/* Staff Review Verdict for this Document */}
                  {canReview && (
                    <div className="pt-1.5 border-t border-slate-200/60">
                      {rejectingDocId === doc.id ? (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            placeholder="Rejection reason e.g. 'Blurred or illegible'..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-full text-[11px] px-2.5 py-1 bg-white border border-rose-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
                          />
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => { setRejectingDocId(null); setRejectReason(''); }}
                              className="text-[10px] text-slate-500 hover:text-slate-800 px-2 py-0.5"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickStatus(doc.id, 'REJECTED', rejectReason || 'Document requires re-submission')}
                              disabled={!rejectReason.trim()}
                              className="text-[10px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded disabled:opacity-50 cursor-pointer"
                            >
                              Confirm Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[10px] font-mono text-slate-400">Review:</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuickStatus(doc.id, 'VERIFIED')}
                              className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 rounded font-semibold text-[10px] transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Check size={10} /> Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRejectingDocId(doc.id); setRejectReason(''); }}
                              className="px-2 py-0.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded font-semibold text-[10px] transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <X size={10} /> Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty Documents Notice */
        <div className="p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
          <Inbox size={32} className="text-slate-400 mx-auto" />
          <h5 className="font-bold text-slate-700 text-sm">No Submitted Documents</h5>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No registration or identity verification documents were attached to this member account.
            If required, you can use the action buttons below to set the status to <em>Revision / Additional Requirements Requested</em> to notify the member.
          </p>
        </div>
      )}

      {/* POPUP DOCUMENT VIEWER MODAL */}
      <DocumentViewerModal
        isOpen={!!selectedDocForPreview}
        onClose={() => setSelectedDocForPreview(null)}
        document={selectedDocForPreview}
        title="SUBMITTED DOCUMENT"
        canReview={canReview}
        onStatusAction={async (status, reason) => {
          if (selectedDocForPreview?.id) {
            await handleQuickStatus(selectedDocForPreview.id, status === 'APPROVED' ? 'VERIFIED' : status, reason);
          }
        }}
      />
    </div>
  );
};
