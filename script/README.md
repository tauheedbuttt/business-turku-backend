# Business Turku - Data Loading Scripts

This directory contains scripts to load company and investor data into Supabase with vector embeddings for semantic search.

## 📁 Structure

```
script/
├── index.js              # Main entry point with CLI routing
├── company/
│   ├── index.js         # Company data pipeline (PRH API)
│   └── README.md        # Company script documentation
├── investor/
│   ├── index.js         # Investor data pipeline (JSON)
│   └── README.md        # Investor script documentation
├── investors.json        # Investor data file
├── package.json
├── .env
└── README.md            # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in this directory:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Voyage AI Configuration
VOYAGE_API_KEY=your_voyage_api_key

# DeepL Translation API Configuration (for company script)
DEEPL_API_KEY=your_deepl_api_key

# Optional: Batch size for processing
BATCH_SIZE=50
```

### 3. Get API Keys

#### **Supabase**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project → **Settings** → **API**
3. Copy **Project URL** → `SUPABASE_URL`
4. Copy **anon/public key** → `SUPABASE_ANON_KEY`

#### **Voyage AI**
1. Go to [Voyage AI](https://www.voyageai.com/)
2. Sign up → **API Keys** section
3. Create new key → `VOYAGE_API_KEY`

**Note**: Free tier has 3 RPM. Add payment method for 300 RPM (still includes 200M free tokens).

#### **DeepL API** (for company script only)
1. Go to [DeepL API](https://www.deepl.com/pro-api)
2. Sign up for free → **Account** → **API Keys**
3. Copy key → `DEEPL_API_KEY`

**Note**: 500K characters/month free with excellent Finnish translation.

### 4. Run Scripts

```bash
# Load company data from PRH API (default)
npm start

# Load company data explicitly
npm start company

# Load investor data from JSON
npm start investor
```

## 📊 Available Scripts

### Company Data Pipeline

**Command**: `npm start` or `npm start company`

**What it does**:
- Fetches from PRH Open Data API
- Filters companies registered >= 2020 with industry codes
- Translates Finnish categories to English (DeepL)
- Generates vector embeddings (Voyage AI)
- Stores in `company` and `company_embeddings` tables

**Details**: See [company/README.md](company/README.md)

### Investor Data Pipeline

**Command**: `npm start investor`

**What it does**:
- Reads from `investors.json`
- Extracts: preferred_industries, business_models, preferred_rounds, geo_focus, check_size_range, investment_thesis, avoid_industries
- Generates vector embeddings (Voyage AI)
- Stores in `investor` and `investor_embeddings` tables

**Details**: See [investor/README.md](investor/README.md)

## 📝 Database Setup

Run this SQL in your Supabase SQL Editor to create all required tables:

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Company tables
CREATE TABLE IF NOT EXISTS company (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_embeddings (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES company(id) ON DELETE CASCADE,
  embeddings VECTOR(1024),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Investor tables
CREATE TABLE IF NOT EXISTS investor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id VARCHAR UNIQUE NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investor_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investor(id) ON DELETE CASCADE UNIQUE,
  embeddings VECTOR(1024),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_business_id ON company(business_id);
CREATE INDEX IF NOT EXISTS idx_company_embeddings_company_id ON company_embeddings(company_id);
CREATE INDEX IF NOT EXISTS idx_company_embeddings_vector ON company_embeddings USING hnsw (embeddings vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_investor_investor_id ON investor(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_embeddings_investor_id ON investor_embeddings(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_embeddings_vector ON investor_embeddings USING hnsw (embeddings vector_cosine_ops);
```

## 🎯 How It Works

### index.js (Main Router)
- Accepts command-line arguments
- Routes to `company/index.js` or `investor/index.js`
- Default behavior: runs company pipeline

### Company Pipeline
- Fetches from external API (PRH)
- Requires translation (DeepL)
- Processes 100 companies by default

### Investor Pipeline  
- Reads from local JSON file
- No translation needed
- Processes all investors in file

Both pipelines:
1. Extract/process data
2. Create text representations
3. Generate vectors (Voyage AI)
4. Store in Supabase (upsert mode)

## 📚 Additional Resources

- [Company Script Documentation](company/README.md)
- [Investor Script Documentation](investor/README.md)
- [Supabase Documentation](https://supabase.com/docs)
- [Voyage AI Documentation](https://docs.voyageai.com/)
- [DeepL API Documentation](https://www.deepl.com/docs-api)


This script fetches Finnish company data from the PRH (Finnish Patent and Registration Office) API, translates industry categories to English using DeepL, vectorizes the data with Voyage AI, and stores it in Supabase for semantic search.

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in this directory with the following keys:

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

### 3. Get API Keys

#### **Supabase**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (or create a new one)
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_ANON_KEY`

#### **Voyage AI**
1. Go to [Voyage AI](https://www.voyageai.com/)
2. Sign up / Log in
3. Go to **API Keys** section
4. Create a new API key
5. Copy the key → `VOYAGE_API_KEY`

**Note**: Free tier has 3 RPM rate limit. Add payment method for 300 RPM (still includes 200M free tokens).

#### **DeepL API**
1. Go to [DeepL API](https://www.deepl.com/pro-api)
2. Click **Sign up for free**
3. Verify your email and log in
4. Go to **Account** → **API Keys**
5. Copy your **Authentication Key** → `DEEPL_API_KEY`

**Note**: Free tier provides 500K characters/month with excellent Finnish-to-English translation quality.

### 4. Setup Supabase Database

If you haven't already set up the database schema, you'll need to create the required tables:

1. Go to your Supabase project
2. Click on **SQL Editor** in the left sidebar
3. Run the following SQL:

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

### Load Company Data

```bash
npm start
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
