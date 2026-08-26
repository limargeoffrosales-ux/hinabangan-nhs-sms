import { useState, useRef } from 'react';
import { Upload, Check, Loader2 } from 'lucide-react';

export default function FileUpload({ folder = 'general', accept, onUpload, className, label, compact }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);
    setSuccess(false);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/v1/uploads/file?folder=${folder}`);
        const token = localStorage.getItem('meridianed_token');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) resolve(json);
            else reject(new Error(json.error || 'Upload failed'));
          } catch { reject(new Error('Invalid response from server')); }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(form);
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      onUpload?.(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      setProgress(0);
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
        {uploading ? `Uploading\u2026 ${progress}%` : success ? 'Uploaded!' : label || 'Choose file'}
      </label>
      {uploading && (
        <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'var(--border, #e2e8f0)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent, #1e3a5f)', borderRadius: 2, transition: 'width 0.2s' }} />
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}
