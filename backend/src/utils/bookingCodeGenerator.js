/**
 * Module de génération de codes de réservation uniques
 * Format : AC-XXXXXX (AC = ArtisanConnect, XXXXXX = 6 caractères alphanumériques)
 *
 * Caractères autorisés : A-Z, 0-9 (excluant caractères ambigus I, O, 1, 0)
 * Espace de codes possibles : 32^6 = 1,073,741,824 combinaisons
 */

const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 caractères (sans I, O, 1, 0)
const CODE_PREFIX = 'AC-';
const CODE_LENGTH = 6;

/**
 * Génère un code de réservation aléatoire au format AC-XXXXXX
 *
 * @returns {string} Code de réservation (ex: "AC-A3B7K9")
 */
function generateBookingCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const randomIndex = Math.floor(Math.random() * ALLOWED_CHARS.length);
    code += ALLOWED_CHARS[randomIndex];
  }
  return CODE_PREFIX + code;
}

/**
 * Génère un code de réservation unique en vérifiant l'unicité en base
 * Tente jusqu'à 10 fois avant de lever une erreur
 *
 * @param {Function} checkUniqueness - Fonction async qui retourne true si le code est unique
 * @returns {Promise<string>} Code de réservation unique
 * @throws {Error} Si impossible de générer un code unique après 10 tentatives
 */
async function generateUniqueBookingCode(checkUniqueness) {
  const MAX_ATTEMPTS = 10;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const code = generateBookingCode();
    // eslint-disable-next-line no-await-in-loop
    const isUnique = await checkUniqueness(code);

    if (isUnique) {
      return code;
    }

    // Log warning si collision (très rare statistiquement)
    console.warn(
      `Code collision detected: ${code} (attempt ${attempt}/${MAX_ATTEMPTS})`
    );
  }

  throw new Error(
    `Failed to generate unique booking code after ${MAX_ATTEMPTS} attempts`
  );
}

/**
 * Valide qu'un code de réservation respecte le format AC-XXXXXX
 *
 * @param {string} code - Code à valider
 * @returns {boolean} true si le format est valide
 */
function isValidBookingCode(code) {
  if (typeof code !== 'string') {
    return false;
  }

  // Vérifier le format AC-XXXXXX (6 caractères alphanumériques)
  const regex = new RegExp(
    `^${CODE_PREFIX}[${ALLOWED_CHARS}]{${CODE_LENGTH}}$`
  );
  return regex.test(code);
}

module.exports = {
  generateBookingCode,
  generateUniqueBookingCode,
  isValidBookingCode,
  ALLOWED_CHARS,
  CODE_PREFIX,
  CODE_LENGTH,
};
