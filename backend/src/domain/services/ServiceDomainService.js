/**
 * ServiceDomainService
 * Couche métier pour la gestion des services proposés par l'artisan
 *
 * Cette version MVP utilise des données en mémoire alignées avec le catalogue front existant.
 * Jalon futur : remplacer par ServiceRepository avec requêtes PostgreSQL.
 */

// Données en dur alignées avec js/booking-core.js du front
// Format conforme au modèle de domaine (domain-model.md)
const ARTISAN_ID = 'artisan-demo-1';

const SERVICES_IN_MEMORY = [
  {
    id: 'diag',
    artisanId: ARTISAN_ID,
    name: 'Diagnostic et audit complet',
    description:
      'Diagnostic plomberie avec rapport détaillé et recommandations',
    durationMinutes: 30,
    basePriceCents: 4000, // 40,00 €
    depositRate: 0.3, // 30%
    isActive: true,
  },
  {
    id: 'urgence',
    artisanId: ARTISAN_ID,
    name: 'Intervention urgente',
    description: 'Dépannage sous 2 heures, disponible 24/7',
    durationMinutes: 45,
    basePriceCents: 12000, // 120,00 €
    depositRate: 0.4, // 40%
    isActive: true,
  },
  {
    id: 'maintenance',
    artisanId: ARTISAN_ID,
    name: 'Maintenance planifiée',
    description: 'Entretien préventif avec créneaux réguliers',
    durationMinutes: 60,
    basePriceCents: 8000, // 80,00 €
    depositRate: 0.3, // 30%
    isActive: true,
  },
  {
    id: 'installation',
    artisanId: ARTISAN_ID,
    name: 'Installation / mise en service',
    description: 'Installation complète avec garantie et suivi',
    durationMinutes: 90,
    basePriceCents: 16000, // 160,00 €
    depositRate: 0.35, // 35%
    isActive: true,
  },
];

/**
 * Liste tous les services actifs pour l'artisan
 * @returns {Array} Liste des services actifs
 */
const listActiveServices = () =>
  SERVICES_IN_MEMORY.filter((service) => service.isActive);

/**
 * Récupère un service par son identifiant
 * @param {string} serviceId - Identifiant du service
 * @returns {Object|null} Service trouvé ou null
 */
const getServiceById = (serviceId) =>
  SERVICES_IN_MEMORY.find(
    (service) => service.id === serviceId && service.isActive
  ) || null;

module.exports = {
  listActiveServices,
  getServiceById,
};
