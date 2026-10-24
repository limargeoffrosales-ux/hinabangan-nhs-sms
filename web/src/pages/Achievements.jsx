import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { api, fileUrl } from '../lib/api';
import { subscribeLive } from '../lib/realtime';
import {
  Heart, MessageCircle, Pin, Search, Plus, X,
  Film, Send, Trash2, Edit3, Globe, Lock, Users,
  Loader2
} from 'lucide-react';
import { PageHead, Empty, Spinner, Modal, ConfirmModal } from '../components/ui';
import FileUpload from '../components/FileUpload';

const CATEGORIES = [
  { value: 'general', labelKey: 'achievements.categoryGeneral', color: '#6b7280' },
  { value: 'academic', labelKey: 'achievements.categoryAcademic', color: '#3b82f6' },
  { value: 'sports', labelKey: 'achievements.categorySports', color: '#10b981' },
  { value: 'arts', labelKey: 'achievements.categoryArts', color: '#8b5cf6' },
  { value: 'community', labelKey: 'achievements.categoryCommunity', color: '#f59e0b' },
  { value: 'competition', labelKey: 'achievements.categoryCompetition', color: '#ef4444' },
  { value: 'milestone', labelKey: 'achievements.categoryMilestone', color: '#ec4899' },
];

const VISIBILITY_OPTIONS = [
  { value: 'school', labelKey: 'achievements.visSchool', icon: Users },
  { value: 'staff', labelKey: 'achievements.visStaff', icon: Lock },
  { value: 'public', labelKey: 'achievements.visPublic', icon: Globe },
];

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const secs = Math.floor((now - d) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function PostCard({ post, user, onLike, onEdit, onDelete, t }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(post.comments || []);
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cat = CATEGORIES.find(c => c.value === post.category);

  const loadComments = useCallback(async () => {
    if (showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const res = await api(`/achievements/${post.id}/comments`);
        setComments(res.data || []);
      } catch {}
      setLoadingComments(false);
    }
  }, [showComments, post.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadComments(); }, [loadComments]);

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api(`/achievements/${post.id}/comments`, {
        method: 'POST', body: { content: commentText.trim() }
      });
      setComments(prev => [...prev, res]);
      setCommentText('');
    } catch {}
    setSubmitting(false);
  };

  const deleteComment = async (commentId) => {
    try {
      await api(`/achievements/${post.id}/comments/${commentId}`, { method: 'DELETE' });
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {}
  };

  const media = post.media || [];
  const canEdit = user?.role === 'super_admin' || user?.role === 'school_admin' || post.author_id === user?.id;

  return (
    <div style={styles.card}>
      {post.pinned ? <div style={styles.pinnedBadge}><Pin size={12} /> {t('achievements.pinned')}</div> : null}
      <div style={styles.cardHeader}>
        <div style={styles.avatar}>{initials(post.author_name)}</div>
        <div style={styles.headerInfo}>
          <div style={styles.authorName}>{post.author_name || 'Unknown'}</div>
          <div style={styles.meta}>
            {cat ? <span style={{ ...styles.categoryDot, background: cat.color }} /> : null}
            <span>{cat ? t(cat.labelKey) : post.category}</span>
            <span style={styles.dot}>·</span>
            <span>{timeAgo(post.created_at)}</span>
          </div>
        </div>
        {canEdit ? (
          <div style={styles.actions}>
            <button onClick={() => onEdit(post)} style={styles.iconBtn} title={t('achievements.editPost')}>
              <Edit3 size={16} />
            </button>
            <button onClick={() => onDelete(post)} style={styles.iconBtn} title={t('achievements.deletePost')}>
              <Trash2 size={16} />
            </button>
          </div>
        ) : null}
      </div>

      <h3 style={styles.postTitle}>{post.title}</h3>
      {post.content ? <p style={styles.postContent}>{post.content}</p> : null}

      {media.length > 0 ? (
        <div style={styles.mediaGrid}>
          {media.map((m, i) => (
            <div key={i} style={styles.mediaItem}>
              {m.type === 'video' || (m.url && /\.(mp4|webm|ogg)$/i.test(m.url)) ? (
                <video src={fileUrl(m.url)} controls style={styles.video} preload="metadata" />
              ) : (
                <img src={fileUrl(m.url)} alt={m.name || 'Achievement'} style={styles.image} loading="lazy" />
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div style={styles.cardFooter}>
        <button
          onClick={() => onLike(post.id)}
          style={{ ...styles.reactionBtn, color: post.user_liked ? '#ef4444' : undefined }}
        >
          <Heart size={18} fill={post.user_liked ? '#ef4444' : 'none'} />
          <span>{post.likes_count || 0}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          style={styles.reactionBtn}
        >
          <MessageCircle size={18} />
          <span>{post.comments_count || 0}</span>
        </button>
      </div>

      {showComments ? (
        <div style={styles.commentsSection}>
          {loadingComments ? <Spinner /> : null}
          {comments.map(c => (
            <div key={c.id} style={styles.comment}>
              <div style={styles.commentAvatar}>{initials(c.author_name)}</div>
              <div style={styles.commentBody}>
                <span style={styles.commentAuthor}>{c.author_name}</span>
                <span style={styles.commentText}>{c.content}</span>
                <span style={styles.commentTime}>{timeAgo(c.created_at)}</span>
              </div>
              {(c.author_id === user?.id || user?.role === 'super_admin') ? (
                <button onClick={() => deleteComment(c.id)} style={styles.commentDelete}>
                  <Trash2 size={12} />
                </button>
              ) : null}
            </div>
          ))}
          {comments.length === 0 && !loadingComments ? (
            <div style={styles.noComments}>{t('achievements.noComments')}</div>
          ) : null}
          <div style={styles.commentInput}>
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitComment()}
              placeholder={t('achievements.addComment')}
              style={styles.commentField}
            />
            <button onClick={submitComment} disabled={submitting || !commentText.trim()} style={styles.commentSend}>
              <Send size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Achievements() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'general', visibility: 'school', pinned: false, media: [] });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const canWrite = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher'].includes(user?.role);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter !== 'all') params.set('category', filter);
      if (search) params.set('search', search);
      const res = await api(`/achievements?${params}`);
      setPosts(res.data || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [filter, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return subscribeLive((msg) => {
      if (msg.type === 'achievement') load();
    });
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', content: '', category: 'general', visibility: 'school', pinned: false, media: [] });
    setShowForm(true);
  };

  const openEdit = (post) => {
    setEditing(post);
    setForm({
      title: post.title, content: post.content || '', category: post.category,
      visibility: post.visibility, pinned: post.pinned, media: post.media || []
    });
    setShowForm(true);
  };

  const savePost = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api(`/achievements/${editing.id}`, { method: 'PATCH', body: form });
      } else {
        await api('/achievements', { method: 'POST', body: form });
      }
      setShowForm(false);
      load();
    } catch {}
    setSaving(false);
  };

  const deletePost = async (post) => {
    try {
      await api(`/achievements/${post.id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      load();
    } catch {}
  };

  const handleLike = async (id) => {
    try {
      const res = await api(`/achievements/${id}/like`, { method: 'POST' });
      setPosts(prev => prev.map(p => p.id === id ? {
        ...p,
        user_liked: res.liked ? 1 : 0,
        likes_count: res.liked ? (p.likes_count || 0) + 1 : Math.max(0, (p.likes_count || 0) - 1)
      } : p));
    } catch {}
  };

  const onUploadMedia = (file) => {
    setForm(prev => ({ ...prev, media: [...prev.media, { url: file.url || `/api/v1/uploads/file/${file.key}`, type: file.name?.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image', name: file.name }] }));
  };

  const removeMedia = (idx) => {
    setForm(prev => ({ ...prev, media: prev.media.filter((_, i) => i !== idx) }));
  };

  return (
    <div>
      <PageHead title={t('achievements.title')} sub={t('achievements.subtitle')}>
        {canWrite ? (
          <button onClick={openNew} className="btn btn-primary">
            <Plus size={16} /> {t('achievements.newPost')}
          </button>
        ) : null}
      </PageHead>

      <div style={styles.toolbar}>
        <div style={styles.filters}>
          <button
            onClick={() => setFilter('all')}
            style={{ ...styles.filterBtn, ...(filter === 'all' ? styles.filterActive : {}) }}
          >
            {t('achievements.filterAll')}
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setFilter(c.value)}
              style={{ ...styles.filterBtn, ...(filter === c.value ? styles.filterActive : {}) }}
            >
              <span style={{ ...styles.filterDot, background: c.color }} />
              {t(c.labelKey)}
            </button>
          ))}
        </div>
        <div style={styles.searchWrap}>
          <Search size={16} style={styles.searchIcon} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('achievements.searchPlaceholder')}
            style={styles.searchInput}
          />
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingWrap}>
          {[1, 2, 3].map(i => (
            <div key={i} style={styles.card}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e5e7eb' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: 140, height: 14, background: '#e5e7eb', borderRadius: 4, marginBottom: 6 }} />
                  <div style={{ width: 90, height: 10, background: '#e5e7eb', borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ width: '100%', height: 14, background: '#e5e7eb', borderRadius: 4, marginBottom: 6 }} />
              <div style={{ width: '80%', height: 14, background: '#e5e7eb', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ color: '#ef4444', padding: 24, textAlign: 'center' }}>{error}</div>
      ) : posts.length === 0 ? (
        <Empty text={t('achievements.noData')} />
      ) : (
        <div style={styles.feed}>
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              user={user}
              onLike={handleLike}
              onEdit={openEdit}
              onDelete={setConfirmDelete}
              t={t}
            />
          ))}
        </div>
      )}

      {showForm ? (
        <Modal onClose={() => setShowForm(false)} wide>
          <h2 style={styles.formTitle}>{editing ? t('achievements.editPost') : t('achievements.newPost')}</h2>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('achievements.postTitle')}</label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              style={styles.input}
              maxLength={200}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('achievements.postContent')}</label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              style={{ ...styles.input, minHeight: 100, resize: 'vertical' }}
              placeholder={t('achievements.postContentPlaceholder')}
            />
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('achievements.category')}</label>
              <div style={styles.catGrid}>
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setForm({ ...form, category: c.value })}
                    style={{
                      ...styles.catBtn,
                      borderColor: form.category === c.value ? c.color : '#e5e7eb',
                      background: form.category === c.value ? `${c.color}11` : 'white',
                      color: form.category === c.value ? c.color : '#374151',
                    }}
                  >
                    <span style={{ ...styles.catDot, background: c.color }} />
                    {t(c.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('achievements.visibility')}</label>
              <div style={styles.visGrid}>
                {VISIBILITY_OPTIONS.map(v => {
                  const Icon = v.icon;
                  return (
                    <button
                      key={v.value}
                      onClick={() => setForm({ ...form, visibility: v.value })}
                      style={{
                        ...styles.visBtn,
                        borderColor: form.visibility === v.value ? '#3b82f6' : '#e5e7eb',
                        background: form.visibility === v.value ? '#eff6ff' : 'white',
                      }}
                    >
                      <Icon size={14} /> {t(v.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={e => setForm({ ...form, pinned: e.target.checked })}
                style={{ marginRight: 6 }}
              />
              {t('achievements.pinPost')}
            </label>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('achievements.media')}</label>
            {form.media.length > 0 ? (
              <div style={styles.mediaPreview}>
                {form.media.map((m, i) => (
                  <div key={i} style={styles.mediaThumb}>
                    {m.type === 'video' ? (
                      <Film size={24} style={{ color: '#8b5cf6' }} />
                    ) : (
                      <img src={fileUrl(m.url)} alt="" style={styles.thumbImg} />
                    )}
                    <button onClick={() => removeMedia(i)} style={styles.removeMedia}><X size={12} /></button>
                  </div>
                ))}
              </div>
            ) : null}
            <FileUpload
              folder="achievements"
              accept="image/*,video/mp4,video/webm,video/ogg"
              onUpload={onUploadMedia}
              label={t('achievements.mediaHint')}
              compact
            />
          </div>

          <div style={styles.formActions}>
            <button onClick={() => setShowForm(false)} className="btn">{t('common.cancel')}</button>
            <button onClick={savePost} disabled={saving || !form.title.trim()} className="btn btn-primary">
              {saving ? <Loader2 size={16} className="spin" /> : null}
              {editing ? t('common.save') : t('achievements.publish')}
            </button>
          </div>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <ConfirmModal
          open
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => deletePost(confirmDelete)}
          title={t('achievements.deletePost')}
          message={t('achievements.deleteConfirm')}
          confirmLabel={t('common.delete')}
          danger
        />
      ) : null}
    </div>
  );
}

const styles = {
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  filters: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  filterBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px',
    borderRadius: 20, border: '1px solid #e5e7eb', background: 'white',
    fontSize: 13, cursor: 'pointer', color: '#6b7280', transition: 'all 0.15s',
  },
  filterActive: { background: '#1e40af', color: 'white', borderColor: '#1e40af' },
  filterDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  searchWrap: { position: 'relative', flexShrink: 0 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' },
  searchInput: {
    padding: '8px 12px 8px 34px', border: '1px solid #e5e7eb', borderRadius: 8,
    fontSize: 13, width: 220, outline: 'none',
  },
  feed: { display: 'flex', flexDirection: 'column', gap: 16 },
  loadingWrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: {
    background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
    padding: 20, position: 'relative',
  },
  pinnedBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 8px', borderRadius: 4, background: '#fef3c7',
    color: '#92400e', fontSize: 11, fontWeight: 600, marginBottom: 8,
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0,
  },
  headerInfo: { flex: 1, minWidth: 0 },
  authorName: { fontWeight: 600, fontSize: 14, color: '#111827' },
  meta: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af', marginTop: 2 },
  categoryDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  dot: { color: '#d1d5db' },
  actions: { display: 'flex', gap: 4 },
  iconBtn: {
    padding: 6, borderRadius: 6, border: 'none', background: 'transparent',
    color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center',
  },
  postTitle: { fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 8px' },
  postContent: { fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' },
  mediaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 12 },
  mediaItem: { borderRadius: 8, overflow: 'hidden', background: '#f3f4f6', aspectRatio: '4/3' },
  image: { width: '100%', height: '100%', objectFit: 'cover' },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  cardFooter: {
    display: 'flex', gap: 8, marginTop: 12, paddingTop: 12,
    borderTop: '1px solid #f3f4f6',
  },
  reactionBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', borderRadius: 20, border: '1px solid #e5e7eb',
    background: 'white', fontSize: 13, color: '#6b7280', cursor: 'pointer',
    transition: 'all 0.15s',
  },
  commentsSection: { marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' },
  comment: {
    display: 'flex', gap: 8, marginBottom: 10, position: 'relative',
  },
  commentAvatar: {
    width: 28, height: 28, borderRadius: '50%', background: '#e5e7eb',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 700, color: '#6b7280', flexShrink: 0,
  },
  commentBody: {
    background: '#f9fafb', borderRadius: 8, padding: '6px 10px', flex: 1,
    fontSize: 13,
  },
  commentAuthor: { fontWeight: 600, color: '#111827', marginRight: 6 },
  commentText: { color: '#374151' },
  commentTime: { display: 'block', fontSize: 11, color: '#9ca3af', marginTop: 2 },
  commentDelete: {
    position: 'absolute', top: 4, right: 0, padding: 2,
    border: 'none', background: 'transparent', color: '#d1d5db',
    cursor: 'pointer', opacity: 0.6,
  },
  noComments: { fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '8px 0' },
  commentInput: { display: 'flex', gap: 8, marginTop: 8 },
  commentField: {
    flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 20,
    fontSize: 13, outline: 'none',
  },
  commentSend: {
    width: 36, height: 36, borderRadius: '50%', border: 'none',
    background: '#3b82f6', color: 'white', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  formTitle: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  formGroup: { marginBottom: 16 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: {
    width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  catGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  catBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
    background: 'white', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
  },
  catDot: { width: 8, height: 8, borderRadius: '50%' },
  visGrid: { display: 'flex', gap: 6 },
  visBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
    background: 'white', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
  },
  mediaPreview: { display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  mediaThumb: {
    width: 80, height: 80, borderRadius: 8, overflow: 'hidden',
    position: 'relative', background: '#f3f4f6',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  removeMedia: {
    position: 'absolute', top: 2, right: 2, width: 20, height: 20,
    borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
};
