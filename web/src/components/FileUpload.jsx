import { useState, useRef } from 'react';
import { Upload, X, Check, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

export default function FileUpload({ folder = 'general', accept, onUpload, className, label, compact }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(false);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api(`/uploads/file?folder=${folder}`, { method: 'POST', body: form, raw: true });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      onUpload?.(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (compact) {
    return (
      <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <input ref={inputRef} type="file" accept={accept} onChange={handleFile} style={{ display: 'none' }} id={`upload-${folder}`} />
        <label htmlFor={`upload-${folder}`} className="btn btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
          {uploading ? <Loader2 size={13} className="spin" /> : success ? <Check size={13} style={{ color: 'var(--accent-2)' }} /> : <Upload size={13} />}
          {label || 'Upload'}
        </label>
        {error && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</span>}
      </span>
    );
  }

  return (
    <div className={className}>
      <input ref={inputRef} type="file" accept={accept} onChange={handleFile} style={{ display: 'none' }} id={`upload-${folder}`} />
      <label htmlFor={`upload-${folder}`} className="btn" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {uploading ? <Loader2 size={14} className="spin" /> : success ? <Check size={14} style={{ color: 'var(--accent-2)' }} /> : <Upload size={14} />}
        {uploading ? 'Uploading…' : success ? 'Uploaded!' : label || 'Choose file'}
      </label>
      {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}
