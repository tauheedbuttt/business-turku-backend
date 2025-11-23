# Company Data Loading Script

This script fetches Finnish company data from the PRH (Finnish Patent and Registration Office) API, translates industry categories to English using DeepL, and optionally vectorizes the data with Voyage AI for semantic search in Supabase.

## 🚀 Setup Instructions

### 1. Install Dependencies

From the parent `script` directory:

```bash
npm install
```

### 2. Configure Environment Variables

The script uses the `.env` file in the parent `script` directory:

```env
# Supabase Configuration (Required)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# DeepL Translation API Configuration (Required)
DEEPL_API_KEY=your_deepl_api_key

# Voyage AI Configuration (Required only for --with-embeddings mode)
VOYAGE_API_KEY=your_voyage_api_key

# Optional: Batch size for processing companies
BATCH_SIZE=50
```

Refer to the main [script README](../README.md) for detailed instructions on getting API keys.

### 3. Setup Supabase Database

Ensure you have the `company` and `company_embeddings` tables created in your Supabase database. Run this SQL in your Supabase SQL Editor:

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create companies table
CREATE TABLE IF NOT EXISTS company (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create company embeddings table
CREATE TABLE IF NOT EXISTS company_embeddings (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES company(id) ON DELETE CASCADE,
  embeddings VECTOR(1024),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_company_business_id ON company(business_id);
CREATE INDEX IF NOT EXISTS idx_company_embeddings_company_id ON company_embeddings(company_id);
CREATE INDEX IF NOT EXISTS idx_company_embeddings_vector ON company_embeddings USING hnsw (embeddings vector_cosine_ops);
```

## 🎯 Usage

### Default Mode (Bulk Load - No Embeddings)

Load companies without generating embeddings (faster, suitable for large datasets):

```bash
npm start
# or
npm start company
```

**Default behavior**: Fetches 2000 companies and stores them WITHOUT embeddings.

### With Embeddings Mode

Load companies and generate vector embeddings (slower, required for semantic search):

```bash
npm start company -- --with-embeddings
# or using short flag
npm start company -- -e
```

**Default behavior with embeddings**: Fetches 100 companies with vectorization.

### Custom Limit

Specify a custom number of companies to fetch:

```bash
# Bulk load 500 companies without embeddings
npm start company -- --limit=500

# Load 50 companies with embeddings
npm start company -- --with-embeddings --limit=50
```

### Command Line Options

- `--with-embeddings` or `-e`: Enable vectorization with Voyage AI
- `--limit=N`: Fetch N companies (default: 2000 without embeddings, 100 with embeddings)

## ⚙️ Processing Details

### Default Mode (No Embeddings)
1. Fetches companies from PRH API (registered after 2020 with industry classifications)
2. Translates Finnish industry category names to English using DeepL
3. Checks for existing companies in database (in batches to avoid header overflow)
4. Stores only NEW companies (skips duplicates)
5. No embeddings generated

**Processing Time**:
- **2000 companies**: ~8-10 minutes
- **500 companies**: ~3-4 minutes

### With Embeddings Mode
1. Fetches companies from PRH API
2. Translates Finnish industry category names to English using DeepL
3. Creates text representations including company name, business ID, industry, description, and address
4. Generates 1024-dimensional vector embeddings using Voyage AI (voyage-2 model)
5. Stores both the company data and embeddings in Supabase

**Processing Time** (with free tier rate limits - 3 RPM):
- **100 companies**: ~3-4 minutes
- **500 companies**: ~15-20 minutes (with 60-second delays between batches)

To process more companies, edit the `fetchCompaniesFromAPI()` call in `index.js`:

```javascript
const companies = await fetchCompaniesFromAPI(500); // Change from 100 to 500
```

## 📊 Data Schema

### Company Table
```json
{
  "id": "bigint",
  "business_id": "string (unique)",
  "name": "string",
  "details": {
    "name": "string",
    "description": "string (English)",
    "address": "string",
    "registrationDate": "date",
    "categoryName": "string (translated to English)"
  }
}
```

### Company Embeddings Table
```json
{
  "id": "bigint",
  "company_id": "bigint (foreign key)",
  "embeddings": "vector(1024)"
}
```

## 🔍 Features

- ✅ Fetches companies registered after 2020 with industry classifications
- ✅ Translates Finnish industry categories to English (DeepL API)
- ✅ Fallback translation map for when API rate limits are hit
- ✅ Two modes: bulk load (fast) or with embeddings (semantic search ready)
- ✅ Generates semantic search embeddings (Voyage AI voyage-2 model) when using `--with-embeddings`
- ✅ Stores data in Supabase with optional vector similarity search support
- ✅ Handles rate limits with automatic batching and delays
- ✅ Duplicate prevention: checks existing companies and only inserts new ones
- ✅ Batch processing to avoid HTTP header overflow errors

## 🛠️ Troubleshooting

### Rate Limit Errors

**Voyage AI**: "reduced rate limits of 3 RPM"
- Solution: Add payment method to increase to 300 RPM (still free tokens apply)
- Or: Script automatically handles this with 60-second delays
- Note: Only relevant when using `--with-embeddings` mode

**DeepL**: 429 rate limit errors
- Solution: Fallback translation map kicks in automatically
- Or: Wait a few minutes and retry

### Header Overflow Error

If you see "HeadersOverflowError: Headers Overflow Error":
- This is now fixed with batch checking (100 companies at a time)
- If issue persists, reduce the `--limit` value

### Translation Issues

If you see Finnish text in the database:
- Clear old data and run again (old records may have Finnish text from previous runs)
- Check DeepL API key is valid
- Verify fallback translations are working from the logs

### Missing Companies

If fewer than expected companies are found:
- PRH API filters are strict (registered >= 2020 AND has industry code)
- Try adjusting `registrationDateStart` parameter in the code
- Check the pagination is working correctly in the logs

## 📝 Notes

- Default mode stores companies WITHOUT embeddings for faster bulk loading
- Use `--with-embeddings` when you need semantic search functionality
- The script checks for existing companies and only inserts new ones
- Vector embeddings (when enabled) include: company name, business ID, industry category, description, address, and registration date
- Industry classifications are fetched from Statistics Finland API and cached
- All category names are translated to English for international usability
