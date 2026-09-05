# N.O.O.S.E. — Unity RP : transfert vers Render

Ce dossier contient le portail complet, le logo fourni et la vue de Los Santos. Les fichiers publics ne contiennent ni nom personnel, ni badge de plateforme. La mention UNITY RP et l’espace entre « of » et « Security » sont conservés.

## État

Le dossier est préparé pour Render. Aucun service Render ni nouvelle adresse n’a encore été créé. Le nom souhaité est noose-unityrp ; l’adresse effective sera celle attribuée par Render, selon disponibilité. Le rendu en ligne et l’absence de badge restent à vérifier après publication.

## Publication depuis le tableau de bord

1. Décompresser ce ZIP. Déposer son contenu (le dossier dist, render.yaml et ce guide) à la racine d’un nouveau dépôt GitHub privé nommé noose-unityrp. Le dépôt de code n’a pas besoin d’être public.
2. Dans https://dashboard.render.com/, choisir New > Static Site, puis autoriser Render à accéder à ce dépôt.
3. Utiliser les paramètres suivants :
   - Name : noose-unityrp
   - Branch : la branche contenant les fichiers, généralement main
   - Root Directory : laisser vide
   - Build Command : true
   - Publish Directory : dist
4. Vérifier que le récapitulatif indique un site statique gratuit, puis choisir Create Static Site.
5. Attendre la fin de la publication et ouvrir l’adresse attribuée en onrender.com. Contrôler le logo, les liens du menu et l’absence de badge en bas à droite.

Le fichier render.yaml fournit aussi la configuration pour une création par Blueprint à partir du même dépôt. Il déclare uniquement un site statique, sans serveur payant ni base de données. Les déploiements automatiques sont désactivés dans ce fichier ; une mise à jour pourra être publiée manuellement.

## Budget de 0 €

Les sites statiques Render sont gratuits dans les limites de bande passante et de minutes de construction du forfait. Conserver le forfait gratuit et ne pas activer d’option payante. Un sous-domaine onrender.com ne nécessite pas l’achat d’un domaine. Un domaine indépendant en .com n’est pas inclus dans ce dossier.

## Documentation

- https://render.com/docs/static-sites
- https://render.com/docs/free
- https://render.com/docs/blueprint-spec

Pour voir le portail sur un ordinateur avant publication, ouvrir dist/index.html.
