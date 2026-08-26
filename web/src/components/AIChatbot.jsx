import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { api } from '../lib/api';

const CHAT_KEY = 'meridianed_ai_chat';
const MAX_STORED = 100;

const QUICK_PROMPTS = [
  'How do I check student grades?',
  'Explain the grading system',
  'How to enroll a new student?',
  'What is the attendance policy?',
];

function loadMessages() {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_STORED) : [];
  } catch { return []; }
}

function saveMessages(msgs) {
  try { localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-MAX_STORED))); } catch {}
}

export default function AIChatbot() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { saveMessages(messages); }, [messages]);

  useEffect(() => {
    if (open) {
      api('/ai/status').then(r => setEnabled(r.enabled)).catch(() => setEnabled(false));
    }
  }, [open]);

  if (!enabled) return null;

  async function send(content) {
    if (!content.trim() || loading) return;
    const userMsg = { role: 'user', content: content.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await api('/ai/chat', {
        method: 'POST',
        body: { messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })) },
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, AI is unavailable: ' + e.message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          width: 56, height: 56, borderRadius: '50%', border: 'none',
          background: 'var(--accent, #1e3a5f)', color: '#fff',
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="AI Assistant"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 9998,
          width: 380, maxHeight: 520, borderRadius: 16, overflow: 'hidden',
          background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '14px 18px', background: 'var(--accent, #1e3a5f)', color: '#fff',
            fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bot size={18} /> MeridianEd AI Assistant</span>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); localStorage.removeItem(CHAT_KEY); }}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                title="Clear conversation"
              >Clear</button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 14, minHeight: 280, maxHeight: 360 }}>
            {messages.length === 0 && (
              <div style={{ padding: '10px 0' }}>
                <p style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)', marginBottom: 12 }}>
                  Hi! I can help you with grades, enrollment, attendance, and more.
                </p>
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                      marginBottom: 6, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)',
                      background: 'var(--bg, #f8fafc)', cursor: 'pointer', fontSize: 13,
                      color: 'var(--text, #1a1a1a)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, marginBottom: 10,
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: m.role === 'user' ? 'var(--accent-2, #2FD6A0)' : 'var(--accent, #1e3a5f)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {m.role === 'user' ? <User size={14} color="#fff" /> : <Bot size={14} color="#fff" />}
                </div>
                <div style={{
                  maxWidth: '80%', padding: '8px 12px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.5,
                  background: m.role === 'user' ? 'var(--accent, #1e3a5f)' : 'var(--bg, #f1f5f9)',
                  color: m.role === 'user' ? '#fff' : 'var(--text, #1a1a1a)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ fontSize: 13, color: 'var(--text-dim, #6b7280)', padding: '4px 0' }}>
                Thinking...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{
            borderTop: '1px solid var(--border, #e2e8f0)', padding: 10,
            display: 'flex', gap: 8,
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
              placeholder="Ask me anything..."
              disabled={loading}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)',
                fontSize: 13, outline: 'none', background: 'var(--bg, #f8fafc)', color: 'var(--text, #1a1a1a)',
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none',
                background: 'var(--accent, #1e3a5f)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
