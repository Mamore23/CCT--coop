/**
 * Document Utilities for Cooperative Management System
 * Provides helpers for file formatting, categorization, type checking, and size computation.
 */

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) {
    return 'Size not specified';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isPdfFile(fileType?: string, fileDataUrl?: string, fileName?: string): boolean {
  if (fileType && (fileType.includes('pdf') || fileType === 'application/pdf')) return true;
  if (fileName && fileName.toLowerCase().endsWith('.pdf')) return true;
  if (fileDataUrl && fileDataUrl.startsWith('data:application/pdf')) return true;
  return false;
}

export function isImageFile(fileType?: string, fileDataUrl?: string, fileName?: string): boolean {
  if (fileType && (fileType.startsWith('image/') || ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(fileType))) {
    return true;
  }
  if (fileName) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.gif')) {
      return true;
    }
  }
  if (fileDataUrl && fileDataUrl.startsWith('data:image/')) return true;
  return false;
}

export function getFileTypeLabel(fileType?: string, fileName?: string, fileDataUrl?: string): string {
  if (isPdfFile(fileType, fileDataUrl, fileName)) return 'PDF Document';
  if (isImageFile(fileType, fileDataUrl, fileName)) {
    if (fileType?.includes('png') || fileName?.toLowerCase().endsWith('.png')) return 'PNG Image';
    if (fileType?.includes('jpeg') || fileType?.includes('jpg') || fileName?.toLowerCase().endsWith('.jpg') || fileName?.toLowerCase().endsWith('.jpeg')) return 'JPEG Image';
    if (fileType?.includes('webp') || fileName?.toLowerCase().endsWith('.webp')) return 'WebP Image';
    return 'Image';
  }
  if (fileName) {
    const ext = fileName.split('.').pop();
    if (ext && ext.length <= 5) return `${ext.toUpperCase()} File`;
  }
  return 'Document Attachment';
}

export function formatDocumentCategory(category?: string): string {
  if (!category) return 'Supporting Document';
  const cat = category.toUpperCase().trim();
  const map: Record<string, string> = {
    GOV_ID: 'Government-Issued ID',
    GOVERNMENT_ID: 'Government-Issued ID',
    'GOVERNMENT ID': 'Government-Issued ID',
    SELFIE: 'Applicant Selfie Verification',
    SELFIE_PHOTO: 'Applicant Selfie Verification',
    'SELFIE PHOTO': 'Applicant Selfie Verification',
    INCOME_PROOF: 'Proof of Income / Payslip',
    PROOF_OF_INCOME: 'Proof of Income / Payslip',
    'PROOF OF INCOME': 'Proof of Income / Payslip',
    PAYSLIP: 'Proof of Income / Payslip',
    BILLING: 'Proof of Billing / Utility Bill',
    PROOF_OF_BILLING: 'Proof of Billing / Utility Bill',
    'PROOF OF BILLING': 'Proof of Billing / Utility Bill',
    LOAN_AGREEMENT: 'Loan Contract / Promissory Note',
    CO_MAKER_ID: 'Co-Maker Valid ID',
    COLLATERAL_PROOF: 'Collateral Ownership / Title',
    BARANGAY_CLEARANCE: 'Barangay Clearance Certificate',
    OTHER: 'Additional Supporting Document'
  };

  return map[cat] || category.replace(/_/g, ' ');
}
