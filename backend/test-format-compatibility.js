/**
 * Script de validation de la compatibilité des formats
 * Compare le format retourné par ServiceRepository avec le format attendu par ServiceDomainService
 */

require('dotenv').config();
const { getKnexInstance, closeDatabase } = require('./src/infrastructure/database');
const { ServiceRepository } = require('./src/domain/repositories/ServiceRepository');

// Format attendu par ServiceDomainService (extrait de SERVICES_IN_MEMORY)
const EXPECTED_FORMAT_KEYS = [
  'id',
  'artisanId',
  'name',
  'description',
  'durationMinutes',
  'basePriceCents',
  'depositRate',
  'isActive',
];

async function testFormatCompatibility() {
  console.log('🔬 Test de compatibilité des formats\n');
  console.log('='.repeat(60));

  try {
    const knex = getKnexInstance();
    const serviceRepository = new ServiceRepository(knex);

    // Récupération d'un service via le repository
    const services = await serviceRepository.listActive();

    if (services.length === 0) {
      console.log('⚠️  Aucun service trouvé dans la base de données');
      return;
    }

    const firstService = services[0];

    console.log('\n📋 Format retourné par ServiceRepository:');
    console.log('-'.repeat(60));
    console.log(JSON.stringify(firstService, null, 2));

    console.log('\n✅ Validation des clés requises:');
    console.log('-'.repeat(60));

    let allKeysPresent = true;
    EXPECTED_FORMAT_KEYS.forEach((key) => {
      const isPresent = key in firstService;
      const status = isPresent ? '✅' : '❌';
      console.log(`${status} ${key}: ${isPresent ? typeof firstService[key] : 'MANQUANT'}`);
      if (!isPresent) allKeysPresent = false;
    });

    console.log('\n📊 Validation des types:');
    console.log('-'.repeat(60));

    const typeValidations = [
      { key: 'id', expectedType: 'string', value: firstService.id },
      { key: 'artisanId', expectedType: 'string', value: firstService.artisanId },
      { key: 'name', expectedType: 'string', value: firstService.name },
      { key: 'description', expectedType: 'string', value: firstService.description },
      { key: 'durationMinutes', expectedType: 'number', value: firstService.durationMinutes },
      { key: 'basePriceCents', expectedType: 'number', value: firstService.basePriceCents },
      { key: 'depositRate', expectedType: 'number', value: firstService.depositRate },
      { key: 'isActive', expectedType: 'boolean', value: firstService.isActive },
    ];

    let allTypesValid = true;
    typeValidations.forEach(({ key, expectedType, value }) => {
      const actualType = typeof value;
      const isValid = actualType === expectedType;
      const status = isValid ? '✅' : '❌';
      console.log(`${status} ${key}: attendu=${expectedType}, reçu=${actualType}`);
      if (!isValid) allTypesValid = false;
    });

    console.log('\n📈 Validation des valeurs métier:');
    console.log('-'.repeat(60));

    const businessValidations = [
      {
        name: 'Prix positif',
        valid: firstService.basePriceCents > 0,
        value: firstService.basePriceCents,
      },
      {
        name: 'Durée positive',
        valid: firstService.durationMinutes > 0,
        value: firstService.durationMinutes,
      },
      {
        name: 'Taux acompte valide (0-1)',
        valid: firstService.depositRate >= 0 && firstService.depositRate <= 1,
        value: firstService.depositRate,
      },
      {
        name: 'Service actif',
        valid: firstService.isActive === true,
        value: firstService.isActive,
      },
    ];

    let allBusinessRulesValid = true;
    businessValidations.forEach(({ name, valid, value }) => {
      const status = valid ? '✅' : '❌';
      console.log(`${status} ${name}: ${value}`);
      if (!valid) allBusinessRulesValid = false;
    });

    // Résumé final
    console.log('\n' + '='.repeat(60));
    if (allKeysPresent && allTypesValid && allBusinessRulesValid) {
      console.log('✅ FORMAT PARFAITEMENT COMPATIBLE !');
      console.log('   Le ServiceRepository retourne des entités au format');
      console.log('   attendu par ServiceDomainService.');
    } else {
      console.log('❌ INCOMPATIBILITÉS DÉTECTÉES !');
      if (!allKeysPresent) console.log('   - Certaines clés requises sont manquantes');
      if (!allTypesValid) console.log('   - Certains types ne correspondent pas');
      if (!allBusinessRulesValid) console.log('   - Certaines règles métier ne sont pas respectées');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Erreur lors des tests:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await closeDatabase();
    console.log('\n🔌 Connexion à la base de données fermée');
  }
}

testFormatCompatibility();
