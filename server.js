import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 10000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_CODE = process.env.NOOSE_ADMIN_CODE;

const ACCESS_SPACES = ['IAA', 'SOD', 'PPCR', 'PC_IAA', 'PC_SOD', 'PC_PPCR'];
const VALID_UNITS = ['ALL', 'NOOSE', 'IAA', 'SOD', 'PPCR'];
const NATO = [
  ['Alpha', 'A'], ['Bravo', 'B'], ['Charlie', 'C'], ['Delta', 'D'], ['Echo', 'E'], ['Foxtrot', 'F'], ['Golf', 'G'], ['Hotel', 'H'], ['India', 'I'], ['Juliett', 'J'], ['Kilo', 'K'], ['Lima', 'L'], ['Mike', 'M'], ['November', 'N'], ['Oscar', 'O'], ['Papa', 'P'], ['Quebec', 'Q'], ['Romeo', 'R'], ['Sierra', 'S'], ['Tango', 'T'], ['Uniform', 'U'], ['Victor', 'V'], ['Whiskey', 'W'], ['X-ray', 'X'], ['Yankee', 'Y'], ['Zulu', 'Z']
];

const hash = value => createHash('sha256').update(value).digest('hex');
const unitOf = space => space.includes('IAA') ? 'IAA' : space.includes('SOD') ? 'SOD' : space.includes('PPCR') ? 'PPCR' : null;
const levelOf = space => space === 'ADMIN' ? 'admin' : space.startsWith('PC_') ? 'pc' : 'unit';
const visibleTo = (session, unit) => session.level === 'admin' || unit === 'ALL' || unit === session.unit;
const canManageOwnUnit = (session, unit) => session.level === 'admin' || (session.level === 'pc' && unit === session.unit);
const canManageCommunication = (session, unit) => session.level === 'admin' || (session.level === 'pc' && (unit === 'ALL' || unit === session.unit));

function targetForAdminOrPc(session, requested, allowGeneralForPc = false) {
  if (session.level === 'admin') {
    const target = requested || 'ALL';
    return VALID_UNITS.includes(target) ? target : null;
  }
  if (session.level === 'pc' && session.unit) {
    if (allowGeneralForPc && requested === 'ALL') return 'ALL';
    return session.unit;
  }
  return null;
}

function formatMatricule(word, number) {
  const found = NATO.find(([name]) => name.toLowerCase() === String(word).toLowerCase());
  if (!found) return null;
  const serial = String(number).padStart(3, '0');
  return `${found[0]}-${serial} (${found[1]}-${serial})`;
}

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

async function query(text, params = []) {
  if (!pool) throw new Error('database_not_configured');
  return pool.query(text, params);
}

async function initDb() {
  if (!pool) return;
  await query(`
    create table if not exists access_credentials (space text primary key, hash text not null);
    create table if not exists sessions (token text primary key, space text not null, unit text, level text not null, expires_at bigint not null);
    create table if not exists members (id text primary key, name text not null, matricule text not null unique, grade text not null, function text not null, unit text not null);
    create table if not exists hierarchy_positions (id text primary key, title text not null, holder text not null, unit text not null, sort_order integer not null);
    create table if not exists events (id text primary key, title text not null, date text not null, time text, place text, description text, priority text, unit text not null, organizer text);
    create table if not exists announcements (id text primary key, title text not null, content text not null, unit text not null, priority text, author text, date text);
    create table if not exists weekly_recaps (id text primary key, unit text not null, week_label text not null, type text not null, content text not null, author text, updated_at text not null);
    create table if not exists audit_logs (id text primary key, action text not null, actor text not null, target text, unit text, at text not null);
  `);

  const creds = await query('select count(*)::int as count from access_credentials');
  if (creds.rows[0].count === 0) {
    for (const space of ACCESS_SPACES) await query('insert into access_credentials(space, hash) values($1,$2)', [space, hash('demo')]);
  }

  const members = await query('select count(*)::int as count from members');
  if (members.rows[0].count === 0) {
    const rows = [
      ['Hyun-tak Yamashiro', 'November-001 (N-001)', 'Secretary', 'Secretary of N.O.O.S.E.', 'NOOSE'],
      ['Michael Hayes', 'India-008 (I-008)', 'Unit Commander', 'Commandement', 'IAA'],
      ['Ethan Carter', 'Sierra-014 (S-014)', 'Unit Commander', 'Commandement', 'SOD'],
      ['Daniel Brooks', 'Papa-021 (P-021)', 'Unit Commander', 'Commandement', 'PPCR']
    ];
    for (const row of rows) await query('insert into members(id,name,matricule,grade,function,unit) values($1,$2,$3,$4,$5,$6)', [randomUUID(), ...row]);
  }

  const hierarchy = await query('select count(*)::int as count from hierarchy_positions');
  if (hierarchy.rows[0].count === 0) {
    const rows = [
      ['Secretary of N.O.O.S.E.', 'Hyun-tak Yamashiro', 'NOOSE', 1],
      ['Deputy Secretary of N.O.O.S.E.', 'Poste vacant', 'NOOSE', 2],
      ['Under Secretary of N.O.O.S.E.', 'Poste vacant', 'NOOSE', 3],
      ['Unit Commander', 'Michael Hayes', 'IAA', 1], ['Deputy Unit Commander', 'Poste vacant', 'IAA', 2],
      ['Unit Commander', 'Ethan Carter', 'SOD', 1], ['Deputy Unit Commander', 'Poste vacant', 'SOD', 2],
      ['Unit Commander', 'Daniel Brooks', 'PPCR', 1], ['Deputy Unit Commander', 'Poste vacant', 'PPCR', 2]
    ];
    for (const row of rows) await query('insert into hierarchy_positions(id,title,holder,unit,sort_order) values($1,$2,$3,$4,$5)', [randomUUID(), ...row]);
  }
}

async function getSession(token) {
  if (!token || !pool) return null;
  const result = await query('select * from sessions where token=$1 and expires_at>$2 limit 1', [token, Date.now()]);
  if (!result.rows.length) return null;
  const r = result.rows[0];
  return { token: r.token, space: r.space, unit: r.unit, level: r.level, expiresAt: Number(r.expires_at) };
}

async function audit(action, actor, target, unit) {
  if (!pool) return;
  await query('insert into audit_logs(id,action,actor,target,unit,at) values($1,$2,$3,$4,$5,$6)', [randomUUID(), action, actor, target || null, unit || null, new Date().toISOString()]);
}

app.use(express.json({ limit: '1mb' }));

app.get('/api/_healthcheck', (_req, res) => res.json({ ok: true, database: !!pool, adminConfigured: !!ADMIN_CODE }));

app.post('/api/login', async (req, res) => {
  try {
    const { space, code } = req.body || {};
    if (!space || !code) return res.status(400).json({ error: 'missing_credentials' });
    if (!pool) return res.status(503).json({ error: 'database_not_configured' });

    let valid = false;
    if (space === 'ADMIN') {
      if (!ADMIN_CODE) return res.status(503).json({ error: 'admin_not_configured' });
      valid = code === ADMIN_CODE;
    } else {
      const result = await query('select hash from access_credentials where space=$1 limit 1', [space]);
      valid = !!result.rows.length && result.rows[0].hash === hash(code);
    }
    if (!valid) return res.status(401).json({ error: 'invalid_credentials' });

    const token = randomUUID();
    const session = { token, space, unit: unitOf(space), level: levelOf(space), expiresAt: Date.now() + 12 * 60 * 60 * 1000 };
    await query('insert into sessions(token,space,unit,level,expires_at) values($1,$2,$3,$4,$5)', [token, space, session.unit, session.level, session.expiresAt]);
    return res.json(session);
  } catch (error) {
    console.error('login error', error);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/state', async (req, res) => {
  try {
    const session = await getSession(req.body?.token);
    if (!session) return res.status(401).json({ error: 'unauthorized' });
    const [events, announcements, members, hierarchy, recaps] = await Promise.all([
      query('select * from events order by date asc, time asc'),
      query('select * from announcements order by date desc'),
      query('select * from members order by name asc'),
      query('select * from hierarchy_positions order by unit asc, sort_order asc'),
      query('select * from weekly_recaps order by updated_at desc')
    ]);
    return res.json({
      events: events.rows.filter(r => visibleTo(session, r.unit)),
      announcements: announcements.rows.filter(r => visibleTo(session, r.unit)),
      members: members.rows,
      hierarchy: hierarchy.rows.map(r => ({ id: r.id, title: r.title, holder: r.holder, unit: r.unit, order: r.sort_order })),
      recaps: recaps.rows.filter(r => visibleTo(session, r.unit)).map(r => ({ id: r.id, unit: r.unit, weekLabel: r.week_label, type: r.type, content: r.content, author: r.author, updatedAt: r.updated_at }))
    });
  } catch (error) {
    console.error('state error', error);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/event/create', async (req, res) => {
  try {
    const data = req.body || {};
    const session = await getSession(data.token);
    if (!session || session.level === 'unit') return res.status(403).json({ error: 'forbidden' });
    const unit = targetForAdminOrPc(session, data.unit, false);
    if (!unit || !String(data.title || '').trim() || !data.date) return res.status(400).json({ error: 'validation' });
    const id = randomUUID();
    await query('insert into events(id,title,date,time,place,description,priority,unit,organizer) values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, String(data.title).trim(), data.date, data.time || '', data.place || '', data.description || '', data.priority || 'Normal', unit, session.space.replaceAll('_', ' ')]);
    await audit('CREATE_EVENT', session.space, String(data.title).trim(), unit);
    return res.status(201).json({ id });
  } catch (error) { console.error(error); return res.status(500).json({ error: 'server_error' }); }
});

app.post('/api/event/delete', async (req, res) => {
  try {
    const { token, id } = req.body || {};
    const session = await getSession(token);
    if (!session || !id) return res.status(403).json({ error: 'forbidden' });
    const found = await query('select * from events where id=$1', [id]);
    if (!found.rows.length || !canManageOwnUnit(session, found.rows[0].unit)) return res.status(403).json({ error: 'forbidden' });
    await query('delete from events where id=$1', [id]);
    await audit('DELETE_EVENT', session.space, found.rows[0].title, found.rows[0].unit);
    return res.json({ ok: true });
  } catch (error) { console.error(error); return res.status(500).json({ error: 'server_error' }); }
});

app.post('/api/announcement/create', async (req, res) => {
  try {
    const data = req.body || {};
    const session = await getSession(data.token);
    if (!session || session.level === 'unit') return res.status(403).json({ error: 'forbidden' });
    const unit = targetForAdminOrPc(session, data.unit, true);
    if (!unit || !String(data.title || '').trim() || !String(data.content || '').trim()) return res.status(400).json({ error: 'validation' });
    const id = randomUUID();
    const date = new Date().toLocaleDateString('fr-FR');
    await query('insert into announcements(id,title,content,unit,priority,author,date) values($1,$2,$3,$4,$5,$6,$7)', [id, String(data.title).trim(), String(data.content).trim(), unit, data.priority || 'Normale', session.space.replaceAll('_', ' '), date]);
    await audit('CREATE_ANNOUNCEMENT', session.space, String(data.title).trim(), unit);
    return res.status(201).json({ id });
  } catch (error) { console.error(error); return res.status(500).json({ error: 'server_error' }); }
});

app.post('/api/announcement/update', async (req, res) => {
  try {
    const data = req.body || {};
    const session = await getSession(data.token);
    if (!session || !data.id) return res.status(403).json({ error: 'forbidden' });
    const found = await query('select * from announcements where id=$1', [data.id]);
    if (!found.rows.length || !canManageCommunication(session, found.rows[0].unit)) return res.status(403).json({ error: 'forbidden' });
    const unit = targetForAdminOrPc(session, data.unit || found.rows[0].unit, true);
    if (!unit || !String(data.title || '').trim() || !String(data.content || '').trim()) return res.status(400).json({ error: 'validation' });
    await query('update announcements set title=$1,content=$2,unit=$3,priority=$4,author=$5,date=$6 where id=$7', [String(data.title).trim(), String(data.content).trim(), unit, data.priority || found.rows[0].priority, session.space.replaceAll('_', ' '), new Date().toLocaleDateString('fr-FR'), data.id]);
    await audit('UPDATE_ANNOUNCEMENT', session.space, String(data.title).trim(), unit);
    return res.json({ ok: true });
  } catch (error) { console.error(error); return res.status(500).json({ error: 'server_error' }); }
});

app.post('/api/recap/create', async (req, res) => {
  try {
    const data = req.body || {};
    const session = await getSession(data.token);
    if (!session || session.level === 'unit') return res.status(403).json({ error: 'forbidden' });
    const unit = targetForAdminOrPc(session, data.unit, true);
    if (!unit || !String(data.weekLabel || '').trim() || !String(data.type || '').trim() || !String(data.content || '').trim()) return res.status(400).json({ error: 'validation' });
    const id = randomUUID();
    const updatedAt = new Date().toISOString();
    await query('insert into weekly_recaps(id,unit,week_label,type,content,author,updated_at) values($1,$2,$3,$4,$5,$6,$7)', [id, unit, String(data.weekLabel).trim(), String(data.type).trim(), String(data.content).trim(), session.space.replaceAll('_', ' '), updatedAt]);
    await audit('CREATE_RECAP', session.space, `${data.type} — ${data.weekLabel}`, unit);
    return res.status(201).json({ id });
  } catch (error) { console.error(error); return res.status(500).json({ error: 'server_error' }); }
});

app.post('/api/recap/update', async (req, res) => {
  try {
    const data = req.body || {};
    const session = await getSession(data.token);
    if (!session || !data.id) return res.status(403).json({ error: 'forbidden' });
    const found = await query('select * from weekly_recaps where id=$1', [data.id]);
    if (!found.rows.length || !canManageCommunication(session, found.rows[0].unit)) return res.status(403).json({ error: 'forbidden' });
    const unit = targetForAdminOrPc(session, data.unit || found.rows[0].unit, true);
    if (!unit) return res.status(400).json({ error: 'invalid_unit' });
    const updatedAt = new Date().toISOString();
    await query('update weekly_recaps set unit=$1,week_label=$2,type=$3,content=$4,author=$5,updated_at=$6 where id=$7', [unit, String(data.weekLabel).trim(), String(data.type).trim(), String(data.content).trim(), session.space.replaceAll('_', ' '), updatedAt, data.id]);
    await audit('UPDATE_RECAP', session.space, `${data.type} — ${data.weekLabel}`, unit);
    return res.json({ ok: true });
  } catch (error) { console.error(error); return res.status(500).json({ error: 'server_error' }); }
});

app.post('/api/member/create', async (req, res) => {
  try {
    const data = req.body || {};
    const session = await getSession(data.token);
    if (!session) return res.status(401).json({ error: 'unauthorized' });
    const serial = Number(data.number);
    const matricule = formatMatricule(data.natoWord, serial);
    if (!matricule || !Number.isInteger(serial) || serial < 1 || serial > 999 || !VALID_UNITS.includes(data.unit) || data.unit === 'ALL') return res.status(400).json({ error: 'invalid_matricule' });
    if (!String(data.name || '').trim() || !String(data.grade || '').trim() || !String(data.function || '').trim()) return res.status(400).json({ error: 'validation' });
    const duplicate = await query('select 1 from members where matricule=$1 limit 1', [matricule]);
    if (duplicate.rows.length) return res.status(409).json({ error: 'duplicate_matricule' });
    const id = randomUUID();
    await query('insert into members(id,name,matricule,grade,function,unit) values($1,$2,$3,$4,$5,$6)', [id, String(data.name).trim(), matricule, String(data.grade).trim(), String(data.function).trim(), data.unit]);
    await audit('CREATE_MEMBER', session.space, String(data.name).trim(), data.unit);
    return res.status(201).json({ id, matricule });
  } catch (error) { console.error(error); return res.status(500).json({ error: 'server_error' }); }
});

app.post('/api/member/update', async (req, res) => {
  try {
    const data = req.body || {};
    const session = await getSession(data.token);
    if (!session || !data.id) return res.status(401).json({ error: 'unauthorized' });
    const serial = Number(data.number);
    const matricule = formatMatricule(data.natoWord, serial);
    if (!matricule || !Number.isInteger(serial) || serial < 1 || serial > 999) return res.status(400).json({ error: 'invalid_matricule' });
    const duplicate = await query('select 1 from members where matricule=$1 and id<>$2 limit 1', [matricule, data.id]);
    if (duplicate.rows.length) return res.status(409).json({ error: 'duplicate_matricule' });
    await query('update members set name=$1,matricule=$2,grade=$3,function=$4,unit=$5 where id=$6', [String(data.name).trim(), matricule, String(data.grade).trim(), String(data.function).trim(), data.unit, data.id]);
    await audit('UPDATE_MEMBER', session.space, String(data.name).trim(), data.unit);
    return res.json({ ok: true, matricule });
  } catch (error) { console.error(error); return res.status(500).json({ error: 'server_error' }); }
});

app.post('/api/hierarchy/update', async (req, res) => {
  try {
    const data = req.body || {};
    const session = await getSession(data.token);
    if (!session || session.level !== 'admin') return res.status(403).json({ error: 'forbidden' });
    if (!data.id || !String(data.title || '').trim() || !String(data.holder || '').trim()) return res.status(400).json({ error: 'validation' });
    const found = await query('select * from hierarchy_positions where id=$1', [data.id]);
    if (!found.rows.length) return res.status(404).json({ error: 'not_found' });
    await query('update hierarchy_positions set title=$1,holder=$2,unit=$3,sort_order=$4 where id=$5', [String(data.title).trim(), String(data.holder).trim(), data.unit || found.rows[0].unit, Number(data.order || found.rows[0].sort_order), data.id]);
    await audit('UPDATE_HIERARCHY', session.space, String(data.title).trim(), data.unit || found.rows[0].unit);
    return res.json({ ok: true });
  } catch (error) { console.error(error); return res.status(500).json({ error: 'server_error' }); }
});

app.post('/api/access/update', async (req, res) => {
  try {
    const { token, space, code } = req.body || {};
    const session = await getSession(token);
    if (!session || session.level !== 'admin') return res.status(403).json({ error: 'forbidden' });
    if (!ACCESS_SPACES.includes(space) || !code || code.length < 4 || code.length > 64) return res.status(400).json({ error: 'invalid_code' });
    await query('update access_credentials set hash=$1 where space=$2', [hash(code), space]);
    await query('delete from sessions where space=$1', [space]);
    await audit('UPDATE_ACCESS_CODE', session.space, space, unitOf(space));
    return res.json({ ok: true });
  } catch (error) { console.error(error); return res.status(500).json({ error: 'server_error' }); }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(port, '0.0.0.0', async () => {
  console.log(`N.O.O.S.E. internal portal listening on ${port}`);
  console.log(`[CONFIG] database=${!!DATABASE_URL} admin=${!!ADMIN_CODE}`);
  try {
    await initDb();
    console.log('[DB] ready');
  } catch (error) {
    console.error('[DB] initialization failed', error);
  }
});
