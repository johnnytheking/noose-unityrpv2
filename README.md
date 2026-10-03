# National Office Of Security Enforcement

Portail public d’immigration et d’état civil : visa touristique, visa de travail et carte d’identité. Aucun espace interne, aucune liste publique de dossiers et aucun paiement en ligne.

## Lancement

Node.js 22 ou supérieur. `npm ci`, puis `npm start`. Le portail écoute sur `0.0.0.0:$PORT` (4173 par défaut). `npm run build` vérifie la syntaxe ; `npm test` exécute les parcours serveur avec une base PostgreSQL embarquée et un service d’envoi simulé. Les tests n’envoient aucun message réel.

## Mise en service sur Render

La branche `noose-civil-portal` est autonome. Les autres branches du dépôt restent inchangées. Créer un **Web Service**, avec `npm ci --omit=dev && npm run build` et `npm start`. Le Blueprint `render.yaml` contient la configuration correspondante.

Trois variables sont nécessaires pour activer le dépôt :

| Variable | Valeur attendue |
| --- | --- |
| `DATABASE_URL` | Véritable URL de connexion PostgreSQL ; ne pas utiliser « Generate » |
| `RESEND_API_KEY` | Clé API Resend confidentielle, uniquement sur le serveur |
| `MAIL_FROM` | Adresse d’expédition autorisée sur un domaine vérifié chez Resend |

Le destinataire est fixé à `nooseunityrp@gmail.com`. Aucune copie n’est envoyée à l’adresse Umail renseignée par le demandeur. Chaque message contient le reçu en PNG haute définition, identique à l’image affichée sur le site, ainsi que toutes les réponses. Utiliser une adresse d’expédition autorisée chez Resend. Les ports SMTP usuels sont bloqués sur les services gratuits Render, d’où l’envoi par API HTTPS.

Sans configuration, les pages et les formulaires sont disponibles, mais le serveur refuse la soumission avec un message clair. Aucun numéro fictif ni fausse confirmation n’est produit. `/healthz` contrôle que le serveur répond ; `/api/status` indique si le dépôt est activé.

Utiliser une base persistante et maintenir ses sauvegardes. Une base gratuite Render expire après 30 jours ; un compteur permanent nécessite une base qui n’expire pas. Le compte dispose déjà d’une base gratuite pour le portail interne : elle n’est ni modifiée ni réutilisée automatiquement. Aucun abonnement payant n’est créé par ce projet.

## Numérotation et envoi

La migration crée uniquement le schéma `noose_civil`. Un compteur atomique, une contrainte d’unicité et une clé de tentative attribuent les numéros à partir de `000001`. L’utilisateur ne choisit jamais son numéro. Après une coupure ou un double clic, une nouvelle tentative retrouve le même dossier. Les numéros sont attribués à l’enregistrement : un dossier dont l’envoi échoue garde sa place dans la suite.

Le Gouvernement reçoit toutes les réponses. Les cinq motifs de carte d’identité sont aussi représentés par cinq réponses Oui/Non. Le serveur attend l’acceptation du message par le prestataire avant de confirmer sa transmission. Cette acceptation ne garantit pas l’arrivée dans la boîte de réception. La destination est fixée dans le code : aucune valeur du questionnaire ne peut modifier le destinataire.

Les tentatives d’envoi utilisent les clés d’idempotence Resend. Une tentative dont l’issue reste inconnue après 23 heures doit être contrôlée auprès du prestataire avant reprise, car les clés expirent après 24 heures. L’application bloque alors une retransmission automatique pour éviter les doublons.

Les réponses sont conservées dans PostgreSQL pour permettre les reprises. Aucun endpoint ne permet de parcourir la base ou de lire un dossier par son numéro. Les brouillons et la confirmation restent dans la session de l’onglet. Validation client et serveur, HTML échappé, requêtes paramétrées, limite de taille et de fréquence, origine contrôlée et en-têtes de sécurité sont en place.

## Identité et impression

Les deux images fournies sont intégrées sans retouche. Le sceau utilise le fichier original haute définition, affiché plus grand dans l’en-tête. La barre supérieure porte National Office Of Security Enforcement et Unity RP, sans drapeau. La confirmation s’imprime au format A4 et peut être enregistrée en PDF depuis le navigateur. Elle comporte le sceau, l’identité, le numéro, la date réelle de dépôt et les instructions de présentation au Gouvernement. Aucune date de rendez-vous n’est générée.

Documentation : https://render.com/docs/free ; https://resend.com/docs/api-reference/emails/send-email ; https://resend.com/changelog/idempotency-keys
