import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, FileText, KeyRound, LogOut, Megaphone, Pencil, Plus, Search, Shield } from 'lucide-react';

type Access = { token: string; space: string; unit: string | null; level: 'unit' | 'pc' | 'admin' };
type EventItem = { id: string; title: string; date: string; time: string; place: string; description: string; priority: string; unit: string; organizer: string };
type Announcement = { id: string; title: string; content: string; unit: string; priority: string; author: string; date: string };
type Member = { id: string; name: string; matricule: string; grade: string; function: string; unit: string };
type Position = { id: string; title: string; holder: string; unit: string; order: number };
type WeeklyRecap = { id: string; unit: string; weekLabel: string; type: string; content: string; author: string; updatedAt: string };
type AppState = { events: EventItem[]; announcements: Announcement[]; members: Member[]; hierarchy: Position[]; recaps: WeeklyRecap[] };

type ApiError = Error & { response?: { data?: { error?: string }; status?: number } };
const api = {
  post: async (url: string, body: unknown) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data?.error || 'request_failed') as ApiError;
      err.response = { data, status: response.status };
      throw err;
    }
    return { data };
  }
};

const accessOptions = [
  { key: 'IAA', title: 'International Affairs Agency', short: 'I.A.A.', group: 'UNITÉS OPÉRATIONNELLES' },
  { key: 'SOD', title: 'Special Operations Division', short: 'S.O.D.', group: 'UNITÉS OPÉRATIONNELLES' },
  { key: 'PPCR', title: 'Public Protection Crisis Response', short: 'P.P.C.R.', group: 'UNITÉS OPÉRATIONNELLES' },
  { key: 'PC_IAA', title: 'Poste de commandement', short: 'PC I.A.A.', group: 'POSTES DE COMMANDEMENT' },
  { key: 'PC_SOD', title: 'Poste de commandement', short: 'PC S.O.D.', group: 'POSTES DE COMMANDEMENT' },
  { key: 'PC_PPCR', title: 'Poste de commandement', short: 'PC P.P.C.R.', group: 'POSTES DE COMMANDEMENT' },
  { key: 'ADMIN', title: 'Administration générale', short: 'ADMIN', group: 'ADMINISTRATION' }
];

const managedSpaces = accessOptions.filter(option => option.key !== 'ADMIN');
const natoAlphabet = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'];
const recapTypes = ['Récapitulatif officiel', 'Récapitulatif opérationnel', 'Récapitulatif d’unité', 'Bilan de commandement'];
const emptyState: AppState = { events: [], announcements: [], members: [], hierarchy: [], recaps: [] };

function unitName(unit: string | null) {
  if (unit === 'IAA') return 'I.A.A.';
  if (unit === 'SOD') return 'S.O.D.';
  if (unit === 'PPCR') return 'P.P.C.R.';
  if (unit === 'ALL') return 'GÉNÉRAL N.O.O.S.E.';
  return 'N.O.O.S.E.';
}

function AgencySeal({ small = false }: { small?: boolean }) {
  return <div className={small ? 'agency-seal small' : 'agency-seal'}><img src='/resources/noose-seal.jpeg' alt='Logo N.O.O.S.E.' /></div>;
}

function App() {
  const [access, setAccess] = useState<Access | null>(() => {
    const raw = sessionStorage.getItem('noose-access');
    return raw ? JSON.parse(raw) : null;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [state, setState] = useState<AppState>(emptyState);
  const [page, setPage] = useState('ACCUEIL');
  const [search, setSearch] = useState('');

  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ title: '', date: '2026-09-12', time: '21:00', place: 'Headquarters', description: '', priority: 'Important', unit: 'ALL' });

  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', priority: 'Normale', unit: 'ALL' });

  const [showRecapForm, setShowRecapForm] = useState(false);
  const [editingRecap, setEditingRecap] = useState<WeeklyRecap | null>(null);
  const [recapForm, setRecapForm] = useState({ weekLabel: '', type: 'Récapitulatif officiel', content: '', unit: 'ALL' });

  const [memberEditorOpen, setMemberEditorOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberForm, setMemberForm] = useState({ name: '', natoWord: 'Alpha', number: '001', grade: '', function: '', unit: 'NOOSE' });

  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionForm, setPositionForm] = useState({ title: '', holder: '', unit: 'NOOSE', order: 1 });
  const [editingCredential, setEditingCredential] = useState<string | null>(null);
  const [newAccessCode, setNewAccessCode] = useState('');

  const canCommand = access?.level === 'pc' || access?.level === 'admin';
  const unitLabel = access?.unit || 'N.O.O.S.E.';

  const loadState = async () => {
    if (!access) return;
    try {
      const res = await api.post('/api/state', { token: access.token });
      setState(res.data as AppState);
    } catch {
      setError('Impossible de charger les données du portail.');
    }
  };

  useEffect(() => { void loadState(); }, [access]);

  const login = async () => {
    if (!selected || !code) return;
    setError('');
    try {
      const res = await api.post('/api/login', { space: selected, code });
      const next = res.data as Access;
      setAccess(next);
      sessionStorage.setItem('noose-access', JSON.stringify(next));
      setSelected(null);
      setCode('');
    } catch (e) {
      const err = e as ApiError;
      setError(err.response?.data?.error === 'admin_not_configured' ? 'Accès ADMIN non configuré.' : 'Code d’accès incorrect.');
    }
  };

  const logout = () => {
    sessionStorage.removeItem('noose-access');
    setAccess(null);
    setState(emptyState);
    setPage('ACCUEIL');
    setNotice('');
  };

  const openNewEvent = () => {
    setEventForm({ title: '', date: '2026-09-12', time: '21:00', place: 'Headquarters', description: '', priority: 'Important', unit: access?.level === 'admin' ? 'ALL' : access?.unit || 'ALL' });
    setShowEventForm(true);
    setError('');
  };

  const addEvent = async () => {
    if (!access) return;
    try {
      await api.post('/api/event/create', { token: access.token, ...eventForm });
      setShowEventForm(false);
      setNotice('Événement ajouté au programme.');
      await loadState();
    } catch {
      setError('Impossible d’ajouter cet événement.');
    }
  };

  const deleteEvent = async (id: string) => {
    if (!access || !confirm('Supprimer cet événement ?')) return;
    try {
      await api.post('/api/event/delete', { token: access.token, id });
      await loadState();
    } catch {
      setError('Vous ne pouvez pas supprimer cet événement.');
    }
  };

  const openNewAnnouncement = () => {
    setEditingAnnouncement(null);
    setAnnouncementForm({ title: '', content: '', priority: 'Normale', unit: access?.level === 'admin' ? 'ALL' : access?.unit || 'ALL' });
    setShowAnnouncementForm(true);
    setError('');
  };

  const openAnnouncementEditor = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setAnnouncementForm({ title: announcement.title, content: announcement.content, priority: announcement.priority, unit: announcement.unit });
    setShowAnnouncementForm(true);
    setError('');
  };

  const saveAnnouncement = async () => {
    if (!access) return;
    try {
      const endpoint = editingAnnouncement ? '/api/announcement/update' : '/api/announcement/create';
      await api.post(endpoint, { token: access.token, id: editingAnnouncement?.id, ...announcementForm });
      setShowAnnouncementForm(false);
      setNotice(editingAnnouncement ? 'Annonce mise à jour.' : 'Annonce publiée.');
      setEditingAnnouncement(null);
      await loadState();
    } catch {
      setError('Impossible d’enregistrer cette annonce.');
    }
  };

  const canEditAnnouncement = (announcement: Announcement) => access?.level === 'admin' || (access?.level === 'pc' && (announcement.unit === 'ALL' || announcement.unit === access.unit));

  const openNewRecap = () => {
    setEditingRecap(null);
    setRecapForm({ weekLabel: '', type: 'Récapitulatif officiel', content: '', unit: access?.level === 'admin' ? 'ALL' : access?.unit || 'ALL' });
    setShowRecapForm(true);
    setError('');
  };

  const openRecapEditor = (recap: WeeklyRecap) => {
    setEditingRecap(recap);
    setRecapForm({ weekLabel: recap.weekLabel, type: recap.type, content: recap.content, unit: recap.unit });
    setShowRecapForm(true);
    setError('');
  };

  const saveRecap = async () => {
    if (!access) return;
    try {
      const endpoint = editingRecap ? '/api/recap/update' : '/api/recap/create';
      await api.post(endpoint, { token: access.token, id: editingRecap?.id, ...recapForm });
      setShowRecapForm(false);
      setNotice(editingRecap ? 'Récapitulatif mis à jour.' : 'Récapitulatif ajouté.');
      setEditingRecap(null);
      await loadState();
    } catch {
      setError('Impossible d’enregistrer ce récapitulatif.');
    }
  };

  const canEditRecap = (recap: WeeklyRecap) => access?.level === 'admin' || (access?.level === 'pc' && (recap.unit === 'ALL' || recap.unit === access.unit));

  const resetMemberForm = () => setMemberForm({ name: '', natoWord: 'Alpha', number: '001', grade: '', function: '', unit: access?.unit || 'NOOSE' });

  const openNewMember = () => {
    setEditingMember(null);
    resetMemberForm();
    setMemberEditorOpen(true);
    setError('');
  };

  const openMemberEditor = (member: Member) => {
    const match = member.matricule.match(/^([A-Za-z-]+)-(\d{1,3})/);
    setEditingMember(member);
    setMemberForm({ name: member.name, natoWord: match?.[1] || 'Alpha', number: (match?.[2] || '001').padStart(3, '0'), grade: member.grade, function: member.function, unit: member.unit });
    setMemberEditorOpen(true);
    setError('');
  };

  const saveMember = async () => {
    if (!access) return;
    const numeric = Number(memberForm.number);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 999) {
      setError('Le numéro de matricule doit être compris entre 001 et 999.');
      return;
    }
    try {
      const endpoint = editingMember ? '/api/member/update' : '/api/member/create';
      await api.post(endpoint, { token: access.token, id: editingMember?.id, ...memberForm, number: numeric });
      setMemberEditorOpen(false);
      setNotice(editingMember ? 'Fiche du personnel mise à jour.' : 'Membre ajouté à l’annuaire.');
      setEditingMember(null);
      setError('');
      await loadState();
    } catch (e) {
      const err = e as ApiError;
      setError(err.response?.data?.error === 'duplicate_matricule' ? 'Ce matricule est déjà utilisé.' : 'Impossible d’enregistrer cette fiche.');
    }
  };

  const openPositionEditor = (position: Position) => {
    setEditingPosition(position);
    setPositionForm({ title: position.title, holder: position.holder, unit: position.unit, order: position.order });
    setError('');
  };

  const savePosition = async () => {
    if (!access || !editingPosition) return;
    try {
      await api.post('/api/hierarchy/update', { token: access.token, id: editingPosition.id, ...positionForm });
      setEditingPosition(null);
      setNotice('Hiérarchie mise à jour.');
      await loadState();
    } catch {
      setError('Impossible de modifier ce poste.');
    }
  };

  const saveAccessCode = async () => {
    if (!access || !editingCredential) return;
    if (newAccessCode.length < 4) {
      setError('Le nouveau code doit contenir au moins 4 caractères.');
      return;
    }
    try {
      await api.post('/api/access/update', { token: access.token, space: editingCredential, code: newAccessCode });
      setNotice(`Code d’accès ${editingCredential.replaceAll('_', ' ')} modifié.`);
      setEditingCredential(null);
      setNewAccessCode('');
      setError('');
    } catch {
      setError('Impossible de modifier ce code d’accès.');
    }
  };

  const filteredMembers = useMemo(
    () => state.members.filter(member => `${member.name} ${member.matricule} ${member.grade} ${member.function}`.toLowerCase().includes(search.toLowerCase())),
    [state.members, search]
  );

  if (!access) return <div className='auth-shell'>
    <div className='portal-banner'><div>UNITY RP · N.O.O.S.E. INTERNAL PORTAL</div><span>INTERNAL PERSONNEL ACCESS</span></div>
    <header className='masthead'><AgencySeal/><div><div className='eyebrow'>NATIONAL OFFICE OF SECURITY ENFORCEMENT</div><h1>N.O.O.S.E.</h1><p className='agency-subtitle'>Office of the Secretary · Internal Personnel Portal</p></div><div className='motto'>VIGILANCE · COURAGE · INTÉGRITÉ</div></header>
    <div className='primary-nav'><div><span className='active'>Personnel</span></div></div>
    <main className='access-main'>
      <div className='crumb'>HOME / INTERNAL ACCESS</div>
      <div className='access-intro'><span>PORTAIL INTERNE DU PERSONNEL</span><h2>Accès au réseau interne</h2><p>Sélectionnez l’espace N.O.O.S.E. correspondant à votre unité ou à votre niveau de commandement. Aucun identifiant personnel n’est requis.</p></div>
      {['UNITÉS OPÉRATIONNELLES', 'POSTES DE COMMANDEMENT', 'ADMINISTRATION'].map(group => <section key={group} className='access-section'><div className='section-num'>{group === 'UNITÉS OPÉRATIONNELLES' ? '01' : group === 'POSTES DE COMMANDEMENT' ? '02' : '03'}</div><div className='access-content'><h3>{group}</h3><div className='access-grid'>{accessOptions.filter(option => option.group === group).map(option => <button key={option.key} className='access-card' onClick={() => { setSelected(option.key); setError(''); }}><div><span>{option.short}</span><strong>{option.title}</strong></div><ChevronRight size={18}/></button>)}</div></div></section>)}
    </main>
    {selected && <div className='modal-backdrop'><div className='modal'><div className='modal-kicker'>AUTHENTIFICATION SÉCURISÉE</div><h3>Accès — {accessOptions.find(option => option.key === selected)?.short}</h3><p>Veuillez saisir le code d’accès correspondant.</p><input autoFocus type='password' value={code} onChange={event => setCode(event.target.value)} onKeyDown={event => event.key === 'Enter' && void login()} placeholder='Code d’accès'/>{error && <div className='error'>{error}</div>}<div className='modal-actions'><button className='ghost' onClick={() => { setSelected(null); setCode(''); setError(''); }}>Annuler</button><button className='primary' onClick={() => void login()}>S’authentifier</button></div><small>Utilisez uniquement les codes attribués à votre espace N.O.O.S.E.</small></div></div>}
  </div>;

  const nav = ['ACCUEIL', 'PROGRAMME', 'RÉCAPITULATIF', 'ANNUAIRE', 'HIÉRARCHIE', 'ANNONCES', ...(access.level === 'admin' ? ['ACCÈS & SÉCURITÉ'] : [])];
  const generalEvents = state.events.filter(item => item.unit === 'ALL');
  const unitProgramKeys = access.level === 'admin' ? ['IAA', 'SOD', 'PPCR'] : access.unit ? [access.unit] : [];
  const latestRecap = state.recaps[0];

  return <div className='portal'>
    <div className='portal-banner compact'><div>UNITY RP · N.O.O.S.E. INTERNAL PORTAL</div><span>AUTHENTICATED SESSION</span></div>
    <header className='topbar'><div className='brand'><AgencySeal small/><div><strong>N.O.O.S.E.</strong><span>NATIONAL OFFICE OF SECURITY ENFORCEMENT</span></div></div><div className='access-badge'>ACCÈS : {access.space.replaceAll('_', ' ')}</div><button className='logout' onClick={logout}><LogOut size={16}/> Déconnexion</button></header>
    <div className='portal-body'>
      <aside><div className='unit-mark'><span>UNITÉ ACTIVE</span><strong>{unitName(unitLabel)}</strong></div><nav>{nav.map(item => <button key={item} className={page === item ? 'active' : ''} onClick={() => { setPage(item); setNotice(''); setError(''); }}>{item}</button>)}</nav>{canCommand && <div className='command-box'><span>{access.level === 'admin' ? 'ADMINISTRATION' : 'POSTE DE COMMANDEMENT'}</span><p>Les commandes de modification sont activées sur les pages autorisées.</p></div>}</aside>
      <main className='content'>
        {notice && <div className='notice'>{notice}</div>}
        {error && access && <div className='error page-error'>{error}</div>}

        {page === 'ACCUEIL' && <><PageHead num='01' title={access.unit ? `${unitName(access.unit)} — Espace interne` : 'Administration générale'} subtitle='Informations opérationnelles et communications internes.'/><div className='home-grid'><Panel title='PROCHAINS ÉVÉNEMENTS' icon={<CalendarDays size={18}/>}><EventList items={state.events.slice(0, 3)} editable={false}/></Panel><Panel title='DERNIÈRE ANNONCE' icon={<Megaphone size={18}/>}><AnnouncementCard item={state.announcements[0]}/></Panel><Panel title='DERNIER RÉCAPITULATIF' icon={<FileText size={18}/>}><p className='recap-text'>{latestRecap ? `${latestRecap.type} · ${latestRecap.weekLabel}\n\n${latestRecap.content}` : 'Aucun récapitulatif publié.'}</p></Panel><Panel title='AGENCY OVERVIEW' icon={<Shield size={18}/>}><p className='recap-text'>Le N.O.O.S.E. centralise la sécurité intérieure, la coordination inter-agences et la réponse aux crises. Son organisation reprend une logique fédérale de commandement et de coordination adaptée au fonctionnement Unity RP.</p></Panel></div></>}

        {page === 'PROGRAMME' && <><PageHead num='02' title='Programme de la semaine' subtitle='Programme général N.O.O.S.E. et programme interne réservé à chaque unité.' action={canCommand ? <button className='primary slim' onClick={openNewEvent}><Plus size={15}/> Ajouter un événement</button> : undefined}/><div className='program-sections'><ProgramSection title='PROGRAMME GÉNÉRAL N.O.O.S.E.' subtitle='Événements communs visibles par l’ensemble des unités.' scope='GÉNÉRAL' items={generalEvents} editable={access.level === 'admin'} onDelete={deleteEvent}/>{unitProgramKeys.map(unit => <ProgramSection key={unit} title={`PROGRAMME ${unitName(unit)}`} subtitle={`Événements internes réservés à ${unitName(unit)}, son poste de commandement et l’administration.`} scope={unitName(unit)} items={state.events.filter(item => item.unit === unit)} editable={access.level === 'admin' || (access.level === 'pc' && access.unit === unit)} onDelete={deleteEvent}/>)}</div></>}

        {page === 'RÉCAPITULATIF' && <><PageHead num='03' title='Récapitulatifs hebdomadaires' subtitle='Archives officielles classées par semaine, type et périmètre.' action={canCommand ? <button className='primary slim' onClick={openNewRecap}><Plus size={15}/> Ajouter un récapitulatif</button> : undefined}/><div className='recap-grid'>{state.recaps.length ? state.recaps.map(recap => <article className='recap-card' key={recap.id}><div className='recap-meta'><span>{recap.unit === 'ALL' ? 'GÉNÉRAL' : unitName(recap.unit)}</span><span>{recap.weekLabel}</span></div><h3>{recap.type}</h3><p>{recap.content}</p><footer><small>Dernière édition : {recap.author}</small>{canEditRecap(recap) && <button className='edit-btn' onClick={() => openRecapEditor(recap)}><Pencil size={14}/> Modifier</button>}</footer></article>) : <p className='empty'>Aucun récapitulatif disponible.</p>}</div></>}

        {page === 'ANNUAIRE' && <><PageHead num='04' title='Annuaire du personnel' subtitle='Répertoire interne — tous les espaces authentifiés peuvent ajouter ou mettre à jour une fiche.' action={<button className='primary slim' onClick={openNewMember}><Plus size={15}/> Ajouter un membre</button>}/><div className='directory-note'>MATRICULE N.O.O.S.E. : alphabet phonétique OTAN + numéro, par exemple <strong>Bravo-002 (B-002)</strong>.</div><div className='searchbar'><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder='Rechercher un membre...'/></div><div className='table'><div className='tr th'><span>NOM</span><span>MATRICULE</span><span>GRADE</span><span>FONCTION</span><span>UNITÉ</span><span>ACTION</span></div>{filteredMembers.map(member => <div className='tr' key={member.id}><strong>{member.name}</strong><span>{member.matricule}</span><span>{member.grade}</span><span>{member.function}</span><span>{unitName(member.unit)}</span><button className='edit-btn' onClick={() => openMemberEditor(member)}><Pencil size={14}/> Modifier</button></div>)}</div></>}

        {page === 'HIÉRARCHIE' && <><PageHead num='05' title='Hiérarchie' subtitle='Chaîne de commandement générale, puis commandement propre à chaque unité.'/><section className='central-hierarchy'><div className='hier-title'>DIRECTION N.O.O.S.E.</div><div className='hier-chain'>{state.hierarchy.filter(position => position.unit === 'NOOSE').sort((a, b) => a.order - b.order).map(position => <div className='hierarchy-post' key={position.id}><div><span>{position.title}</span><strong>{position.holder}</strong></div>{access.level === 'admin' && <button className='edit-btn' onClick={() => openPositionEditor(position)}><Pencil size={14}/> Modifier</button>}</div>)}</div></section><div className='hierarchy-transition'><strong>UNIT COMMAND</strong><span>Chaque unité dispose de sa propre hiérarchie.</span></div><div className='unit-hierarchy-grid'>{['IAA', 'SOD', 'PPCR'].map(unit => <section className='unit-hierarchy-card' key={unit}><div className='hier-title'>{unit === 'IAA' ? 'INTERNATIONAL AFFAIRS AGENCY — I.A.A.' : unit === 'SOD' ? 'SPECIAL OPERATIONS DIVISION — S.O.D.' : 'PUBLIC PROTECTION CRISIS RESPONSE — P.P.C.R.'}</div><div className='hier-chain'>{state.hierarchy.filter(position => position.unit === unit).sort((a, b) => a.order - b.order).map(position => <div className='hierarchy-post' key={position.id}><div><span>{position.title}</span><strong>{position.holder}</strong></div>{access.level === 'admin' && <button className='edit-btn' onClick={() => openPositionEditor(position)}><Pencil size={14}/> Modifier</button>}</div>)}</div></section>)}</div></>}

        {page === 'ANNONCES' && <><PageHead num='06' title='Annonces officielles' subtitle='Communications générales et annonces internes des unités.' action={canCommand ? <button className='primary slim' onClick={openNewAnnouncement}><Plus size={15}/> Nouvelle annonce</button> : undefined}/><div className='announcement-list'>{state.announcements.map(announcement => <article key={announcement.id}><div className='announcement-meta'><span>{announcement.unit === 'ALL' ? 'GÉNÉRAL' : unitName(announcement.unit)}</span><span>{announcement.priority}</span><span>{announcement.date}</span></div><h3>{announcement.title}</h3><p>{announcement.content}</p><div className='announcement-footer'><small>Publié par {announcement.author}</small>{canEditAnnouncement(announcement) && <button className='edit-btn' onClick={() => openAnnouncementEditor(announcement)}><Pencil size={14}/> Modifier</button>}</div></article>)}</div></>}

        {page === 'ACCÈS & SÉCURITÉ' && access.level === 'admin' && <><PageHead num='07' title='Accès & sécurité' subtitle='Gestion des codes des espaces opérationnels et des postes de commandement.'/><div className='security-note'><KeyRound size={19}/><div><strong>Gestion réservée à l’administration</strong><p>Les codes actuels ne sont jamais affichés. Un changement remplace immédiatement l’ancien code et ferme les sessions actives de l’espace concerné.</p></div></div><div className='access-management'>{managedSpaces.map(space => <div className='credential-row' key={space.key}><div><span>{space.short}</span><strong>{space.title}</strong><small>Code actuel : ••••••••</small></div><button className='edit-btn' onClick={() => { setEditingCredential(space.key); setNewAccessCode(''); setError(''); }}><Pencil size={14}/> Modifier le code</button></div>)}</div></>}
      </main>
    </div>

    {showEventForm && <Editor title='Ajouter un événement' onClose={() => setShowEventForm(false)} onSave={addEvent}><input placeholder='Titre' value={eventForm.title} onChange={event => setEventForm({ ...eventForm, title: event.target.value })}/><div className='two'><input type='date' value={eventForm.date} onChange={event => setEventForm({ ...eventForm, date: event.target.value })}/><input type='time' value={eventForm.time} onChange={event => setEventForm({ ...eventForm, time: event.target.value })}/></div><input placeholder='Lieu' value={eventForm.place} onChange={event => setEventForm({ ...eventForm, place: event.target.value })}/><textarea placeholder='Description' value={eventForm.description} onChange={event => setEventForm({ ...eventForm, description: event.target.value })}/><select value={eventForm.priority} onChange={event => setEventForm({ ...eventForm, priority: event.target.value })}><option>Normal</option><option>Important</option><option>Prioritaire</option></select>{access.level === 'admin' ? <><label className='field-label'>PROGRAMME CIBLE</label><select value={eventForm.unit} onChange={event => setEventForm({ ...eventForm, unit: event.target.value })}><option value='ALL'>Programme général N.O.O.S.E.</option><option value='IAA'>I.A.A.</option><option value='SOD'>S.O.D.</option><option value='PPCR'>P.P.C.R.</option></select></> : <div className='form-scope'>PROGRAMME CIBLE : {unitName(access.unit)}</div>}{error && <div className='error'>{error}</div>}</Editor>}

    {showAnnouncementForm && <Editor title={editingAnnouncement ? 'Modifier une annonce' : 'Nouvelle annonce'} onClose={() => { setShowAnnouncementForm(false); setEditingAnnouncement(null); setError(''); }} onSave={saveAnnouncement}><input placeholder='Titre' value={announcementForm.title} onChange={event => setAnnouncementForm({ ...announcementForm, title: event.target.value })}/><textarea placeholder='Contenu' value={announcementForm.content} onChange={event => setAnnouncementForm({ ...announcementForm, content: event.target.value })}/><select value={announcementForm.priority} onChange={event => setAnnouncementForm({ ...announcementForm, priority: event.target.value })}><option>Normale</option><option>Importante</option><option>Urgente</option></select><label className='field-label'>DESTINATION</label><select value={announcementForm.unit} onChange={event => setAnnouncementForm({ ...announcementForm, unit: event.target.value })}><option value='ALL'>Annonce générale</option>{access.level === 'admin' ? <><option value='IAA'>I.A.A.</option><option value='SOD'>S.O.D.</option><option value='PPCR'>P.P.C.R.</option></> : access.unit && <option value={access.unit}>{unitName(access.unit)}</option>}</select>{error && <div className='error'>{error}</div>}</Editor>}

    {showRecapForm && <Editor title={editingRecap ? 'Modifier un récapitulatif' : 'Ajouter un récapitulatif'} onClose={() => { setShowRecapForm(false); setEditingRecap(null); setError(''); }} onSave={saveRecap}><label className='field-label'>SEMAINE</label><input placeholder='Ex. 7 — 13 SEPTEMBRE 2026' value={recapForm.weekLabel} onChange={event => setRecapForm({ ...recapForm, weekLabel: event.target.value })}/><label className='field-label'>TYPE DE RÉCAPITULATIF</label><select value={recapForm.type} onChange={event => setRecapForm({ ...recapForm, type: event.target.value })}>{recapTypes.map(type => <option key={type}>{type}</option>)}</select><label className='field-label'>PÉRIMÈTRE</label><select value={recapForm.unit} onChange={event => setRecapForm({ ...recapForm, unit: event.target.value })}><option value='ALL'>Général N.O.O.S.E.</option>{access.level === 'admin' ? <><option value='IAA'>I.A.A.</option><option value='SOD'>S.O.D.</option><option value='PPCR'>P.P.C.R.</option></> : access.unit && <option value={access.unit}>{unitName(access.unit)}</option>}</select><label className='field-label'>CONTENU</label><textarea value={recapForm.content} onChange={event => setRecapForm({ ...recapForm, content: event.target.value })} placeholder='Rédiger le récapitulatif de la semaine...'/>{error && <div className='error'>{error}</div>}</Editor>}

    {memberEditorOpen && <Editor title={editingMember ? 'Modifier une fiche du personnel' : 'Ajouter un membre'} onClose={() => { setMemberEditorOpen(false); setEditingMember(null); setError(''); }} onSave={saveMember}><label className='field-label'>NOM</label><input value={memberForm.name} onChange={event => setMemberForm({ ...memberForm, name: event.target.value })}/><label className='field-label'>MATRICULE — ALPHABET OTAN</label><div className='two'><select value={memberForm.natoWord} onChange={event => setMemberForm({ ...memberForm, natoWord: event.target.value })}>{natoAlphabet.map(word => <option key={word}>{word}</option>)}</select><input inputMode='numeric' maxLength={3} value={memberForm.number} onChange={event => setMemberForm({ ...memberForm, number: event.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder='002'/></div><div className='matricule-preview'>APERÇU : {memberForm.natoWord}-{String(memberForm.number || '0').padStart(3, '0')} ({memberForm.natoWord.charAt(0)}-{String(memberForm.number || '0').padStart(3, '0')})</div><label className='field-label'>GRADE</label><input value={memberForm.grade} onChange={event => setMemberForm({ ...memberForm, grade: event.target.value })}/><label className='field-label'>FONCTION</label><input value={memberForm.function} onChange={event => setMemberForm({ ...memberForm, function: event.target.value })}/><label className='field-label'>UNITÉ</label><select value={memberForm.unit} onChange={event => setMemberForm({ ...memberForm, unit: event.target.value })}><option value='NOOSE'>Direction N.O.O.S.E.</option><option value='IAA'>I.A.A.</option><option value='SOD'>S.O.D.</option><option value='PPCR'>P.P.C.R.</option></select>{error && <div className='error'>{error}</div>}</Editor>}

    {editingPosition && <Editor title='Modifier un poste' onClose={() => { setEditingPosition(null); setError(''); }} onSave={savePosition}><label className='field-label'>POSTE</label><input value={positionForm.title} onChange={event => setPositionForm({ ...positionForm, title: event.target.value })}/><label className='field-label'>TITULAIRE</label><input value={positionForm.holder} onChange={event => setPositionForm({ ...positionForm, holder: event.target.value })}/><label className='field-label'>UNITÉ</label><select value={positionForm.unit} onChange={event => setPositionForm({ ...positionForm, unit: event.target.value })}><option value='NOOSE'>Direction N.O.O.S.E.</option><option value='IAA'>I.A.A.</option><option value='SOD'>S.O.D.</option><option value='PPCR'>P.P.C.R.</option></select></Editor>}

    {editingCredential && <Editor title={`Modifier le code — ${accessOptions.find(option => option.key === editingCredential)?.short || editingCredential}`} onClose={() => { setEditingCredential(null); setNewAccessCode(''); setError(''); }} onSave={saveAccessCode}><p className='editor-help'>Saisissez le nouveau code. L’ancien code ne sera plus accepté après validation.</p><label className='field-label'>NOUVEAU CODE</label><input autoFocus type='password' value={newAccessCode} onChange={event => setNewAccessCode(event.target.value)} placeholder='Minimum 4 caractères'/>{error && <div className='error'>{error}</div>}</Editor>}
  </div>;
}

function PageHead({ num, title, subtitle, action }: { num: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className='page-head'><div><span>{num} / INTERNAL</span><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>;
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className='panel'><div className='panel-title'>{icon}<span>{title}</span></div>{children}</section>;
}

function ProgramSection({ title, subtitle, scope, items, editable, onDelete }: { title: string; subtitle: string; scope: string; items: EventItem[]; editable: boolean; onDelete: (id: string) => void }) {
  return <section className='program-section'><div className='program-head'><div><span className='scope-tag'>{scope}</span><h3>{title}</h3><p>{subtitle}</p></div><strong>{items.length} événement{items.length > 1 ? 's' : ''}</strong></div><div className='list-panel'><EventList items={items} editable={editable} onDelete={onDelete}/></div></section>;
}

function EventList({ items, editable, onDelete }: { items: EventItem[]; editable: boolean; onDelete?: (id: string) => void }) {
  if (!items.length) return <p className='empty'>Aucun événement programmé.</p>;
  return <div className='event-list'>{items.map(item => <div className='event-row' key={item.id}><div className='date-block'><strong>{new Date(`${item.date}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit' })}</strong><span>{new Date(`${item.date}T12:00:00`).toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()}</span></div><div className='event-info'><div><h4>{item.title}</h4><span>{item.time} · {item.place} · {item.organizer}</span></div><p>{item.description}</p></div><span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span>{editable && onDelete && <button className='delete-btn' onClick={() => onDelete(item.id)}>Supprimer</button>}</div>)}</div>;
}

function AnnouncementCard({ item }: { item?: Announcement }) {
  if (!item) return <p className='empty'>Aucune annonce.</p>;
  return <div className='announcement-card'><span>{item.unit === 'ALL' ? 'GÉNÉRAL' : unitName(item.unit)} · {item.date}</span><h4>{item.title}</h4><p>{item.content}</p></div>;
}

function Editor({ title, onClose, onSave, children }: { title: string; onClose: () => void; onSave: () => void; children: React.ReactNode }) {
  return <div className='modal-backdrop'><div className='modal editor'><div className='modal-kicker'>ÉDITION AUTORISÉE</div><h3>{title}</h3>{children}<div className='modal-actions'><button className='ghost' onClick={onClose}>Annuler</button><button className='primary' onClick={() => void onSave()}>Enregistrer</button></div></div></div>;
}

export default App;
