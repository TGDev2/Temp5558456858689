/**
 * Seed : Horaires d'ouverture et règles de pause pour l'artisan de démo
 *
 * Peuple les tables opening_rules et break_rules avec des horaires réalistes :
 * - Lundi au vendredi : 08:30 - 18:00 avec pause déjeuner 12:00 - 13:00
 * - Samedi : 09:00 - 13:00 sans pause
 * - Dimanche : Fermé
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function seed(knex) {
  // 1. Récupérer l'artisan de démo créé dans le seed précédent
  const artisan = await knex('artisans')
    .where({ email: 'marc.dupont@artisanconnect-demo.fr' })
    .first();

  if (!artisan) {
    console.log(
      '⚠️  Aucun artisan trouvé. Exécuter d\'abord 01_seed_artisan_and_services.js'
    );
    return;
  }

  console.log(
    `📅 Création des horaires d'ouverture pour ${artisan.business_name}...`
  );

  // 2. Nettoyer les données existantes
  await knex('break_rules').where({ artisan_id: artisan.id }).delete();
  await knex('opening_rules').where({ artisan_id: artisan.id }).delete();

  // 3. Insérer les horaires d'ouverture
  const openingRules = [
    // Lundi (1)
    {
      artisan_id: artisan.id,
      day_of_week: 1,
      start_minutes: 510, // 08:30
      end_minutes: 1080, // 18:00
    },
    // Mardi (2)
    {
      artisan_id: artisan.id,
      day_of_week: 2,
      start_minutes: 510, // 08:30
      end_minutes: 1080, // 18:00
    },
    // Mercredi (3)
    {
      artisan_id: artisan.id,
      day_of_week: 3,
      start_minutes: 510, // 08:30
      end_minutes: 1080, // 18:00
    },
    // Jeudi (4)
    {
      artisan_id: artisan.id,
      day_of_week: 4,
      start_minutes: 510, // 08:30
      end_minutes: 1080, // 18:00
    },
    // Vendredi (5)
    {
      artisan_id: artisan.id,
      day_of_week: 5,
      start_minutes: 510, // 08:30
      end_minutes: 1080, // 18:00
    },
    // Samedi (6)
    {
      artisan_id: artisan.id,
      day_of_week: 6,
      start_minutes: 540, // 09:00
      end_minutes: 780, // 13:00
    },
  ];

  await knex('opening_rules').insert(openingRules);
  console.log(
    `✅ ${openingRules.length} horaires d'ouverture créés (Lundi-Samedi)`
  );

  // 4. Insérer les règles de pause (pause déjeuner du lundi au vendredi)
  const breakRules = [
    // Lundi - Pause déjeuner
    {
      artisan_id: artisan.id,
      day_of_week: 1,
      start_minutes: 720, // 12:00
      end_minutes: 780, // 13:00
    },
    // Mardi - Pause déjeuner
    {
      artisan_id: artisan.id,
      day_of_week: 2,
      start_minutes: 720, // 12:00
      end_minutes: 780, // 13:00
    },
    // Mercredi - Pause déjeuner
    {
      artisan_id: artisan.id,
      day_of_week: 3,
      start_minutes: 720, // 12:00
      end_minutes: 780, // 13:00
    },
    // Jeudi - Pause déjeuner
    {
      artisan_id: artisan.id,
      day_of_week: 4,
      start_minutes: 720, // 12:00
      end_minutes: 780, // 13:00
    },
    // Vendredi - Pause déjeuner
    {
      artisan_id: artisan.id,
      day_of_week: 5,
      start_minutes: 720, // 12:00
      end_minutes: 780, // 13:00
    },
  ];

  await knex('break_rules').insert(breakRules);
  console.log(
    `✅ ${breakRules.length} règles de pause créées (pause déjeuner 12h-13h)`
  );

  console.log('');
  console.log('📊 Résumé des horaires :');
  console.log('  Lundi - Vendredi : 08:30 - 18:00 (pause 12:00 - 13:00)');
  console.log('  Samedi          : 09:00 - 13:00 (sans pause)');
  console.log('  Dimanche        : Fermé');
  console.log('');
  console.log('✨ Seed terminé avec succès !');
};
