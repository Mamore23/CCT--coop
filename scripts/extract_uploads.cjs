const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));

function extractDataUrl(val, fallbackName = 'file') {
  if (typeof val !== 'string' || !val.startsWith('data:')) return val;
  const match = val.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return val;
  const mime = match[1];
  const b64 = match[2];
  const ext = mime.includes('pdf') ? 'pdf' : mime.includes('png') ? 'png' : 'jpg';
  const hash = crypto.createHash('md5').update(b64).digest('hex').substring(0, 16);
  const filename = fallbackName + '_' + hash + '.' + ext;
  const filepath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
  }
  return '/uploads/' + filename;
}

let converted = 0;
for (const m of db.members || []) {
  if (m.govIdUrl && m.govIdUrl.startsWith('data:')) { m.govIdUrl = extractDataUrl(m.govIdUrl, 'govid'); converted++; }
  if (m.selfieUrl && m.selfieUrl.startsWith('data:')) { m.selfieUrl = extractDataUrl(m.selfieUrl, 'selfie'); converted++; }
  if (m.supportingDocUrl && m.supportingDocUrl.startsWith('data:')) { m.supportingDocUrl = extractDataUrl(m.supportingDocUrl, 'supp'); converted++; }
  if (m.initialShareCapitalReceiptUrl && m.initialShareCapitalReceiptUrl.startsWith('data:')) { m.initialShareCapitalReceiptUrl = extractDataUrl(m.initialShareCapitalReceiptUrl, 'receipt'); converted++; }
}

for (const d of db.memberDocuments || []) {
  if (d.fileDataUrl && d.fileDataUrl.startsWith('data:')) { d.fileDataUrl = extractDataUrl(d.fileDataUrl, 'doc'); converted++; }
}

for (const a of db.loanApplications || []) {
  for (const doc of a.documents || []) {
    if (doc.fileDataUrl && doc.fileDataUrl.startsWith('data:')) { doc.fileDataUrl = extractDataUrl(doc.fileDataUrl, 'loandoc'); converted++; }
  }
}

for (const p of db.paymentRequests || []) {
  if (p.proofOfPaymentUrl && p.proofOfPaymentUrl.startsWith('data:')) { p.proofOfPaymentUrl = extractDataUrl(p.proofOfPaymentUrl, 'payproof'); converted++; }
}

console.log('Converted data URLs:', converted);
const newJson = JSON.stringify(db, null, 2);
console.log('New database size:', (newJson.length / 1024).toFixed(2), 'KB');
fs.writeFileSync('database.json', newJson, 'utf8');
