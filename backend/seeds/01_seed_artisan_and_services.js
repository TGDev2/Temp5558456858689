/**
 * Seed initial : artisan de démonstration et services
 * Insère un artisan Marc (plombier, persona principal) avec ses 4 services métier
 * Données cohérentes avec vision.md et ServiceDomainService en mémoire
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function seed(knex) {
  // Suppression des données existantes (ordre inverse des dépendances)
  await knex('bookings').del();
  await knex('services').del();
  await knex('artisans').del();

  // Insertion de l'artisan de démonstration (Marc, plombier à son compte)
  const [artisan] = await knex('artisans')
    .insert({
      id: knex.raw('gen_random_uuid()'),
      business_name: 'Marc Dupont - Plomberie',
      email: 'marc.dupont@artisanconnect-demo.fr',
      phone: '+33612345678',
      description:
        'Plombier professionnel depuis 8 ans. Zone d\'intervention péri-urbaine (rayon 30 km). Interventions rapides, devis gratuit, garantie décennale.',
      address: '12 rue des Artisans',
      city: 'Lyon',
      postal_code: '69003',
      country: 'France',
      is_active: true,
    })
    .returning('*');

  // Insertion des 4 services proposés par Marc
  // Alignés avec les données en mémoire de ServiceDomainService.js
  await knex('services').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      artisan_id: artisan.id,
      name: 'Diagnostic et audit complet',
      description:
        'Diagnostic plomberie avec rapport détaillé et recommandations. Idéal avant achat immobilier ou rénovation.',
      duration_minutes: 30,
      price_cents: 4000, // 40,00 €
      deposit_rate: 0.3, // 30%
      is_active: true,
    },
    {
      id: knex.raw('gen_random_uuid()'),
      artisan_id: artisan.id,
      name: 'Intervention urgente',
      description:
        'Dépannage sous 2 heures, disponible 24/7. Fuite, canalisation bouchée, chauffe-eau en panne.',
      duration_minutes: 45,
      price_cents: 12000, // 120,00 €
      deposit_rate: 0.4, // 40%
      is_active: true,
    },
    {
      id: knex.raw('gen_random_uuid()'),
      artisan_id: artisan.id,
      name: 'Maintenance planifiée',
      description:
        'Entretien préventif avec créneaux réguliers. Vérification chauffe-eau, détartrage, contrôle robinetterie.',
      duration_minutes: 60,
      price_cents: 8000, // 80,00 €
      deposit_rate: 0.3, // 30%
      is_active: true,
    },
    {
      id: knex.raw('gen_random_uuid()'),
      artisan_id: artisan.id,
      name: 'Installation / mise en service',
      description:
        'Installation complète avec garantie et suivi : chauffe-eau, lavabo, WC, douche, robinetterie.',
      duration_minutes: 90,
      price_cents: 16000, // 160,00 €
      deposit_rate: 0.35, // 35%
      is_active: true,
    },
  ]);

  console.log('✅ Seed terminé : artisan Marc Dupont créé avec 4 services');
  console.log(`   Artisan ID: ${artisan.id}`);
  console.log(`   Email: ${artisan.email}`);
  console.log('   Services: Diagnostic, Urgence, Maintenance, Installation');
};
