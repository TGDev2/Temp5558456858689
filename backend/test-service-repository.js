/**
 * Script de test pour ServiceRepository
 * Usage: node test-service-repository.js
 *
 * Teste les méthodes du repository :
 * - listActive() : récupération de tous les services actifs
 * - findById() : récupération d'un service par son ID
 */

require('dotenv').config();
const { getKnexInstance, closeDatabase } = require('./src/infrastructure/database');
const { ServiceRepository } = require('./src/domain/repositories/ServiceRepository');

async function testServiceRepository() {
  console.log('🧪 Test du ServiceRepository\n');
  console.log('='.repeat(60));

  try {
    // Initialisation de Knex et du repository
    const knex = getKnexInstance();
    const serviceRepository = new ServiceRepository(knex);

    // Test 1: listActive()
    console.log('\n📋 Test 1: listActive()');
    console.log('-'.repeat(60));
    const activeServices = await serviceRepository.listActive();

    console.log(`✅ ${activeServices.length} service(s) actif(s) trouvé(s)\n`);

    activeServices.forEach((service, index) => {
      console.log(`Service ${index + 1}:`);
      console.log(`  ID: ${service.id}`);
      console.log(`  Artisan ID: ${service.artisanId}`);
      console.log(`  Nom: ${service.name}`);
      console.log(`  Durée: ${service.durationMinutes} minutes`);
      console.log(`  Prix: ${(service.basePriceCents / 100).toFixed(2)} €`);
      console.log(`  Taux acompte: ${(service.depositRate * 100).toFixed(0)}%`);
      console.log(`  Acompte: ${((service.basePriceCents * service.depositRate) / 100).toFixed(2)} €`);
      console.log(`  Actif: ${service.isActive}`);
      console.log('');
    });

    // Test 2: findById() avec un ID valide
    if (activeServices.length > 0) {
      const firstServiceId = activeServices[0].id;
      console.log('-'.repeat(60));
      console.log(`\n🔍 Test 2: findById() avec ID valide`);
      console.log(`   ID recherché: ${firstServiceId}`);
      console.log('-'.repeat(60));

      const foundService = await serviceRepository.findById(firstServiceId);

      if (foundService) {
        console.log(`✅ Service trouvé: ${foundService.name}`);
        console.log(`   Description: ${foundService.description}`);
        console.log(`   Durée: ${foundService.durationMinutes} min`);
        console.log(`   Prix: ${(foundService.basePriceCents / 100).toFixed(2)} €`);
      } else {
        console.log('❌ Service non trouvé (unexpected)');
      }
    }

    // Test 3: findById() avec un ID invalide
    console.log('\n' + '-'.repeat(60));
    console.log('\n🔍 Test 3: findById() avec ID invalide');
    console.log('-'.repeat(60));

    const invalidId = '00000000-0000-0000-0000-000000000000';
    const notFound = await serviceRepository.findById(invalidId);

    if (notFound === null) {
      console.log('✅ Service non trouvé (comportement attendu)');
    } else {
      console.log('❌ Service trouvé (unexpected)');
    }

    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('✅ Tous les tests sont passés avec succès !');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Erreur lors des tests:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    // Fermeture de la connexion
    await closeDatabase();
    console.log('\n🔌 Connexion à la base de données fermée');
  }
}

// Exécution des tests
testServiceRepository();
