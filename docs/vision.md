# Vision Produit – ArtisanConnect

## Problématique utilisateur

Les artisans indépendants (plombiers, électriciens, chauffagistes, multi-services, petits entrepreneurs du bâtiment) perdent un temps considérable à gérer leurs rendez-vous par téléphone, SMS ou WhatsApp. Chaque prise de rendez-vous génère plusieurs allers-retours pour trouver un créneau commun, vérifier la disponibilité, noter les coordonnées du client, envoyer une confirmation et gérer les rappels. Les annulations de dernière minute sont fréquentes et non compensées, entraînant des pertes sèches de chiffre d'affaires. Les artisans jonglent entre plusieurs calendriers (personnel Google Calendar, agenda papier, messages éparpillés) sans outil unifié, ce qui provoque des doublons, des oublis et une charge mentale élevée. Demander un acompte au téléphone est perçu comme gênant ou compliqué, alors que c'est le moyen le plus efficace de sécuriser un créneau et de limiter les désistements.

**Problème central :** Comment permettre à un artisan de gérer un agenda fiable, d'éviter les annulations coûteuses et d'encaisser un acompte facilement, sans complexité technique, sans charge administrative supplémentaire, et en offrant au client une expérience fluide et rassurante ?

---

## Cible principale

**Persona prioritaire :** Marc, 42 ans, plombier à son compte depuis 8 ans, zone d'intervention péri-urbaine (rayon 30 km). Il réalise entre 12 et 15 interventions par semaine, principalement des diagnostics, réparations urgentes et installations simples. Marc gère la planification de ses rendez-vous par téléphone direct ou via des messages WhatsApp. Il utilise Google Calendar pour ses rendez-vous personnels (médecin, enfants, loisirs) mais n'a pas d'outil métier structuré pour ses interventions professionnelles. Il note parfois les rendez-vous sur un cahier ou dans des notes éparses sur son téléphone.

**Douleurs identifiées :**

* Trop d'allers-retours téléphoniques ou par message pour fixer un rendez-vous (minimum 3 à 5 échanges par client).
* Annulations de dernière minute non compensées (environ 1 à 2 par semaine), qui laissent des trous dans l'agenda et génèrent une perte de revenus directe.
* Oublis ou doublons liés à un agenda mal synchronisé (il arrive qu'il note un rendez-vous dans Google Calendar pour sa vie personnelle, puis accepte un client au même moment par téléphone sans vérifier).
* Difficulté à demander un acompte au téléphone sans gêner le client ou paraître méfiant, alors que cela sécuriserait ses créneaux et réduirait les no-shows.
* Absence de rappels automatiques, ce qui nécessite d'envoyer manuellement des SMS de rappel la veille, tâche chronophage et souvent oubliée.

**Contraintes clés :**

* Solution simple, en français, mobile-friendly et fiable, pouvant être adoptée en moins de 30 minutes sans formation technique.
* Pas de complexité inutile : Marc veut un outil qui « marche tout seul » sans avoir à gérer des paramétrages complexes.
* Tarification transparente et proportionnée à l'usage, avec un retour sur investissement clair et immédiat (économie d'une à deux annulations par mois pour rentabiliser l'abonnement).
* Respect de la vie privée et sécurité des données clients : Marc doit pouvoir garantir à ses clients que leurs coordonnées et leurs paiements sont protégés.

---

## Proposition de valeur

**ArtisanConnect est un agenda en ligne conçu pour les artisans qui veulent arrêter de perdre du temps au téléphone, sécuriser leurs interventions et développer leur activité sans stress administratif.**

**Promesse centrale :**

* Les clients réservent eux-mêmes un créneau en ligne, 24/7, depuis n'importe quel appareil (mobile, tablette, ordinateur).
* Choix du service (diagnostic, urgence, maintenance, installation), durée pré-définie et prix affiché de manière transparente.
* Paiement d'un acompte obligatoire (par défaut 30 % du prix du service, configurable par l'artisan) pour valider la réservation, via un prestataire de paiement sécurisé (Stripe ou équivalent).
* Confirmation immédiate par email et SMS avec toutes les informations du rendez-vous (date, heure, adresse, contact artisan, montant de l'acompte) + lien unique de modification ou annulation pour le client.
* L'artisan voit son planning mis à jour automatiquement en temps réel, sans intervention manuelle.
* Les indisponibilités provenant de calendriers externes (Google Calendar, Outlook, Apple Calendar) sont importées automatiquement, empêchant les clients de réserver sur des créneaux déjà bloqués pour la vie personnelle ou d'autres engagements de l'artisan.
* Rappels automatiques par email et SMS envoyés 24 heures avant le rendez-vous, réduisant drastiquement les no-shows.
* Gestion client autonome : le client peut modifier ou annuler son rendez-vous en ligne via un code unique, sans appeler l'artisan, ce qui libère du temps et réduit les appels inutiles.

**Bénéfice clair et mesurable :**

* Moins d'administratif : réduction de 70 % du temps passé au téléphone pour fixer des rendez-vous.
* Moins d'annulations : baisse de 50 % des no-shows grâce à l'acompte obligatoire et aux rappels automatiques.
* Plus de revenus : sécurisation des créneaux, réduction des pertes sèches, encaissement de l'acompte avant l'intervention.
* Plus de sérénité : agenda fiable, synchronisé, accessible partout, sans risque de doublon ni oubli.

---

## Faisabilité technique (MVP réaliste)

Le prototype front existant démontre la viabilité technique et fonctionnelle du concept. Les éléments déjà présents dans l'interface actuelle incluent :

* Sélection du service parmi un catalogue pré-défini (diagnostic, urgence, maintenance, installation) avec durée, prix et taux d'acompte affichés.
* Génération dynamique de créneaux disponibles en fonction de la date choisie, des horaires d'ouverture de l'artisan, des pauses déjeuner configurées, et des créneaux déjà réservés ou bloqués par des indisponibilités externes.
* Gestion locale des réservations (simulation avec localStorage) : création, annulation, replanification.
* Auto-service client pour gérer son rendez-vous via un code unique et son email, sans authentification lourde.
* Faux connecteurs calendrier (Google, Outlook, Apple) pour illustrer l'expérience cible de synchronisation bidirectionnelle (import des indispos, export des réservations confirmées).
* Simulation de paiement d'acompte avec formulaire de carte bancaire (validation côté client, intégration réelle avec Stripe ou équivalent à prévoir côté backend).
* Notifications email et SMS simulées (cases à cocher, confirmation affichée à l'écran).
* Aperçu hebdomadaire des créneaux disponibles pour aider le client à choisir rapidement.
* Interface responsive, accessible, avec dark mode et retour haut de page pour une expérience utilisateur soignée.

**Prochaines évolutions naturelles (pas encore implémentées mais cohérentes avec la vision produit) :**

* Backend structuré : artisans, services, réservations, indisponibilités externes, notifications, gestion des paiements, logs d'activité pour traçabilité et fiabilité.
* Intégration réelle d'un prestataire de paiement (Stripe Checkout ou Stripe Payment Intents) pour capturer et encaisser les acomptes de manière sécurisée.
* Connecteurs réels avec les calendriers externes (Google Calendar API, Microsoft Graph API pour Outlook, CalDAV pour Apple) pour importer/exporter automatiquement les indisponibilités et les réservations.
* Système d'événements et webhooks pour notifier l'artisan en temps réel des nouvelles réservations, annulations ou modifications.
* Envoi automatique des emails et SMS via des services tiers (SendGrid, Twilio, Mailgun) avec templates personnalisables.
* Module d'analytics pour suivre le taux de conversion des réservations, le taux d'annulation, le chiffre d'affaires généré par mois, et identifier les créneaux les plus demandés.
* Export ICS et intégration avec outils métier (CRM, comptabilité, gestion de stock) pour les offres Business.

---

## Contrat fonctionnel du MVP

Le **modèle de données** et le **contrat d'API de réservation** utilisés par ArtisanConnect sont décrits de manière formelle et exhaustive dans le document `docs/domain-model.md`.

Ce document définit notamment :

* Les entités centrales du domaine métier : Artisan (avec horaires d'ouverture et pauses configurables), Service (avec durée, prix, taux d'acompte), Réservation (avec statut, coordonnées client, informations d'acompte, notifications), Indisponibilité externe importée depuis les calendriers connectés, Plan d'abonnement (Starter, Pro, Business).
* Les règles d'intégrité métier : non-chevauchement des créneaux (une réservation confirmée bloque le créneau pour toute autre tentative de réservation), calcul automatique de l'acompte en fonction du taux configuré sur le service, statuts de réservation (confirmed, cancelled, rescheduled) avec transitions autorisées, gestion de la politique d'annulation et de remboursement d'acompte.
* Les opérations exposées au front : consultation de la liste des services actifs pour l'artisan, consultation des créneaux disponibles pour un service et une date donnée (en tenant compte des réservations existantes et des indisponibilités externes), création d'une réservation avec validation du paiement d'acompte, annulation d'une réservation par le client ou l'artisan (avec libération du créneau), replanification d'une réservation vers un nouveau créneau disponible (avec préservation du code unique de réservation pour la continuité de l'expérience client).
* Les formats de données et les contrats d'API HTTP (JSON) avec exemples de requêtes et réponses, codes d'erreur métier (SLOT_UNAVAILABLE, BOOKING_NOT_FOUND, INVALID_PAYLOAD, etc.), et spécifications de sécurité de base (validation des entrées, protection contre les injections, gestion des erreurs sans divulgation d'informations sensibles).

Ce document sert de référence unique et immuable pour :

* La conception de l'architecture backend (schéma de base de données relationnelle ou NoSQL, design des endpoints HTTP RESTful ou GraphQL, gestion de la cohérence transactionnelle, tests automatisés sur le cycle de vie complet d'une réservation).
* L'évolution de l'interface utilisateur (formats de données attendus par les composants front, validations côté client alignées avec les validations backend, messages d'erreur cohérents et explicites).
* La mise en place de tests automatisés de bout en bout (tests d'intégration, tests de charge, tests de régression sur les scénarios critiques : création de réservation avec acompte, annulation, replanification, import de calendrier externe avec conflit de créneaux).

---

## Modèle économique

Le modèle économique d'ArtisanConnect repose sur un abonnement mensuel ou annuel, aligné sur la valeur perçue et mesurable par l'artisan. Le pricing visible dans l'interface reflète trois niveaux d'offre :

**Starter (gratuit) :**

* Jusqu'à 10 réservations par mois (limite stricte, compteur visible dans l'interface artisan).
* Module de réservation en ligne avec catalogue de services de base.
* Notifications email au client (pas de SMS).
* Synchronisation calendrier en lecture seule (import des indisponibilités, mais pas d'export automatique des réservations confirmées vers les calendriers externes).
* Support standard par email (délai de réponse sous 48 heures ouvrées).
* Idéal pour tester la prise de rendez-vous en ligne sur une période d'essai de 1 à 2 mois avant de passer à l'offre Pro.

**Pro (29 € par mois ou 290 € par an avec 2 mois offerts) :**

* Réservations illimitées (pas de limite mensuelle).
* Acomptes obligatoires sur chaque rendez-vous avec intégration Stripe sécurisée et conforme PCI-DSS.
* Rappels SMS + email automatiques envoyés 24 heures avant chaque intervention (réduction prouvée de 50 % des no-shows selon les études de marché).
* Synchronisation bidirectionnelle complète des calendriers (import des indisponibilités + export automatique des réservations confirmées vers Google Calendar, Outlook, Apple Calendar).
* Support prioritaire par email et chat en direct (délai de réponse sous 4 heures ouvrées, assistance technique personnalisée).
* Statistiques de base : nombre de réservations par mois, taux d'annulation, chiffre d'affaires généré, créneaux les plus demandés.
* Accès aux mises à jour et nouvelles fonctionnalités en priorité.

**Business (sur devis, à partir de 99 € par mois) :**

* Multi-comptes artisans et gestion d'équipes (plusieurs agendas synchronisés, affectation automatique des créneaux par zone géographique ou spécialité).
* Statistiques avancées et suivi des no-shows (tableaux de bord détaillés, export CSV/Excel, rapports mensuels automatisés).
* Intégration API complète et connecteurs métier sur mesure (CRM, logiciel de comptabilité, gestion de stock, outils de facturation).
* Accompagnement personnalisé au déploiement (onboarding dédié, formation de l'équipe, configuration avancée des services et horaires).
* Support dédié avec interlocuteur unique (téléphone, visio, intervention sur site si nécessaire).
* Personnalisation de la marque (logo, couleurs, domaine personnalisé type agenda.monentreprise.fr).

**Possibilité complémentaire (optionnelle, activation par l'artisan) :**

* Frais minimes sur les transactions d'acompte (exemple : 2 % + 0,25 € par transaction, au-dessus du tarif de Stripe, pour couvrir les coûts de support et de développement).
* Cette option permet à l'artisan de choisir entre un abonnement fixe plus élevé ou un modèle mixte (abonnement + commission sur chaque acompte encaissé).

**Raison économique solide :**

* Éviter une seule annulation par mois (perte sèche de 80 à 120 € en moyenne selon le type d'intervention) couvre largement le coût d'un abonnement Pro à 29 € par mois.
* Gain de temps estimé à 5 à 10 heures par mois en évitant les appels répétés, les relances de confirmation et la gestion manuelle des rappels, ce qui représente un coût d'opportunité de 100 à 200 € pour un artisan facturant 40 à 80 € de l'heure.
* Amélioration de l'image professionnelle et augmentation du taux de conversion des prospects en clients (interface moderne, paiement sécurisé, confirmation instantanée).

---

## Différenciation et positionnement concurrentiel

**Par rapport aux agendas généralistes (Google Calendar, Outlook) :**

* ArtisanConnect est spécifiquement conçu pour les artisans, avec acompte obligatoire intégré, gestion de services métier et synchronisation bidirectionnelle des indisponibilités (Google Calendar ne gère pas nativement les acomptes ni les rappels SMS).

**Par rapport aux solutions de prise de rendez-vous généralistes (Calendly, Doodle) :**

* Acompte obligatoire (Calendly ne le propose pas nativement), synchronisation calendrier avancée avec import des indispos et export des réservations, pricing transparent adapté aux petites entreprises (Calendly facture à partir de 12 $ par utilisateur par mois sans inclure les paiements).

**Par rapport aux logiciels métier lourds (Planity, Yoplanning) :**

* Simplicité d'adoption (30 minutes contre plusieurs jours de formation), tarification accessible pour un artisan solo (29 € vs 50 à 100 € par mois), interface mobile-first et moderne, sans fonctionnalités superflues (gestion de stock, facturation complexe, RH).

**Par rapport aux solutions de paiement uniquement (Stripe, PayPal) :**

* ArtisanConnect combine agenda, réservation en ligne, synchronisation calendrier et paiement d'acompte dans une seule interface cohérente, là où Stripe ne gère que le paiement (l'artisan devrait alors coder lui-même l'agenda ou utiliser plusieurs outils déconnectés).

---

## Indicateurs de succès (KPI produit)

Pour mesurer l'atteinte des objectifs produit et valider l'adéquation produit-marché, ArtisanConnect suivra les indicateurs clés suivants :

* Taux d'adoption : nombre d'artisans inscrits et actifs (au moins 1 réservation créée dans le mois) / nombre total d'inscriptions.
* Taux de conversion Starter → Pro : pourcentage d'utilisateurs Starter qui passent à l'offre Pro après la période d'essai.
* Taux d'annulation des réservations : pourcentage de réservations annulées par rapport au total de réservations créées (objectif : descendre sous 10 % avec les rappels automatiques et l'acompte).
* Taux de no-show : pourcentage de réservations confirmées où le client ne s'est pas présenté sans prévenir (objectif : descendre sous 5 % grâce aux rappels SMS et à l'acompte obligatoire).
* Chiffre d'affaires moyen par artisan : montant total des acomptes encaissés + prix des interventions réalisées, mesuré mensuellement.
* Net Promoter Score (NPS) : satisfaction globale des artisans mesurée par la question « Recommanderiez-vous ArtisanConnect à un confrère ? » (objectif : NPS > 50).
* Temps moyen de traitement d'une réservation : temps écoulé entre le clic du client sur « Ouvrir mes créneaux » et la confirmation finale (objectif : moins de 2 minutes).

---

## Synthèse

ArtisanConnect apporte une réponse simple, concrète, mesurable et rentable à un problème quotidien des artisans indépendants : la gestion des rendez-vous, les annulations non compensées, les doublons de planning et la complexité administrative liée à la prise de rendez-vous téléphonique. La vision produit est désormais claire, documentée et alignée avec le code existant. Elle servira de référence unique pour guider toutes les prochaines décisions d'UX, d'architecture technique, de développement backend et de stratégie de monétisation. Le MVP est défini de manière précise, réaliste et cohérente avec les attentes du persona cible, tout en restant simple à comprendre, à utiliser et à déployer.