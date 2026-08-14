const express = require('express');
const { authenticate, requireRole } = require('../auth');
const { asyncH, audit } = require('../utils');
const scales = require('../grading/scales');

const router = express.Router();
router.use(authenticate);

const READ = ['super_admin', 'school_admin', 'principal', 'assistant_principal', 'registrar', 'teacher', 'guidance'];
const WRITE = ['super_admin', 'school_admin'];

router.get('/config', requireRole(...READ), asyncH(async (req, res) => {
  const scale = await scales.getDefaultScale();
  res.json({ scale, weights: scale.weights });
}));

router.get('/scales', requireRole(...READ), asyncH(async (req, res) => {
  const all = await scales.listScales();
  const def = await scales.getDefaultScale();
  res.json({ data: all, default_id: def ? def.id : null });
}));

router.get('/scales/:id', requireRole(...READ), asyncH(async (req, res) => {
  const scale = await scales.getScale(req.params.id);
  if (!scale) return res.status(404).json({ error: 'Scale not found' });
  res.json(scale);
}));

router.post('/scales', requireRole(...WRITE), asyncH(async (req, res) => {
  const scale = await scales.createScale(req.body || {});
  await audit(req, 'GRADING_SCALE_CREATE', 'grading_scales', scale.id, { code: scale.code, name: scale.name });
  res.status(201).json(scale);
}));

router.put('/scales/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  const scale = await scales.updateScale(req.params.id, req.body || {});
  await audit(req, 'GRADING_SCALE_UPDATE', 'grading_scales', scale.id, { code: scale.code, name: scale.name });
  res.json(scale);
}));

router.delete('/scales/:id', requireRole(...WRITE), asyncH(async (req, res) => {
  await scales.deleteScale(req.params.id);
  await audit(req, 'GRADING_SCALE_DELETE', 'grading_scales', req.params.id, {});
  res.json({ ok: true });
}));

router.post('/scales/:id/set-default', requireRole(...WRITE), asyncH(async (req, res) => {
  const scale = await scales.setDefault(req.params.id);
  await audit(req, 'GRADING_SCALE_SET_DEFAULT', 'grading_scales', scale.id, { code: scale.code });
  res.json(scale);
}));

router.post('/convert', requireRole(...READ), asyncH(async (req, res) => {
  const b = req.body || {};
  if (b.value === undefined || b.value === '') {
    return res.status(400).json({ error: 'value is required' });
  }
  const scale = b.scale_id ? await scales.getScale(b.scale_id) : await scales.getDefaultScale();
  if (!scale) return res.status(404).json({ error: 'Scale not found' });
  res.json({ value: Number(b.value), scale: { id: scale.id, code: scale.code, name: scale.name, scale_type: scale.scale_type, passing_grade: scale.passing_grade }, result: scales.convertGrade(b.value, scale) });
}));

module.exports = router;
