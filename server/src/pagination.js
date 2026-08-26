const { q, qa } = require('./db');

/**
 * Paginated query helper.
 * Usage: paginate('SELECT ... WHERE ...', params, req.query)
 * Returns: { data, total, page, limit, totalPages }
 */
async function paginate(baseQuery, params, query = {}, opts = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || opts.defaultLimit || 50), opts.maxLimit || 200);
  const offset = (page - 1) * limit;

  const countQuery = baseQuery.replace(/SELECT\s+[\s\S]*?\s+FROM/i, 'SELECT COUNT(*) AS total FROM').replace(/ORDER BY\s+[\s\S]*$/i, '');
  const countResult = await q(countQuery, params);
  const total = Number(countResult?.total || 0);

  const dataQuery = `${baseQuery} LIMIT ? OFFSET ?`;
  const data = await qa(dataQuery, [...params, limit, offset]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = { paginate };
