# Text Search with Fuzzy Matching Implementation

## Overview

This implementation adds fuzzy search capabilities with diacritic-stripping normalization to the VocabularyTranslation model. It includes:

- **Diacritic Stripping**: Automatically converts accented characters (é, ñ, ü) to their base forms (e, n, u)
- **Text Normalization**: Standardizes text for consistent searching
- **Automatic Synchronization**: The `textSearch` field is automatically populated when records are saved
- **pg_trgm Support**: PostgreSQL trigram fuzzy search for typo-tolerant matching
- **Batch Synchronization**: Utility to synchronize existing data

## Files Added/Modified

### New Files

1. **`utils/textNormalization.js`**
   - Core normalization functions
   - `stripDiacritics(text)` - Removes accents, converts to lowercase
   - `normalizeForSearch(text)` - Comprehensive normalization for search fields
   - `normalizeTrgm(text)` - Trigram-optimized normalization

2. **`services/textSearchService.js`**
   - Main search service with three key functions:
     - `searchTranslations(keyword, options)` - Fuzzy search with normalization
     - `syncAllTextSearch()` - Batch synchronize existing data
     - `createTrgmIndex()` - Set up database extensions and indexes

3. **`scripts/initTextSearch.js`**
   - One-time initialization script
   - Enables PostgreSQL extensions
   - Creates database indexes
   - Synchronizes all existing vocabulary translations

4. **`documentation/textSearchExamples.js`**
   - Complete usage examples
   - Integration patterns for controllers and routes
   - Best practices

### Modified Files

**`models/VocabularyTranslation.js`**
- Added import of `normalizeForSearch` function
- Added `beforeSave` hook that automatically populates `textSearch` field
- No breaking changes to existing functionality

## Setup Instructions

### Step 1: Database Setup

Run the initialization script once to enable PostgreSQL extensions and create indexes:

```bash
node scripts/initTextSearch.js
```

This script will:
- Enable `pg_trgm` extension (for trigram fuzzy search)
- Enable `unaccent` extension (for accent-insensitive search)
- Create a GIN index on the `textSearch` field for performance
- Synchronize all existing vocabulary translations

### Step 2: Verify Installation

Check that the extensions are enabled:

```sql
-- In PostgreSQL
SELECT * FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent');

-- Check the index exists
SELECT indexname FROM pg_indexes 
WHERE tablename = 'VocabularyTranslations' 
AND indexname LIKE '%textsearch%';
```

## Usage

### Basic Search

```javascript
import { searchTranslations } from '../services/textSearchService.js';

// Search with automatic normalization
const results = await searchTranslations('café', {
  languages: ['vi', 'en'],
  limit: 10,
  useTrgm: true
});

// Returns: VocabularyTranslation records matching normalized text
```

### Automatic Field Population (Hook)

When you create or update a VocabularyTranslation record:

```javascript
const translation = await VocabularyTranslation.create({
  vocabularyId: 1,
  language: 'vi',
  text: 'Café Mộc'  // User input with accents
  // textSearch is automatically populated by the beforeSave hook
});

// After save:
// translation.textSearch = 'cafe moc' (normalized)
```

### Direct Normalization

```javascript
import { stripDiacritics, normalizeForSearch } from '../utils/textNormalization.js';

// Strip only diacritics
stripDiacritics('Café') // -> 'cafe'

// Comprehensive normalization
normalizeForSearch('Café Français!') // -> 'cafe francais'
```

### Integration in Controllers

```javascript
import { searchTranslations } from '../services/textSearchService.js';

router.get('/api/search', async (req, res) => {
  try {
    const { keyword, language } = req.query;
    
    const results = await searchTranslations(keyword, {
      languages: [language],
      limit: 10,
      useTrgm: true
    });
    
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Normalization Examples

| Original Text | Normalized |
|---|---|
| Café | cafe |
| Naïve Résumé | naive resume |
| Tiếng Việt | tieng viet |
| UPPERCASE | uppercase |
| Extra   Spaces | extra spaces |
| Special! @Chars# | special chars |
| Señor González | senor gonzalez |
| Über Straße | uber strae |

## How It Works

### Database Flow

1. **Input**: User creates/updates VocabularyTranslation with text containing accents
2. **Hook**: `beforeSave` hook triggers and normalizes the text
3. **Storage**: Normalized text stored in `textSearch` field
4. **Query**: User searches with keyword (doesn't need to have accents)
5. **Matching**: Normalized keyword compared against normalized `textSearch` field

### Normalization Process

1. **NFD Decomposition**: `"café"` → `"cafe\u0301"` (separate base + accent)
2. **Remove Diacritics**: Remove all combining marks → `"cafe"`
3. **Lowercase**: Convert to lowercase → `"cafe"`
4. **Cleanup**: Remove extra spaces and special characters

### pg_trgm Index

The GIN index on `textSearch` enables fast fuzzy matching:

- PostgreSQL breaks text into 3-character substrings (trigrams)
- Example: `"cafe"` becomes trigrams: `$ca`, `caf`, `afe`, `fe$`
- Queries use these trigrams for fast similarity matching
- Typos like `"cofe"` still match due to overlapping trigrams

## Performance Considerations

- **Index**: The GIN index significantly speeds up searches (especially for large datasets)
- **Hook Overhead**: The `beforeSave` hook adds minimal overhead (normalization is fast)
- **Memory**: Normalization is streamed, no large allocations
- **Database**: pg_trgm index uses additional disk space (~30% of table size for text columns)

## Limitation & Notes

1. **Extension Requirements**
   - Requires PostgreSQL 9.6+ with pg_trgm and unaccent extensions
   - Run `scripts/initTextSearch.js` to enable extensions

2. **Language Support**
   - ✅ Latin languages with diacritics (French, Spanish, Portuguese, etc.)
   - ✅ Vietnamese with diacritics
   - ✅ German umlauts (ü, ö, ä, ß)
   - ✅ ASCII text
   - ⚠️ CJK (Chinese, Japanese, Korean) - preserved as-is, not normalized

3. **Backward Compatibility**
   - Existing records: Use `syncAllTextSearch()` to populate textSearch field
   - New records: textSearch populated automatically via beforeSave hook
   - No breaking changes to existing code

## Troubleshooting

### Issue: "pg_trgm extension not found"

**Solution**: Run initialization script again or manually enable:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Issue: Index not being used

**Solution**: Check if indexes are created and statistics are updated:
```sql
-- Analyze table to update statistics
ANALYZE "VocabularyTranslations";

-- Check operation plans
EXPLAIN ANALYZE 
SELECT * FROM "VocabularyTranslations" 
WHERE textSearch ILIKE '%cafe%';
```

### Issue: Some records have null textSearch

**Solution**: Run synchronization:
```javascript
import { syncAllTextSearch } from '../services/textSearchService.js';
await syncAllTextSearch();
```

## API Reference

### `stripDiacritics(text: string): string`
Removes diacritical marks and converts to lowercase.

### `normalizeForSearch(text: string): string`
Complete normalization: diacritics + special character removal + space cleanup.

### `normalizeTrgm(text: string): string`
Trigram-optimized normalization (keeps more punctuation).

### `searchTranslations(keyword: string, options?: object): Promise<VocabularyTranslation[]>`

Options:
- `languages?: string[]` - Filter by language codes
- `categories?: string[]` - Filter by category names
- `limit?: number` - Max results (default: 10)
- `useTrgm?: boolean` - Use pg_trgm fuzzy matching (default: true)

### `syncAllTextSearch(): Promise<number>`
Synchronizes all existing records. Returns count of updated records.

### `createTrgmIndex(): Promise<void>`
Enables extensions and creates indexes. Run once during setup.

## Examples

See `documentation/textSearchExamples.js` for complete working examples including:
- Controller integration
- Route definitions
- Batch normalization
- Advanced queries

## Future Enhancements

- Phonetic matching (Metaphone, Soundex)
- Language-specific stemming
- Custom stop words
- Search highlighting
- Query suggestions
