export const TYPES = {
  tourist: { title: 'Visa touristique', short: 'Tourisme', code: 'VT', icon: 'passport', description: 'Préparez votre séjour temporaire à Los Santos et déposez votre demande de visa touristique.', price: 'Gratuit' },
  work: { title: 'Visa de travail', short: 'Travail', code: 'VW', icon: 'briefcase', description: 'Effectuez les démarches nécessaires pour exercer une activité professionnelle à Los Santos.', price: '20 000 $' },
  identity: { title: 'Carte d’identité', short: 'État civil', code: 'ID', icon: 'identity', description: 'Demandez votre première carte d’identité, son renouvellement ou la modification de vos informations.', price: '' }
};
const field = (id, label, group, type = 'text', options = {}) => ({ id, label, group, type, ...options });
const personal = (sex, address = 'Adresse actuelle') => [
  field('lastName', 'Nom', 'Identité', 'text', { autocomplete: 'family-name', max: 100 }),
  field('firstName', 'Prénom', 'Identité', 'text', { autocomplete: 'given-name', max: 100 }),
  field('birthDate', 'Date de naissance', 'Identité', 'date'),
  field('birthPlace', 'Lieu de naissance', 'Identité', 'text', { max: 160 }),
  ...(sex ? [field('sex', 'Sexe', 'Identité', 'select', { choices: ['Masculin', 'Féminin', 'Autre'] })] : []),
  field('phone', 'Numéro de téléphone', 'Coordonnées', 'tel', { autocomplete: 'tel', max: 32 }),
  field('address', address, 'Coordonnées', 'text', { optional: true, autocomplete: 'street-address', max: 250 }),
  field('umail', 'Adresse Umail', 'Coordonnées', 'email', { optional: true, autocomplete: 'email', max: 254 })
];
const other = 'Informations relatives à la demande';
const yesno = (id, label) => field(id, label, other, 'yesno');
const notes = field('notes', 'Informations complémentaires', 'Informations complémentaires', 'textarea', { max: 2500, hint: 'Indiquez « Néant » si vous n’avez rien à ajouter.' });
export const REASONS = ['Première demande', 'Renouvellement', 'Perte', 'Vol', 'Modification d’informations'];
export const SCHEMAS = {
  tourist: [...personal(true), field('country', 'Pays de résidence actuel', other), yesno('previousResidence', 'Avez-vous déjà résidé à Los Santos ?'), yesno('currentlyInLS', 'Êtes-vous actuellement à Los Santos ?'), field('purpose', 'Motif principal du séjour', other, 'select', { choices: ['Tourisme', 'Visite familiale ou amicale', 'Événement', 'Autre motif'] }), field('duration', 'Durée prévue du séjour', other, 'text', { hint: 'Par exemple : 2 semaines ou 1 mois.', max: 120 }), field('accommodation', 'Adresse ou lieu d’hébergement prévu à Los Santos', other, 'text', { max: 250 }), yesno('expelled', 'Avez-vous déjà fait l’objet d’une expulsion ?'), yesno('visaRefused', 'Avez-vous déjà eu un visa refusé ?'), yesno('otherVisa', 'Possédez-vous actuellement un autre visa ?'), notes],
  work: [...personal(false), field('situation', 'Situation actuelle', other, 'select', { choices: ['En emploi', 'Sans emploi', 'Étudiant', 'Travailleur indépendant', 'Autre situation'] }), field('profession', 'Profession actuelle', other, 'text', { hint: 'Indiquez « Sans profession » si nécessaire.' }), field('plannedProfession', 'Profession envisagée à Los Santos', other), field('company', 'Nom de l’entreprise / institution prévue', other, 'text', { hint: 'Indiquez « À déterminer » si nécessaire.' }), yesno('hasEmployer', 'Avez-vous déjà un employeur ?'), field('employer', 'Nom de l’employeur', other, 'text', { when: { field: 'hasEmployer', value: 'Oui' } }), field('position', 'Fonction prévue', other), yesno('workedBefore', 'Avez-vous déjà travaillé ?'), yesno('hasVisa', 'Possédez-vous actuellement un visa ?'), yesno('hasIdentity', 'Possédez-vous une carte d’identité ?'), yesno('expelled', 'Avez-vous déjà fait l’objet d’une expulsion ?'), yesno('convicted', 'Avez-vous déjà été condamné pour une infraction grave ?'), notes],
  identity: [...personal(true, 'Adresse de résidence'), field('occupation', 'Situation professionnelle', other, 'select', { choices: ['En emploi', 'Sans emploi', 'Étudiant', 'Travailleur indépendant', 'Retraité', 'Autre situation'] }), yesno('hasVisa', 'Avez-vous un visa ?'), yesno('hasIdentity', 'Possédez-vous déjà une carte d’identité ?'), field('reason', 'Motif de la demande', other, 'reason', { choices: REASONS }), notes]
};
export const isVisible = (f, data) => !f.when || data[f.when.field] === f.when.value;
export const fieldsAt = (type, step, data) => (SCHEMAS[type] || []).filter(f => isVisible(f, data) && (step === 1 ? ['Identité', 'Coordonnées'].includes(f.group) : !['Identité', 'Coordonnées'].includes(f.group)));
export function validate(type, data = {}, step) {
  const errors = {};
  const fields = step ? fieldsAt(type, step, data) : (SCHEMAS[type] || []).filter(f => isVisible(f, data));
  if (!Object.hasOwn(TYPES, type)) return { type: 'Sélectionnez une démarche.' };
  for (const f of fields) {
    const value = typeof data[f.id] === 'string' ? data[f.id].trim() : '';
    if (!value) { if (!f.optional) errors[f.id] = 'Veuillez renseigner ce champ.'; continue; }
    if (value.length > (f.max || 200)) errors[f.id] = `Limitez votre réponse à ${f.max || 200} caractères.`;
    if (f.choices && !f.choices.includes(value)) errors[f.id] = 'Sélectionnez une des réponses proposées.';
    if (f.type === 'yesno' && !['Oui', 'Non'].includes(value)) errors[f.id] = 'Sélectionnez Oui ou Non.';
    if (f.type === 'email' && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) errors[f.id] = 'Saisissez une adresse Umail valide.';
    if (f.type === 'tel' && (!/^[+()\d\s.\-]+$/.test(value) || value.replace(/\D/g, '').length < 3)) errors[f.id] = 'Saisissez un numéro de téléphone valide.';
    if (f.type === 'date') {
      const date = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(+date) || date.toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > new Date().toISOString().slice(0, 10)) errors[f.id] = 'Sélectionnez une date de naissance valide, antérieure ou égale à aujourd’hui.';
    }
  }
  return errors;
}
export function cleanData(type, data) {
  return Object.fromEntries(SCHEMAS[type].filter(f => isVisible(f, data)).map(f => [f.id, typeof data[f.id] === 'string' ? data[f.id].trim() : '']));
}
export function questionnaireRows(type, data) {
  return SCHEMAS[type].filter(f => isVisible(f, data)).flatMap(f => f.id === 'reason' ? REASONS.map((reason, i) => ({ group: f.group, label: ['S’agit-il d’une première demande ?', 'Renouvellement ?', 'Perte ?', 'Vol ?', 'Modification d’informations ?'][i], value: data.reason === reason ? 'Oui' : 'Non' })) : [{ group: f.group, label: f.label, value: data[f.id] || 'Non renseigné' }]);
}
