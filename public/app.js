import { TYPES, SCHEMAS, fieldsAt, isVisible, validate } from './schema.js';

const main = document.querySelector('#main');
const dialog = document.querySelector('#confirmation-dialog');
const STORE = 'noose-civil-draft-v2';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
  passport: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6M9 10h6M12 7v6"/>',
  briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a22 22 0 0 0 18 0M12 12v4"/>',
  identity: '<rect x="2" y="5" width="20" height="15" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5 17c0-4 6-4 6 0M14 10h5M14 14h4"/>',
  building: '<path d="m3 9 9-6 9 6M3 9h18M5 9v10M10 9v10M14 9v10M19 9v10M3 21h18M2 19h20"/>',
  shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM8 12l3 3 5-6"/>',
  printer: '<path d="M7 8V3h10v5M7 17H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-3"/><path d="M7 13h10v8H7zM17 11h1"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.shield}</svg>`;
const uniqueAttempt = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
const fresh = type => ({ type, step: 1, data: {}, attest: {}, id: uniqueAttempt(), startedAt: Date.now() });
let draft;
try { const saved = JSON.parse(sessionStorage.getItem(STORE)); if (saved && TYPES[saved.type] && saved.data && typeof saved.id === 'string') draft = saved; } catch {}
let submitting = false;
let errors = {};
let globalError = '';
function save() { try { sessionStorage.setItem(STORE, JSON.stringify(draft)); } catch {} }
function navigate(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function start(type) { if (!Object.hasOwn(TYPES,type)) throw new Error('Démarche inconnue.'); if (submitting) return; if (!draft || draft.type !== type || draft.receipt) draft = fresh(type); errors = {}; globalError = ''; save(); navigate(`#demande/${type}/${draft.step || 1}`); }
const feeRows = '<div class="fee"><span>Frais administratifs</span><span>15 000 $</span></div><div class="fee"><span>Frais de dossier</span><span>5 000 $</span></div><div class="fee total"><span>Total</span><span>20 000 $</span></div>';
function home() {
  return `<section class="hero"><div class="container hero-inner"><div><p class="eyebrow">IMMIGRATION & CIVIL AFFAIRS</p><h1>Portail officiel des services<br>d’immigration et d’état civil</h1><p>Ce portail officiel permet de déposer une pré-demande relative aux services d’immigration et d’état civil de Los Santos. Après transmission de votre demande, vous devrez vous présenter auprès du Gouvernement afin de poursuivre votre procédure administrative.</p></div><div class="hero-aside"><strong>Votre démarche commence ici.</strong>Complétez votre demande en ligne, puis présentez-vous au Gouvernement avec votre numéro de dossier.</div></div></section>
  <section class="container services" id="demarches"><div class="section-heading"><h2>Quelle démarche souhaitez-vous effectuer ?</h2><span>Choisissez le service correspondant à votre situation.</span></div>
  ${draft && !draft.receipt ? `<div class="notice info">Vous avez une demande en cours : <strong>${TYPES[draft.type].title}</strong>. <button class="button text" data-start="${draft.type}">Reprendre ma demande</button></div>` : ''}
  <div class="cards">${Object.entries(TYPES).map(([key,t], i) => `<article class="service-card"><div class="card-top"><span class="card-index">0${i + 1} / ${t.code}</span></div><h3>${t.title}</h3><p>${t.description}</p><div class="card-fees">${key === 'work' ? feeRows : key === 'tourist' ? '<div class="fee"><span>Frais de la démarche</span></div><div class="total free">Gratuit</div>' : '<div class="fee"><span>Première demande ou mise à jour</span></div><div class="total">Document d’identité</div>'}</div><div class="fee-note">${key === 'work' ? 'Les frais sont réglés auprès du Gouvernement. Aucun paiement sur ce portail.' : key === 'tourist' ? 'Une pré-demande à finaliser auprès du Gouvernement de Los Santos.' : 'Les modalités vous seront précisées auprès du Gouvernement.'}</div><button class="button primary" data-start="${key}">Commencer une demande</button></article>`).join('')}</div></section>
  <section class="process-strip"><div class="container process-steps"><div class="process-item"><span class="process-num">01</span><div><strong>Complétez votre demande</strong><p>Renseignez et vérifiez vos informations.</p></div></div><div class="process-item"><span class="process-num">02</span><div><strong>Conservez votre confirmation</strong><p>Un numéro unique est attribué à votre dossier.</p></div></div><div class="process-item"><span class="process-num">03</span><div><strong>Présentez-vous au Gouvernement</strong><p>Finalisez votre démarche sur place.</p></div></div></div></section>`;
}
function breadcrumbs(label) { return `<div class="breadcrumb"><a href="#accueil">Accueil</a>${icon('chevron')}<span>${label}</span></div>`; }
function sidebar() {
  return `<aside><div class="side-card"><p class="eyebrow">VOTRE DÉMARCHE</p>${icon(TYPES[draft.type].icon)}<h3>${TYPES[draft.type].title}</h3>${draft.type === 'work' ? feeRows : draft.type === 'tourist' ? '<div class="fee total"><span>Tarif</span><span>Gratuit</span></div>' : '<p>Création, renouvellement ou mise à jour de votre document d’identité.</p>'}</div><div class="side-card">${icon('building')}<h3>Après votre demande</h3><p>Présentez-vous au Gouvernement de Los Santos avec votre numéro de dossier et les documents nécessaires à votre démarche.</p></div><p class="side-note"><strong>À savoir</strong><br>Le dépôt en ligne ne constitue pas une validation définitive. Aucun rendez-vous n’est attribué automatiquement.${draft.type === 'work' ? '<br><br>Les frais sont exclusivement réglés auprès du Gouvernement. Aucun paiement en ligne.' : ''}</p></aside>`;
}
function progress(step) { return `<ol class="progress" aria-label="Avancement de la demande">${['Démarche', 'Informations personnelles', 'Votre situation', 'Vérification', 'Confirmation'].map((label, i) => `<li class="${i < step ? 'done' : i === step ? 'active' : ''}" ${i === step ? 'aria-current="step"' : ''}><span class="step-dot">${i < step ? '✓' : i + 1}</span><span>${label}</span></li>`).join('')}</ol>`; }
function fieldHTML(f) {
  const value = draft.data[f.id] || '';
  const error = errors[f.id];
  const described = [f.hint ? `${f.id}-hint` : '', error ? `${f.id}-error` : ''].filter(Boolean).join(' ');
  const attrs = `name="${f.id}" id="${f.id}" ${f.optional ? '' : 'required'} ${f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''} ${described ? `aria-describedby="${described}"` : ''} ${error ? 'aria-invalid="true"' : ''}`;
  const label = `${escape(f.label)}${f.optional ? '<span class="optional">(facultatif)</span>' : ''}`;
  let control;
  if (['yesno','reason'].includes(f.type)) {
    control = `<fieldset ${described ? `aria-describedby="${described}"` : ''}><legend>${label}</legend><div class="${f.type === 'reason' ? 'reason-options' : 'choices'}">${(f.choices || ['Oui','Non']).map((choice,i) => `<label class="choice"><input type="radio" name="${f.id}" ${i === 0 ? `id="${f.id}"` : ''} value="${escape(choice)}" ${value === choice ? 'checked' : ''} required ${error ? 'aria-invalid="true"' : ''}><span>${escape(choice)}</span></label>`).join('')}</div></fieldset>`;
  } else if (f.type === 'select') control = `<label for="${f.id}">${label}</label><select ${attrs}><option value="">Sélectionnez une réponse</option>${f.choices.map(c => `<option ${value === c ? 'selected' : ''} value="${escape(c)}">${escape(c)}</option>`).join('')}</select>`;
  else if (f.type === 'textarea') control = `<label for="${f.id}">${label}</label><textarea ${attrs} maxlength="${f.max || 200}">${escape(value)}</textarea>`;
  else control = `<label for="${f.id}">${label}</label><input ${attrs} type="${f.type}" value="${escape(value)}" ${f.type === 'date' ? `min="1900-01-01" max="${new Date().toISOString().slice(0,10)}"` : `maxlength="${f.max || 200}"`}>`;
  return `<div data-field="${f.id}" class="field ${['yesno','reason','textarea'].includes(f.type) || ['company','accommodation','plannedProfession','employer','position'].includes(f.id) ? 'wide' : ''}">${control}${f.hint ? `<p class="hint" id="${f.id}-hint">${f.hint}</p>` : ''}${error ? `<p class="field-error" id="${f.id}-error">${error}</p>` : ''}</div>`;
}
function formStep(step) {
  const fields = fieldsAt(draft.type, step, draft.data);
  return `<section class="form-panel"><h2>${step === 1 ? 'Vos informations personnelles' : 'Informations relatives à votre demande'}</h2><p class="form-intro">Tous les champs sont obligatoires, sauf ceux indiqués comme facultatifs.</p>${Object.keys(errors).length ? '<div class="notice error error-summary" tabindex="-1" role="alert">Veuillez corriger les champs indiqués ci-dessous pour continuer.</div>' : ''}<form id="application-form" novalidate><div class="honeypot" aria-hidden="true"><label for="website">Site internet</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>${[...new Set(fields.map(f => f.group))].map(group => `<section class="form-section"><h3>${group}</h3><div class="fields">${fields.filter(f => f.group === group).map(fieldHTML).join('')}</div></section>`).join('')}<div class="form-actions"><button type="button" class="button secondary" data-back>Retour</button><button type="submit" class="button primary">Continuer</button></div></form></section>`;
}
function formatDate(value, time = false) { const date = new Date(time ? value : `${value}T12:00:00Z`); return Number.isNaN(+date) ? value : new Intl.DateTimeFormat('fr-FR', { dateStyle:'long', ...(time ? { timeStyle:'short', timeZone:'Europe/Paris' } : {}) }).format(date); }
function review() {
  return `<section class="form-panel"><h2>Vérification de votre demande</h2><p class="form-intro">Relisez vos réponses avant de transmettre votre dossier.</p>${globalError ? `<div class="notice error" role="alert">${escape(globalError)}</div>` : ''}${['Identité','Coordonnées','Informations relatives à la demande','Informations complémentaires'].map(group => `<section class="review-card"><div class="review-head"><h3>${group}</h3><button type="button" class="button text" data-edit="${['Identité','Coordonnées'].includes(group) ? 1 : 2}" ${submitting ? 'disabled' : ''}>Modifier<span class="sr-only"> : ${group}</span></button></div><dl class="review-data">${SCHEMAS[draft.type].filter(f => f.group === group && isVisible(f, draft.data)).map(f => `<div><dt>${escape(f.label)}</dt><dd>${escape(f.type === 'date' ? formatDate(draft.data[f.id]) : draft.data[f.id] || 'Non renseigné')}</dd></div>`).join('')}</dl></section>`).join('')}${draft.type === 'work' ? `<div class="notice info" style="margin-top:24px;margin-bottom:0"><strong>Montant dû : 20 000 $</strong><br>Frais administratifs : 15 000 $ · Frais de dossier : 5 000 $.<br>Paiement auprès du Gouvernement uniquement. Aucun paiement en ligne.</div>` : ''}<div class="attestations"><label class="check-label"><input type="checkbox" id="accurate" ${draft.attest.accurate ? 'checked' : ''} ${submitting ? 'disabled' : ''}><span>Je certifie que les informations fournies dans cette demande sont exactes.</span></label><label class="check-label"><input type="checkbox" id="understood" ${draft.attest.understood ? 'checked' : ''} ${submitting ? 'disabled' : ''}><span>Je comprends que l’envoi de ce formulaire ne constitue pas une validation définitive de ma demande.</span></label></div><div class="form-actions review-actions"><button class="button secondary" data-back ${submitting ? 'disabled' : ''}>Retour</button><button class="button primary" id="submit-request" ${submitting ? 'disabled' : ''}>${submitting ? 'Transmission en cours…' : 'Soumettre la demande'}</button></div><p class="sr-only" aria-live="polite">${submitting ? 'Veuillez patienter pendant la transmission de votre demande.' : ''}</p></section>`;
}
function confirmation() {
  const r = draft.receipt;
  return `<div class="container"><div class="confirmation-page"><div class="confirmation-heading"><div class="success-mark" aria-hidden="true">✓</div><p class="eyebrow">DEMANDE TRANSMISE</p><h1>Votre demande a été enregistrée.</h1><p>Conservez cette confirmation pour la suite de votre démarche.</p></div><article aria-label="Confirmation officielle de dépôt"><img class="receipt-image" src="${escape(r.confirmationImage)}" alt="Confirmation de dépôt du dossier ${escape(r.number)}. ${escape(TYPES[r.type].title)}. ${escape(r.firstName)} ${escape(r.lastName)}."><div class="receipt-accessible"><h2>Numéro de dossier : <span class="receipt-number">${escape(r.number)}</span></h2><dl><dt>Type de demande</dt><dd>${escape(TYPES[r.type].title)}</dd><dt>Nom</dt><dd>${escape(r.lastName)}</dd><dt>Prénom</dt><dd>${escape(r.firstName)}</dd><dt>Date de dépôt</dt><dd>${escape(formatDate(r.createdAt,true))}</dd><dt>État</dt><dd>Demande enregistrée</dd><dt>Prochaine étape</dt><dd>Présentation au Gouvernement</dd></dl><p>Afin de poursuivre votre demande, vous devez désormais vous présenter auprès du Gouvernement de Los Santos. Munissez-vous de votre numéro de dossier et des documents nécessaires à votre démarche.</p></div></article><div class="receipt-actions"><button class="button primary" id="print-confirmation">${icon('printer')}Imprimer ma confirmation</button><a class="button secondary" href="#accueil">Retour à l’accueil</a></div><p class="receipt-advice">Vous pouvez également choisir « Enregistrer au format PDF » dans la fenêtre d’impression.</p></div></div>`;
}
function information() { return `<div class="container information-page">${breadcrumbs('Informations')}<p class="eyebrow">AVANT DE COMMENCER</p><h1>Les informations utiles<br>pour votre démarche.</h1><p class="lead">Le dépôt en ligne est la première étape de votre procédure administrative auprès du Gouvernement de Los Santos.</p><div class="information-grid"><section class="info-block"><h2>Préparez vos informations</h2><p>Vous aurez besoin de votre identité, de votre date et lieu de naissance, de votre numéro de téléphone et des informations relatives à votre séjour ou à votre situation.</p><p>L’adresse de résidence et l’adresse Umail sont facultatives. Tous les autres champs doivent être renseignés.</p></section><section class="info-block"><h2>Comprendre les frais</h2><ul><li>Visa touristique : gratuit.</li><li>Visa de travail : 15 000 $ de frais administratifs et 5 000 $ de frais de dossier, soit 20 000 $.</li><li>Carte d’identité : modalités précisées auprès du Gouvernement.</li></ul><p>Les frais sont exclusivement réglés au Gouvernement de Los Santos. Aucun paiement n’est effectué sur ce portail.</p></section></div><section class="faq"><h2>Questions fréquentes</h2><details open><summary>Que faire après l’envoi de ma demande ?</summary><p>Conservez votre numéro de dossier et imprimez votre confirmation. Présentez-vous ensuite au Gouvernement de Los Santos avec les documents nécessaires à votre démarche.</p></details><details><summary>Est-ce que je reçois automatiquement un rendez-vous ?</summary><p>Non. Le portail n’attribue aucune date ni heure de rendez-vous. Il vous invite simplement à vous présenter au Gouvernement pour poursuivre votre procédure.</p></details><details><summary>Ma demande est-elle validée immédiatement ?</summary><p>Non. La confirmation atteste de la transmission de votre pré-demande. La validation définitive intervient auprès du Gouvernement.</p></details><details><summary>Comment obtenir une copie de ma confirmation ?</summary><p>Utilisez « Imprimer ma confirmation » après l’envoi. La fenêtre d’impression permet aussi d’enregistrer le document en PDF. La confirmation est transmise uniquement au service gouvernemental. L’adresse Umail renseignée dans le formulaire est une information de contact, sans envoi automatique.</p></details></section><a class="button primary" href="#demarches">Choisir ma démarche</a></div>`; }
function render() {
  const route = location.hash.slice(1) || 'accueil';
  document.querySelectorAll('[data-nav]').forEach(a => { const active = a.dataset.nav === (route.startsWith('demande') || route === 'confirmation' ? 'demarches' : route); a.classList.toggle('active',active); if(active) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  if (route === 'confirmation' && draft?.receipt) main.innerHTML = confirmation();
  else if (route.startsWith('demande/')) {
    const [,type,raw] = route.split('/');
    if (!Object.hasOwn(TYPES,type)) return navigate('#accueil');
    if (!draft || draft.type !== type) draft = fresh(type);
    if (draft.receipt) return navigate('#confirmation');
    let step = Math.min(3, Math.max(1, Number(raw) || 1));
    if (step > 1 && Object.keys(validate(type,draft.data,1)).length) step = 1;
    if (step > 2 && Object.keys(validate(type,draft.data,2)).length) step = 2;
    draft.step = step; save();
    main.innerHTML = `<div class="container application-wrap">${breadcrumbs(TYPES[type].title)}<div class="application-header"><div><p class="eyebrow">NOUVELLE DEMANDE</p><h1>${TYPES[type].title}</h1></div><span class="application-code">FORMULAIRE ${TYPES[type].code}</span></div>${progress(step)}<div class="application-grid">${step < 3 ? formStep(step) : review()}${sidebar()}</div></div>`;
  } else main.innerHTML = route === 'informations' ? information() : home();
  bind();
}
function bind() {
  document.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => start(b.dataset.start)));
  document.querySelector('[data-back]')?.addEventListener('click', () => { if(submitting) return; errors={}; globalError=''; navigate(draft.step > 1 ? `#demande/${draft.type}/${draft.step - 1}` : '#accueil'); });
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => { errors={};globalError='';navigate(`#demande/${draft.type}/${b.dataset.edit}`); }));
  const form = document.querySelector('#application-form');
  form?.addEventListener('input', e => { const name=e.target.name; if(!name || name==='website')return; draft.data[name]=e.target.value; draft.attest={}; save(); });
  form?.addEventListener('change', e => { if(e.target.name==='hasEmployer'){ draft.data.hasEmployer=e.target.value; draft.attest={}; const existing=form.querySelector('[data-field=employer]'); if(e.target.value==='Non'){delete draft.data.employer;delete errors.employer;existing?.remove();}else if(!existing){form.querySelector('[data-field=hasEmployer]').insertAdjacentHTML('afterend',fieldHTML(SCHEMAS.work.find(f=>f.id==='employer')));} save(); }});
  form?.addEventListener('submit', e => {e.preventDefault(); if(form.elements.website.value)return; errors=validate(draft.type,draft.data,draft.step); if(Object.keys(errors).length){render();document.querySelector('.error-summary')?.focus();document.querySelector(`#${Object.keys(errors)[0]}`)?.focus();return;} draft.step++;save();navigate(`#demande/${draft.type}/${draft.step}`); });
  ['accurate','understood'].forEach(id => document.getElementById(id)?.addEventListener('change',e => {draft.attest[id]=e.target.checked;save();}));
  document.querySelector('#submit-request')?.addEventListener('click', () => { if(submitting)return; if(!draft.attest.accurate || !draft.attest.understood){globalError='Veuillez cocher les deux déclarations pour confirmer votre demande.';render();main.querySelector('[role=alert]')?.scrollIntoView({block:'center'});return;}dialog.showModal(); });
  document.querySelector('#print-confirmation')?.addEventListener('click',() => window.print());
}
async function submit() {
  if (submitting) return;
  submitting=true;globalError='';render();
  try {
    const response = await fetch('/api/applications', { method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':draft.id},body:JSON.stringify({type:draft.type,data:draft.data,attest:draft.attest,startedAt:draft.startedAt}),signal:AbortSignal.timeout(55000) });
    const result=await response.json();
    if(!response.ok){if(result.fields){errors=result.fields;const first=SCHEMAS[draft.type].find(f=>errors[f.id]);if(first){draft.step=['Identité','Coordonnées'].includes(first.group)?1:2;save();navigate(`#demande/${draft.type}/${draft.step}`);}}throw new Error(result.message || 'La demande n’a pas pu être transmise. Réessayez dans quelques instants.');}
    if(!result.number || !result.createdAt || result.status!=='submitted' || !result.confirmationImage?.startsWith('data:image/png;base64,'))throw new Error('La confirmation n’a pas pu être vérifiée. Réessayez l’envoi avec cette même demande.');
    draft.receipt=result;draft.data={};draft.attest={};save();navigate('#confirmation');
  } catch(e) {globalError=e.name==='TimeoutError' || e.name==='TypeError' ? 'La connexion a été interrompue. Réessayez l’envoi de cette même demande : aucun nouveau numéro ne sera attribué si elle a déjà été enregistrée.' : e.message;}
  finally{submitting=false;render();if(globalError)main.querySelector('[role=alert]')?.scrollIntoView({block:'center'});}
}
dialog.addEventListener('close',() => {if(dialog.returnValue==='send')void submit();});
window.addEventListener('hashchange',() => {render();window.scrollTo(0,0);main.focus({preventScroll:true});});
window.addEventListener('beforeunload', e => {if(submitting){e.preventDefault();e.returnValue='';}});
document.addEventListener('click',e=>{if(submitting && e.target.closest('a'))e.preventDefault();});
render();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'start_civil_application',title:'Commencer une démarche',description:'Ouvre le formulaire demandé. Ne transmet aucun dossier.',inputSchema:{type:'object',properties:{type:{type:'string',enum:Object.keys(TYPES)}},required:['type'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!Object.hasOwn(TYPES,input?.type))throw new Error('Démarche inconnue.');start(input.type);render();return {type:input.type,step:draft.step,submitted:false};}})).catch(()=>{});}catch{}}
