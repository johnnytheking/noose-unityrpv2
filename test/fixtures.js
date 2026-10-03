export const identity={lastName:'Durand',firstName:'Alex',birthDate:'1998-04-14',birthPlace:'Los Santos',sex:'Masculin',phone:'555-0100',address:'',umail:''};
export const fixtures={
 tourist:{...identity,country:'France',previousResidence:'Non',currentlyInLS:'Oui',purpose:'Tourisme',duration:'2 semaines',accommodation:'Hôtel de Los Santos',expelled:'Non',visaRefused:'Non',otherVisa:'Non',notes:'Néant'},
 work:{...identity,situation:'Sans emploi',profession:'Sans profession',plannedProfession:'Technicien',company:'Entreprise de test',hasEmployer:'Non',position:'Technicien',workedBefore:'Oui',hasVisa:'Non',hasIdentity:'Oui',expelled:'Non',convicted:'Non',notes:'Néant'},
 identity:{...identity,occupation:'En emploi',hasVisa:'Oui',hasIdentity:'Non',reason:'Première demande',notes:'Néant'}
};
export const body=type=>({type,data:{...fixtures[type]},attest:{accurate:true,understood:true}});
