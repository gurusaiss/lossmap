// TEST-ONLY: a small adapter speaking the subset of the supabase-js API used by the Edge Function code, executed against a real Postgres
// (the migrated test database, as superuser = service role). It lets the REAL function code run against the REAL schema without a Supabase project.
import pg from 'pg';
pg.types.setTypeParser(20, (v) => Number(v)); // PostgREST returns bigint and numeric as JSON numbers
pg.types.setTypeParser(1700, (v) => Number(v));
const q = (id) => `"${String(id).replace(/"/g, '""')}"`;
function splitCols(str) { const out = []; let depth = 0, cur = ''; for (const ch of str) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; }
const fkFor = (rel) => `${rel.replace(/ies$/, 'y').replace(/s$/, '')}_id`;
async function embed(db, rows, cols) {
  const parts = splitCols(cols), plain = parts.filter((p) => !p.includes('('));
  const rels = parts.filter((p) => p.includes('(')).map((p) => ({ rel: p.slice(0, p.indexOf('(')), inner: p.slice(p.indexOf('(') + 1, p.lastIndexOf(')')) }));
  const out = [];
  for (const row of rows) {
    const o = plain.length === 1 && plain[0] === '*' ? { ...row } : Object.fromEntries(plain.map((c) => [c, row[c]]));
    for (const { rel, inner } of rels) { const fk = row[fkFor(rel)]; if (fk == null) { o[rel] = null; continue; } const r = await db.query(`select * from ${q(rel)} where id = $1`, [fk]); o[rel] = (await embed(db, r.rows, inner))[0] ?? null; }
    out.push(o);
  }
  return out;
}
// arrays of scalars become Postgres arrays (text[], numeric[]); other objects are JSON for jsonb columns
const val = (v) => (Array.isArray(v) && v.every((x) => x === null || typeof x !== 'object') ? v : v !== null && typeof v === 'object' ? JSON.stringify(v) : v);

class Builder {
  constructor(db, table) { this.db = db; this.table = table; this.filters = []; this.cols = '*'; this.op = 'select'; this.ord = null; this.lim = null; this.single = false; this.wantReturn = false; this.head = false; }
  select(cols = '*', opts = {}) { if (this.op === 'select') { this.cols = cols; this.head = !!opts.head; this.count = opts.count; } else this.wantReturn = true; return this; }
  insert(rows) { this.op = 'insert'; this.rows = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows, opts = {}) { this.op = 'upsert'; this.rows = Array.isArray(rows) ? rows : [rows]; this.opts = opts; return this; }
  update(row) { this.op = 'update'; this.row = row; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filters.push([c, '=', v]); return this; } neq(c, v) { this.filters.push([c, '<>', v]); return this; }
  lt(c, v) { this.filters.push([c, '<', v]); return this; } gte(c, v) { this.filters.push([c, '>=', v]); return this; }
  in(c, v) { this.filters.push([c, 'in', v]); return this; } is(c, v) { this.filters.push([c, v === null ? 'is' : '=', v]); return this; }
  order(c, o = {}) { this.ord = `${q(c)} ${o.ascending === false ? 'desc' : 'asc'}`; return this; } limit(n) { this.lim = n; return this; }
  maybeSingle() { this.single = true; return this; }
  then(res, rej) { return this.run().then(res, rej); }
  where(params) {
    if (!this.filters.length) return '';
    return ' where ' + this.filters.map(([c, op, v]) => { if (op === 'is') return `${q(c)} is null`; if (op === 'in') { params.push(v); return `${q(c)} = any($${params.length})`; } params.push(v); return `${q(c)} ${op} $${params.length}`; }).join(' and ');
  }
  async run() {
    try {
      const params = [];
      if (this.op === 'select') {
        const r = await this.db.query(`select * from ${q(this.table)}${this.where(params)}${this.ord ? ` order by ${this.ord}` : ''}${this.lim ? ` limit ${this.lim}` : ''}`, params);
        if (this.head) return { data: null, count: r.rows.length, error: null };
        const rows = this.cols === '*' ? r.rows : await embed(this.db, r.rows, this.cols);
        return { data: this.single ? rows[0] ?? null : rows, error: null };
      }
      if (this.op === 'update') { const keys = Object.keys(this.row); const sets = keys.map((k) => { params.push(val(this.row[k])); return `${q(k)} = $${params.length}`; }); await this.db.query(`update ${q(this.table)} set ${sets.join(', ')}${this.where(params)}`, params); return { data: null, error: null }; }
      if (this.op === 'delete') { await this.db.query(`delete from ${q(this.table)}${this.where(params)}`, params); return { data: null, error: null }; }
      const returned = [];
      for (const row of this.rows) {
        const p = [], keys = Object.keys(row);
        let s = `insert into ${q(this.table)} (${keys.map(q).join(', ')}) values (${keys.map((k) => { p.push(val(row[k])); return `$${p.length}`; }).join(', ')})`;
        if (this.op === 'upsert') {
          const conflict = (this.opts.onConflict ?? 'id').split(',').map((c) => c.trim()), upd = keys.filter((k) => !conflict.includes(k));
          s += this.opts.ignoreDuplicates || !upd.length ? ` on conflict (${conflict.map(q).join(', ')}) do nothing` : ` on conflict (${conflict.map(q).join(', ')}) do update set ${upd.map((k) => `${q(k)} = excluded.${q(k)}`).join(', ')}`;
        }
        if (this.wantReturn) s += ' returning *';
        returned.push(...(await this.db.query(s, p)).rows);
      }
      return { data: this.wantReturn ? returned : null, error: null };
    } catch (e) { return { data: null, error: { message: e.message } }; }
  }
}
export function fakeSupabase(pool) {
  return {
    from: (t) => new Builder(pool, t),
    async rpc(name, args = {}) {
      try {
        const keys = Object.keys(args);
        const r = await pool.query(`select * from ${q(name)}(${keys.map((k, i) => `${q(k)} => $${i + 1}`).join(', ')})`, keys.map((k) => val(args[k])));
        const scalar = r.fields.length === 1 && r.fields[0].name === name; // PostgREST: scalar functions return the bare value, table functions rows
        return { data: scalar ? r.rows[0]?.[name] ?? null : r.rows, error: null };
      } catch (e) { return { data: null, error: { message: e.message } }; }
    },
    auth: {
      // Mirrors the GoTrue admin API closely enough: unique emails with the real error code, deletes, and a log of every password / ban change.
      admin: {
        log: [],
        async listUsers() { const r = await pool.query('select id, email from auth.users'); return { data: { users: r.rows }, error: null }; },
        async updateUserById(id, attrs = {}) { const r = await pool.query('select id from auth.users where id = $1', [id]); if (!r.rowCount) return { data: null, error: { message: 'User not found', code: 'user_not_found', status: 404 } }; this.log.push({ id, ...attrs }); return { data: { user: { id } }, error: null }; },
        async createUser({ email, password }) {
          if ((await pool.query('select 1 from auth.users where lower(email) = lower($1)', [email])).rowCount) return { data: { user: null }, error: { message: 'A user with this email address has already been registered', code: 'email_exists', status: 422 } };
          const r = await pool.query('insert into auth.users (email) values ($1) returning id, email', [email]); this.log.push({ id: r.rows[0].id, created: true, password }); return { data: { user: r.rows[0] }, error: null };
        },
        async deleteUser(id) { await pool.query('delete from auth.users where id = $1', [id]); this.log.push({ id, deleted: true }); return { data: {}, error: null }; },
      },
    },
  };
}
// Every connection acts as the service role (what Edge Functions use with the service key): row-level security is bypassed, grants still apply.
export const newPool = () => { const p = new pg.Pool({ database: process.env.PGDATABASE ?? 'lossmap_test' }); p.on('connect', (c) => c.query('set role service_role')); return p; };
