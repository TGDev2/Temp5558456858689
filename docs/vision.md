# Vision Produit – ArtisanConnect

## Problématique utilisateur

Les artisans (plombiers, électriciens, chauffagistes, multi-services…) perdent un temps considérable à gérer leurs rendez-vous par téléphone ou messages. Ils subissent des annulations tardives, des « no-shows » non facturés et doivent jongler entre plusieurs calendriers personnels et professionnels. Demander un acompte est souvent gênant ou compliqué, ce qui augmente les risques de créneaux perdus.

Problème central : **Comment permettre à un artisan de gérer un agenda fiable, d’éviter les annulations coûteuses et d’encaisser un acompte facilement, sans complexité technique ni charge administrative supplémentaire ?**

---

## Cible principale

Persona prioritaire :
**Marc, 42 ans, plombier à son compte**, 12–15 interventions par semaine, gère la planification via téléphone/SMS/WhatsApp. Il utilise Google Calendar pour ses rendez-vous personnels, mais n’a pas d’outil métier structuré. Ses douleurs :

* trop d’allers-retours pour fixer un rendez-vous
* annulations de dernière minute non compensées
* oublis ou doublons liés à un agenda mal synchronisé
* difficulté à demander un acompte au téléphone sans gêner le client

Contrainte clé : **Solution simple, en français, mobile-friendly et fiable**, pouvant être adoptée en moins de 30 minutes.

---

## Proposition de valeur

**ArtisanConnect est un agenda en ligne conçu pour les artisans qui veulent arrêter de perdre du temps au téléphone et sécuriser leurs interventions.**

Promesse :

* Les clients réservent eux-mêmes un créneau en ligne.
* Choix du service, durée, prix.
* Paiement d’un acompte obligatoire pour valider la réservation.
* Confirmation immédiate par email/SMS + lien de modification/annulation.
* L’artisan voit son planning mis à jour automatiquement.
* Les indisponibilités provenant de Google/Outlook/Apple sont importées.
* Les rappels automatiques réduisent les no-shows.

Bénéfice clair : **Moins d’administratif, moins d’annulations, plus de revenus et plus de sérénité.**

---

## Faisabilité technique (MVP réaliste)

Éléments déjà présents dans l’interface :

* sélection du service et durée
* génération de créneaux disponibles
* gestion locale des réservations (simulation)
* auto-service client pour gérer son rendez-vous
* faux connecteurs calendriers pour illustrer l’expérience cible
* simulation de paiement d’acompte

Prochaines évolutions naturelles (pas encore implémentées mais cohérentes) :

* backend simple : artisans, services, réservations, indisponibilités, notifications
* intégration d’un prestataire de paiement (Stripe ou équivalent)
* export ICS / connecteurs réels
* système d’événements + logs d’activité pour fiabilité

---

## Contrat fonctionnel du MVP

Le **modèle de données** et le **contrat d’API de réservation** utilisés par ArtisanConnect sont décrits de manière formelle dans le document `docs/domain-model.md`.  
Ce document définit notamment :

* les entités centrales (Artisan, Service, Réservation, Indisponibilité importée, Plan d’abonnement)
* les règles d’intégrité (non chevauchement des créneaux, calcul de l’acompte, statuts de réservation)
* les opérations exposées au front (consultation des services, disponibilités, création/annulation/replanification d’une réservation)

Il sert de référence unique pour :

* la conception de l’architecture backend (schéma de base de données, endpoints HTTP, gestion de la cohérence)
* l’évolution de l’UI (formats de données, validations côté client)
* la mise en place de tests automatisés sur le cycle de vie d’une réservation.

---

## Modèle économique

Aligné sur le contenu visible (pricing Starter/Pro/Business) :

* **Starter :** gratuit, limité (ex. 10 rendez-vous/mois)
* **Pro :** abonnement mensuel (~29 €/mois) : illimité + SMS + acompte + priorité support
* **Business :** multi-artisans + analytics + API

Possibilité complémentaire : frais minimes sur les transactions d’acompte.

Raison économique solide : **éviter une à deux annulations par mois couvre largement le coût d’un abonnement Pro.**

---

## Synthèse

ArtisanConnect apporte une réponse simple, concrète et rentable à un problème quotidien des artisans : la gestion des rendez-vous, les no-shows et la complexité administrative. La vision produit est désormais claire et alignée pour guider toutes les prochaines décisions d’UX, d’architecture et de développement.