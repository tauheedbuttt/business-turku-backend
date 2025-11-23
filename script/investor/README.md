# Investor Data Loading Script

This script reads investor data from a JSON file, extracts specified attributes, generates vector embeddings using Voyage AI, and stores them in Supabase for semantic search.

## 🚀 Setup Instructions

### 1. Install Dependencies

From the parent `script` directory:

```bash
npm install
```

### 2. Configure Environment Variables

The script uses the same `.env` file as the company script (located in `script/.env`):

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Voyage AI Configuration
VOYAGE_API_KEY=your_voyage_api_key

# Optional: Batch size for processing
BATCH_SIZE=50
```

Refer to the main [script README](../README.md) for detailed instructions on getting API keys.

### 3. Prepare Investor Data

Place your `investors.json` file in the parent `script` directory. The JSON should contain an array of investor objects with the following structure:

```json
[
  {
    "id": "investor_01",
    "name": "Investor Name",
    "role": "Role",
    "firm": "Firm Name",
    "location": "City, Country",
    "preferred_industries": ["Industry1", "Industry2"],
    "business_models": ["B2B", "SaaS"],
    "preferred_rounds": ["Seed", "Series A"],
    "geo_focus": ["Region1", "Region2"],
    "check_size_range": "$500k–$2M",
    "investment_thesis": "Investment thesis description",
    "avoid_industries": ["Industry3", "Industry4"]
  }
]
```

### 4. Setup Supabase Database

Ensure you have the `investor` and `investor_embeddings` tables created in your Supabase database. Run this SQL in your Supabase SQL Editor:

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create investor table
CREATE TABLE IF NOT EXISTS investor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id VARCHAR UNIQUE NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create investor embeddings table
CREATE TABLE IF NOT EXISTS investor_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investor(id) ON DELETE CASCADE UNIQUE,
  embeddings VECTOR(1024),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_investor_investor_id ON investor(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_embeddings_investor_id ON investor_embeddings(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_embeddings_vector ON investor_embeddings USING hnsw (embeddings vector_cosine_ops);
```

## 🎯 Running the Script

From the parent `script` directory:

```bash
npm start investor
```

This will:
1. Read `investors.json` from the script directory
2. Extract the specified attributes:
   - `preferred_industries`
   - `business_models`
   - `preferred_rounds`
   - `geo_focus`
   - `check_size_range`
   - `investment_thesis`
   - `avoid_industries`
3. Create rich text representations for semantic search
4. Generate 1024-dimensional vector embeddings using Voyage AI
5. Store both the investor data and embeddings in Supabase

### Processing Time

- **20 investors**: ~1 minute
- **100+ investors**: Processes in batches of 100 with 60-second delays for free tier rate limits

## 📊 Data Schema

### Investor Table
```json
{
  "id": "uuid",
  "investor_id": "string (unique)",
  "details": {
    "name": "string",
    "role": "string",
    "firm": "string",
    "location": "string",
    "preferred_industries": ["array"],
    "business_models": ["array"],
    "preferred_rounds": ["array"],
    "geo_focus": ["array"],
    "check_size_range": "string",
    "investment_thesis": "string",
    "avoid_industries": ["array"]
  }
}
```

### Investor Embeddings Table
```json
{
  "id": "uuid",
  "investor_id": "uuid (foreign key)",
  "embeddings": "vector(1024)"
}
```

## 🔍 Text Representation

The vector embeddings include:
- Investor name, role, and firm
- Location
- Investment thesis
- Preferred industries
- Business models
- Preferred funding rounds
- Geographic focus
- Check size range
- Industries to avoid

This enables semantic search queries like:
- "Investors focusing on B2B SaaS in Europe"
- "Seed investors interested in AI and climate tech"
- "Investors with check sizes $500k-$2M in fintech"

## 🛠️ Troubleshooting

### Rate Limit Errors

**Voyage AI**: "reduced rate limits of 3 RPM"
- The script automatically handles this with 60-second delays between batches
- Or add payment method to increase to 300 RPM (free tokens still apply)

### Missing JSON File

If you get "Error reading investors.json":
- Ensure `investors.json` is in the `script` directory (not `script/investor`)
- Check JSON is valid with proper formatting

### Database Errors

If upsert fails:
- Verify the `investor` and `investor_embeddings` tables exist
- Check the `investor_id` field is unique in your JSON
- Ensure vector extension is enabled in Supabase

## 📝 Notes

- The script uses `.upsert()` which updates existing records based on `investor_id`
- All arrays in details are stored as JSONB for flexible querying
- Vector embeddings enable finding investors based on semantic similarity
- The same `.env` configuration is shared with the company script
