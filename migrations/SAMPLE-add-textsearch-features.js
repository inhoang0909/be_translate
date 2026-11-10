/**
 * Optional: Database Migration File
 * Use this if you want to track schema changes in version control
 * 
 * File: migrations/YYYYMMDD-add-textsearch-features.js
 * 
 * Usage (if using Sequelize migrations):
 *   npx sequelize-cli db:migrate
 * 
 * Or manually in PostgreSQL:
 *   1. Enable extensions: CREATE EXTENSION IF NOT EXISTS pg_trgm, unaccent;
 *   2. Create index: CREATE INDEX idx_vocabulary_translation_textsearch_trgm 
 *                    ON "VocabularyTranslations" USING gin (textSearch gin_trgm_ops);
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Enable PostgreSQL extensions
    await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS unaccent;`);

    // Step 2: Create GIN index for textSearch field
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_vocabulary_translation_textsearch_trgm 
       ON "VocabularyTranslations" USING gin (textSearch gin_trgm_ops);`
    );

    // Step 3: Synchronize existing data (optional but recommended)
    // This is commented out because it should be done separately
    // Uncomment if you want to sync existing data during migration
    /*
    const VocabularyTranslation = require('../models/VocabularyTranslation').default;
    await VocabularyTranslation.sequelize.query(
      `UPDATE "VocabularyTranslations" 
       SET textSearch = LOWER(REGEXP_REPLACE(
         normalize(text, 'NFC'),
         '[^\w\s]', '', 'g'
       ))
       WHERE textSearch IS NULL AND text IS NOT NULL;`
    );
    */
  },

  down: async (queryInterface, Sequelize) => {
    // Rollback: Drop the index
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS idx_vocabulary_translation_textsearch_trgm;`
    );

    // Optionally disable extensions (be careful - other tables may use them)
    // await queryInterface.sequelize.query(`DROP EXTENSION IF EXISTS pg_trgm CASCADE;`);
    // await queryInterface.sequelize.query(`DROP EXTENSION IF EXISTS unaccent CASCADE;`);
  }
};
