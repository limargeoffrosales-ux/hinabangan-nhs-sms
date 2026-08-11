import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, Bot, User, Loader2, Wand2 } from 'lucide-react';
import { api } from '../lib/api';

const SUGGESTIONS = [
  'What are the grade weights for SHS?',
  'Explain PHIL-IRI reading levels',
  'What is DO 13, s. 2023?',
  'Summarize learner risk this quarter',
  'Draft a DLL',
  'Generate a certificate',
  'Ano ang grade weights ng SHS?',
  'Gumawa ka ng DLL',
];

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  async function send(text) {
    const q = (text || input).trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const r = await api('/ai/assistant', { method: 'POST', body: { message: q } });
      setMessages((m) => [...m, { role: 'assistant', content: r.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry — the assistant is unavailable right now. Please try again later.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="assistant-root">
      {open && (
        <div className="assistant-panel">
          <div className="assistant-head">
            <span className="assistant-title"><Sparkles size={15} /> Meridian AI</span>
            <button className="icon-btn" onClick={() => setOpen(false)} title="Close"><X size={15} /></button>
          </div>
          <div className="assistant-list" ref={listRef}>
            {messages.length === 0 && (
              <div className="assistant-empty">
                <p>Your school AI co-pilot. Ask about DepEd policies, draft documents, or request analytics. Maaari ka ring magtanong sa Filipino.</p>
                <div className="assistant-chips">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role === 'user' ? 'msg-user' : 'msg-ai'}`}>
                <span className="msg-icon">{m.role === 'user' ? <User size={12} /> : <Bot size={12} />}</span>
                <span className="msg-text" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
              </div>
            ))}
            {busy && <div className="msg msg-ai"><span className="msg-icon"><Loader2 size={12} className="spin" /></span><span className="msg-text">Thinking...</span></div>}
          </div>
          <div className="assistant-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask Meridian anything..."
            />
            <button className="btn btn-primary btn-sm" onClick={() => send()} disabled={busy || !input.trim()}>
              {busy ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
            </button>
          </div>
          <div className="assistant-foot"><Wand2 size={11} /> Rule-based AI over DepEd knowledge · No learner PII leaves the school</div>
        </div>
      )}
      <button className={`assistant-fab ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} title="Meridian AI Assistant">
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </button>
    </div>
  );
}