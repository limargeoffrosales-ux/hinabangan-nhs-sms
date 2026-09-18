import { useEffect, useState, useCallback } from 'react';
import { MapPin, Building, Shield, Check, X, Save, Edit, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBanner, Empty, Spinner, Badge } from './ui';

export default function WorkImmersionVenues() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: '',
    institution_type: '',
    address: '',
    lat: '',
    lng: '',
    contact_person: '',
    contact_phone: '',
    email: '',
    safety_rating: 'satisfactory',
    security_level: 'medium',
    status: 'active',
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Load venues
  useEffect(() => {
    (async () => {
      try {
        const r = await api('/immersion/tracking/venues?limit=200');
        setVenues(r.data || []);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        // Update existing venue
        await api(`/immersion/tracking/venues/${editingId}`, {
          method: 'PATCH',
          body: { ...form },
        });
        setEditingId(null);
      } else {
        // Create new venue
        await api('/immersion/tracking/venues', {
          method: 'POST',
          body: { ...form },
        });
      }
      setForm({
        name: '',
        institution_type: '',
        address: '',
        lat: '',
        lng: '',
        contact_person: '',
        contact_phone: '',
        email: '',
        safety_rating: 'satisfactory',
        security_level: 'medium',
        status: 'active',
      });
      setShowForm(false);
      setSaving(false);
      // Refresh venues
      const r = await api('/immersion/tracking/venues?limit=200');
      setVenues(r.data || []);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }, [editingId, form]);

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Are you sure you want to delete this venue?')) return;
    try {
      await api(`/immersion/tracking/venues/${id}`, { method: 'DELETE' });
      const r = await api('/immersion/tracking/venues?limit=200');
      setVenues(r.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const institutionTypes = [
    { value: 'school', label: 'School' },
    { value: 'office', label: 'Office' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'laboratory', label: 'Laboratory' },
    { value: 'company', label: 'Company' },
    { value: 'other', label: 'Other' },
  ];

  const safetyRatings = [
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good', selected: true },
    { value: 'satisfactory', label: 'Satisfactory' },
    { value: 'needs_improvement', label: 'Needs Improvement' },
  ];

  const securityLevels = [
    { value: 'low', label: 'Low', selected: true },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];

  return (
    <>
      <ErrorBanner error={error} />

      {/* Form Section */}
      {showForm && (
        <div style={{ marginBottom: 24, padding: 20, border: '1px solid var(--border)', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 16 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{editingId ? 'Edit' : 'Add'} Venue</span>
            <button className="btn btn-sm btn-link" onClick={() => setShowForm(false)}>Close</button>
          </h3>
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
              <div>
                <label>Venue Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={{ width: '100%' }}
                  placeholder="e.g., ABC National High School - Tech Workshop"
                />
              </div>

              <div>
                <label>Institution Type</label>
                <select
                  value={form.institution_type}
                  onChange={(e) => setForm({ ...form, institution_type: e.target.value })}
                  style={{ width: '100%' }}
                >
                  {institutionTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Address</label>
                <input
                  type="text"
                  value={form.address || ''}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  style={{ width: '100%' }}
                  placeholder="Street address"
                />
              </div>

              <div style={{ display: 'grid', gap: 16, gridTemplateAreas: '"lat" "lng"' }}>
                <div>
                  <label>Latitude</label>
                  <input
                    type="number"
                    value={form.lat || ''}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    style={{ width: '100%' }}
                    placeholder="e.g., 14.5995"
                  />
                </div>
                <div>
                  <label>Longitude</label>
                    <input
                      type="number"
                      value={form.lng || ''}
                      onChange={(e) => setForm({ ...form, lng: e.target.value })}
                      style={{ width: '100%' }}
                      placeholder="e.g., 120.9842"
                  />
                </div>
              </div>

              <div>
                <label>Contact Person</label>
                <input
                  type="text"
                  value={form.contact_person || ''}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  style={{ width: '100%' }}
                  placeholder="Person to contact at venue"
                />
              </div>

              <div>
                <label>Contact Phone</label>
                <input
                  type="text"
                  value={form.contact_phone || ''}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  style={{ width: '100%' }}
                  placeholder="e.g., 0912-345-6789"
                />
              </div>

              <div>
                <label>Email</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={{ width: '100%' }}
                  placeholder="contact@venue.edu.ph"
                />
              </div>

              <div>
                <label>Safety Rating</label>
                <select
                  value={form.safety_rating}
                  onChange={(e) => setForm({ ...form, safety_rating: e.target.value })}
                  style={{ width: '100%' }}
                >
                  {safetyRatings.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Security Level</label>
                <select
                  value={form.security_level}
                  onChange={(e) => setForm({ ...form, security_level: e.target.value })}
                  style={{ width: '100%' }}
                >
                  {securityLevels.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" disabled={saving}>
                {editingId ? 'Update' : 'Add Venue'}
              </button>
              <button
                type="button"
                className="btn btn-link text-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Venues Table */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: '0 0 12 0' }}>
          Partner Venues
          {venues.length > 0 && (
            <span style={{ float: 'right', color: 'var(--text-dim)', fontSize: 12 }}>
              Total: {venues.length}
            </span>
          )}
        </h3>

        {loading && <Spinner />}

        {!loading && venues.length === 0 && (
          <Empty
            text="No venues registered. Add one using the form above."
          />)
        }

        {!loading && venues.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Venue Name</th>
                  <th>Type</th>
                  <th>Safety Rating</th>
                  <th>Security Level</th>
                  <th>Status</th>
                  <th>Contact</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name || '—'}</td>
                    <td>{v.institution_type || '—'}</td>
                    <td>
                      <Badge
                        status={v.safety_rating}
                        size="small"
                      >
                        {v.safety_rating}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        status={v.security_level}
                        size="small"
                      >
                        {v.security_level}
                      </Badge>
                    </td>
                    <td>
                      {v.status === 'active' ? (
                        <Badge status="success" size="small">Active</Badge>
                      ) : (
                        <Badge status="critical" size="small">
                          {v.status}
                        </Badge>
                      )}
                    </td>
                    <td>
                      {v.contact_person ? `${v.contact_person} (${v.contact_phone || ''})` : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-sm btn-link text-primary"
                        onClick={() =>
                          setForm({
                            name: v.name || '',
                            institution_type: v.institution_type || '',
                            address: v.address || '',
                            lat: v.lat || '',
                            lng: v.lng || '',
                            contact_person: v.contact_person || '',
                            contact_phone: v.contact_phone || '',
                            email: v.email || '',
                            safety_rating: v.safety_rating || 'satisfactory',
                            security_level: v.security_level || 'medium',
                            status: v.status || 'active',
                          }),
                          setEditingId(v.id)
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-link text-danger"
                        onClick={() => handleDelete(v.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>)
        }
      </div>
    </>
  );
}