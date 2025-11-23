# Company Data Loading Script

This script fetches Finnish company data from the PRH (Finnish Patent and Registration Office) API, translates industry categories to English using DeepL, vectorizes the data with Voyage AI, and stores it in Supabase for semantic search.

## 🚀 Setup Instructions

### 1. Install Dependencies

From the parent `script` directory:

```bash
npm install
```

### 2. Configure Environment Variables

The script uses the `.env` file in the parent `script` directory:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Voyage AI Configuration
VOYAGE_API_KEY=your_voyage_api_key

# DeepL Translation API Configuration
DEEPL_API_KEY=your_deepl_api_key

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

## 🎯 Running the Script

From the parent `script` directory:

```bash
npm start
# or
npm start company
```

This will:
1. Fetch 100 companies from PRH API (registered after 2020 with industry classifications)
2. Translate Finnish industry category names to English using DeepL
3. Create text representations including company name, business ID, industry, description, and address
4. Generate 1024-dimensional vector embeddings using Voyage AI
5. Store both the company data and embeddings in Supabase

**Note**: With free tier rate limits, the script processes companies in batches of 100 with 60-second delays between batches.

### Processing Time

- **100 companies**: ~2-3 minutes
- **500 companies**: ~5-6 minutes (with rate limit delays)

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
- ✅ Generates semantic search embeddings (Voyage AI voyage-2 model)
- ✅ Stores data in Supabase with vector similarity search support
- ✅ Handles rate limits with automatic batching and delays
- ✅ Updates existing records using upsert (based on business_id)

## 🛠️ Troubleshooting

### Rate Limit Errors

**Voyage AI**: "reduced rate limits of 3 RPM"
- Solution: Add payment method to increase to 300 RPM (still free tokens apply)
- Or: Script automatically handles this with 60-second delays

**DeepL**: 429 rate limit errors
- Solution: Fallback translation map kicks in automatically
- Or: Wait a few minutes and retry

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

- The script uses `.upsert()` which updates existing records based on `business_id`
- Vector embeddings include: company name, business ID, industry category, description, address, and registration date
- Industry classifications are fetched from Statistics Finland API and cached
- All category names are translated to English for international usability
