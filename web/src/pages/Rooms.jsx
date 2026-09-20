import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, can } from '../lib/auth';
import { PageHead, Badge, Modal, Empty, ErrorBanner, Spinner, ConfirmModal } from '../components/ui';

const ROOM_TYPES = [
  { value: 'classroom', label: 'Classroom', badgeColor: 'blue' },
  { value: 'laboratory', label: 'Laboratory', badgeColor: 'green' },
  { value: 'workshop', label: 'Workshop', badgeColor: 'yellow' },
  { value: 'gymnasium', label: 'Gymnasium', badgeColor: 'red' },
  { value: 'office', label: 'Office', badgeColor: 'gray' },
  { value: 'other', label: 'Other', badgeColor: 'gray' },
];

const TYPE_BADGE_COLOR = Object.fromEntries(ROOM_TYPES.map((r) => [r.value, r.badgeColor]));

const EMPTY_FORM = { code: '', name: '', building: '', floor: 0, capacity: 40, room_type: 'classroom', equipment: '' };

export default function Rooms() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = can(user?.role, 'super_admin', 'school_admin', 'principal', 'assistant_principal');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api('/rooms?limit=300');
      setRows(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(r) {
    setForm({ ...EMPTY_FORM, ...r, equipment: r.equipment || '' });
    setEditing(r.id);
    setShowModal(true);
  }

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    try {
      const body = { ...form, floor: Number(form.floor) || 0, capacity: Number(form.capacity) || 40 };
      if (editing) await api(`/rooms/${editing}`, { method: 'PATCH', body });
      else await api('/rooms', { method: 'POST', body });
      setShowModal(false);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function remove(r) {
    setConfirmAction({ message: t('rooms.deleteConfirm', { name: r.name }), action: async () => {
      try {
        await api(`/rooms/${r.id}`, { method: 'DELETE' });
      } catch (e) {
        setError(e.message);
      } finally {
        load();
      }
    } });
  }

  const filtered = rows.filter((r) => {
    if (typeFilter && r.room_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.code?.toLowerCase().includes(q) && !r.name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <PageHead title={t('rooms.title', 'Room Management')} sub={t('rooms.subtitle', 'Manage school rooms, labs, and facilities')}>
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> {t('rooms.newRoom', 'New Room')}</button>}
      </PageHead>

      <div className="card filters-row" style={{ marginBottom: 12, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          className="input"
          style={{ maxWidth: 220 }}
          placeholder={t('rooms.searchPlaceholder', 'Search by code or name…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" style={{ maxWidth: 180 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">{t('rooms.allTypes', 'All Room Types')}</option>
          {ROOM_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
        </select>
        <button className="btn btn-sm" onClick={load}>{t('common.refresh')}</button>
      </div>

      <ErrorBanner error={error} />

      {loading ? <Spinner /> : filtered.length === 0 ? <Empty text={t('rooms.noData', 'No rooms match the current filters.')} /> : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('rooms.code', 'Code')}</th>
                <th>{t('rooms.name', 'Name')}</th>
                <th>{t('rooms.building', 'Building')}</th>
                <th>{t('rooms.floor', 'Floor')}</th>
                <th>{t('rooms.capacity', 'Capacity')}</th>
                <th>{t('rooms.type', 'Type')}</th>
                <th>{t('rooms.status', 'Status')}</th>
                {canWrite && <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace' }}><strong>{r.code}</strong></td>
                  <td>{r.name}</td>
                  <td className="sub">{r.building || '—'}</td>
                  <td>{r.floor ?? '—'}</td>
                  <td>{r.capacity}</td>
                  <td><Badge status={TYPE_BADGE_COLOR[r.room_type] || 'gray'} /> {ROOM_TYPES.find((rt) => rt.value === r.room_type)?.label || r.room_type}</td>
                  <td><Badge status={r.status === 'inactive' ? 'inactive' : 'active'} /></td>
                  {canWrite && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" onClick={() => openEdit(r)} aria-label="Edit room"><Pencil size={13} aria-hidden="true" /></button>{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => remove(r)} aria-label="Delete room"><Trash2 size={13} aria-hidden="true" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? t('rooms.editRoom', 'Edit Room') : t('rooms.newRoom', 'New Room')}
          sub={t('rooms.roomInfo', 'Room details and capacity information.')}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={save}>
            <div className="form-row">
              <div><label>{t('rooms.code', 'Code')} *</label><input required value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="RM-101" className="input" /></div>
              <div><label>{t('rooms.name', 'Name')} *</label><input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Science Lab 1" className="input" /></div>
            </div>
            <div className="form-row">
              <div><label>{t('rooms.building', 'Building')}</label><input value={form.building || ''} onChange={(e) => set('building', e.target.value)} placeholder="Main Building" className="input" /></div>
              <div><label>{t('rooms.floor', 'Floor')}</label><input type="number" min="0" value={form.floor} onChange={(e) => set('floor', e.target.value)} className="input" /></div>
              <div><label>{t('rooms.capacity', 'Capacity')}</label><input type="number" min="1" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} className="input" /></div>
            </div>
            <div className="form-row">
              <div>
                <label>{t('rooms.type', 'Room Type')}</label>
                <select className="input" value={form.room_type} onChange={(e) => set('room_type', e.target.value)}>
                  {ROOM_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                </select>
              </div>
              <div>
                <label>{t('rooms.status', 'Status')}</label>
                <select className="input" value={form.status || 'active'} onChange={(e) => set('status', e.target.value)}>
                  <option value="active">{t('rooms.active', 'Active')}</option>
                  <option value="inactive">{t('rooms.inactive', 'Inactive')}</option>
                </select>
              </div>
            </div>
            <label>{t('rooms.equipment', 'Equipment Notes')}</label>
            <textarea rows={3} value={form.equipment || ''} onChange={(e) => set('equipment', e.target.value)} placeholder={t('rooms.equipmentPlaceholder', 'e.g. Projector, 40 desks, whiteboard')} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary">{t('rooms.saveRoom', 'Save Room')}</button>
            </div>
          </form>
        </Modal>
      )}
      {confirmAction && <ConfirmModal message={confirmAction.message} danger onConfirm={() => { confirmAction.action(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
    </>
  );
}
