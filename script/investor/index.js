import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

// ============================================
// CONFIGURATION - ADD YOUR API KEYS IN .env FILE
// ============================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 50;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Read and parse investors JSON file
 * @returns {Array} Array of investor objects
 */
function loadInvestorsFromJSON() {
  console.log('📖 Loading investors from JSON file...');
  
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const jsonPath = join(__dirname, '../investors.json');
    const jsonData = readFileSync(jsonPath, 'utf-8');
    const investors = JSON.parse(jsonData);
    
    console.log(`✅ Loaded ${investors.length} investors from JSON`);
    return investors;
  } catch (error) {
    console.error('❌ Error reading investors.json:', error.message);
    throw error;
  }
}

/**
 * Process investor data for storage and vectorization
 * @param {Object} investor - Investor object from JSON
 * @returns {Object} Processed investor object
 */
function processInvestorData(investor) {
  // Store ALL fields in the investor table
  return {
    investor_id: investor.id,
    name: investor.name,
    details: investor // Store complete investor data
  };
}

/**
 * Create rich text representation for vectorization (only specified fields)
 * @param {Object} investor - Investor object from JSON
 * @returns {string} Text representation
 */
function createInvestorText(investor) {
  const name = investor.name || '';
  const role = investor.role || '';
  const firm = investor.firm || '';
  const location = investor.location || '';
  const preferredIndustries = investor.preferred_industries?.join(', ') || '';
  const businessModels = investor.business_models?.join(', ') || '';
  const preferredRounds = investor.preferred_rounds?.join(', ') || '';
  const geoFocus = investor.geo_focus?.join(', ') || '';
  const checkSize = investor.check_size_range || '';
  const thesis = investor.investment_thesis || '';
  const avoidIndustries = investor.avoid_industries?.join(', ') || '';
  
  return `Investor: ${name}. Role: ${role}${firm ? ` at ${firm}` : ''}. Location: ${location}. Investment Thesis: ${thesis}. Preferred Industries: ${preferredIndustries}. Business Models: ${businessModels}. Preferred Rounds: ${preferredRounds}. Geographic Focus: ${geoFocus}. Check Size: ${checkSize}. Avoid Industries: ${avoidIndustries}.`;
}

/**
 * Convert text to vectors using Voyage AI (with rate limit handling)
 * @param {Array<string>} texts - Array of text strings to vectorize
 * @returns {Promise<Array<Array<number>>>} Array of vectors
 */
async function vectorizeWithVoyage(texts) {
  console.log(`🧮 Vectorizing ${texts.length} investor profiles with Voyage AI...`);
  
  // Batch size: 100 investors per request (safe for rate limits)
  const batchSize = 100;
  const allVectors = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(texts.length / batchSize);
    
    console.log(`  📦 Batch ${batchNum}/${totalBatches}: Vectorizing ${batch.length} investors...`);
    
    try {
      const response = await axios.post(
        'https://api.voyageai.com/v1/embeddings',
        {
          input: batch,
          model: 'voyage-2'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${VOYAGE_API_KEY}`
          }
        }
      );

      const vectors = response.data.data.map(item => item.embedding);
      allVectors.push(...vectors);
      console.log(`  ✅ Batch ${batchNum}/${totalBatches}: Generated ${vectors.length} vectors`);
      
      // Wait 60 seconds between batches to respect 3 RPM rate limit (free tier)
      if (i + batchSize < texts.length) {
        console.log(`  ⏳ Waiting 60 seconds for rate limit...`);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    } catch (error) {
      console.error(`❌ Error in batch ${batchNum}:`, error.response?.data || error.message);
      throw error;
    }
  }

  console.log(`✅ Generated ${allVectors.length} vectors total`);
  return allVectors;
}

/**
 * Store investors with vectors in Supabase
 * @param {Array} investors - Array of investor objects
 * @param {Array} vectors - Array of corresponding vectors
 */
async function storeInSupabase(investors, vectors) {
  console.log(`💾 Storing ${investors.length} investors in Supabase...`);
  
  try {
    // Step 1: Insert or update investors in 'investor' table
    const investorData = investors.map(investor => ({
      investor_id: investor.investor_id,
      details: investor.details
    }));

    console.log(`  📦 Inserting investors into 'investor' table...`);
    
    const { data: insertedInvestors, error: investorError } = await supabase
      .from('investor')
      .upsert(investorData, { 
        onConflict: 'investor_id',
        ignoreDuplicates: false 
      })
      .select('id, investor_id');

    if (investorError) {
      console.error(`❌ Error inserting investors:`, investorError);
      throw investorError;
    }

    console.log(`  ✅ Inserted ${insertedInvestors?.length || investors.length} investors`);

    // Step 2: Get investor IDs (either from insert or fetch)
    const { data: investorRecords, error: fetchError } = await supabase
      .from('investor')
      .select('id, investor_id')
      .in('investor_id', investors.map(i => i.investor_id));

    if (fetchError) {
      console.error(`❌ Error fetching investor IDs:`, fetchError);
      throw fetchError;
    }

    // Create a map of investor_id to investor id
    const investorIdToDbId = {};
    investorRecords.forEach(record => {
      investorIdToDbId[record.investor_id] = record.id;
    });

    // Step 3: Insert embeddings into 'investor_embeddings' table
    console.log(`  📦 Inserting embeddings into 'investor_embeddings' table...`);
    
    const embeddingData = investors.map((investor, index) => ({
      investor_id: investorIdToDbId[investor.investor_id],
      embeddings: vectors[index]
    })).filter(item => item.investor_id); // Only insert if we have a valid investor_id

    // Insert embeddings in batches to avoid payload size limits
    for (let i = 0; i < embeddingData.length; i += BATCH_SIZE) {
      const batch = embeddingData.slice(i, i + BATCH_SIZE);
      console.log(`  📦 Inserting embedding batch ${Math.floor(i / BATCH_SIZE) + 1}...`);
      
      const { error: embeddingError } = await supabase
        .from('investor_embeddings')
        .upsert(batch, {
          onConflict: 'investor_id',
          ignoreDuplicates: false
        });

      if (embeddingError) {
        console.error(`❌ Error inserting embeddings batch:`, embeddingError);
        throw embeddingError;
      }
    }

    console.log(`✅ Successfully stored all investors and embeddings in Supabase`);
  } catch (error) {
    console.error('❌ Error storing in Supabase:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting investor data pipeline...\n');

  try {
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !VOYAGE_API_KEY) {
      throw new Error('⚠️  Missing required environment variables. Please check your .env file.');
    }

    // Step 1: Load investors from JSON
    const rawInvestors = loadInvestorsFromJSON();
    
    if (rawInvestors.length === 0) {
      console.log('⚠️  No investors found in JSON file. Exiting...');
      return;
    }

    // Step 2: Process investor data (store all fields)
    console.log('\n📊 Processing investor data...');
    const investors = rawInvestors.map(processInvestorData);
    console.log(`✅ Processed ${investors.length} investors`);

    // Step 3: Create text representations (only specified fields for embeddings)
    console.log('\n📝 Creating text representations for embeddings...');
    const investorTexts = rawInvestors.map(createInvestorText);

    // Step 4: Vectorize with Voyage AI
    console.log('\n🔄 Vectorizing investors...');
    const vectors = await vectorizeWithVoyage(investorTexts);

    // Step 5: Store in Supabase
    console.log('\n💫 Storing in Supabase...');
    await storeInSupabase(investors, vectors);

    console.log('\n✨ Pipeline completed successfully! ✨\n');
    console.log(`📊 Summary:`);
    console.log(`   - Investors processed: ${investors.length}`);
    console.log(`   - Vectors generated: ${vectors.length}`);
    console.log(`   - Dimension: 1024`);
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error.message);
    process.exit(1);
  }
}

// Run the pipeline
main();
