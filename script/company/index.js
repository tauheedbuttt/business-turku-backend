import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

dotenv.config();

// ============================================
// CONFIGURATION - ADD YOUR API KEYS IN .env FILE
// ============================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 50;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// PRH API endpoint that returns JSON directly
const PRH_API_URL = 'https://avoindata.prh.fi/opendata-ytj-api/v3/companies';

// Statistics Finland classification API
const STATISTICS_FI_API = 'https://data.stat.fi/api/classifications/v2/classifications/toimiala_1_20250101/classificationItems?content=data&meta=max&lang=fi&format=json';

// Cache for industry classifications
let industryClassifications = null;

/**
 * Fetch industry classifications from Statistics Finland API
 * @returns {Promise<Object>} Map of code to classification data
 */
async function fetchIndustryClassifications() {
  if (industryClassifications) {
    return industryClassifications;
  }

  console.log(`📊 Fetching industry classifications from Statistics Finland...`);
  
  try {
    const response = await axios.get(STATISTICS_FI_API, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    const data = Array.isArray(response.data) ? response.data : [response.data];
    
    // Create a map of code to classification data
    industryClassifications = {};
    data.forEach(item => {
      if (item.code) {
        // Try to find English name first, otherwise use Finnish
        let name = '';
        if (item.classificationItemNames && Array.isArray(item.classificationItemNames)) {
          const englishName = item.classificationItemNames.find(n => n.lang === 'en');
          const finnishName = item.classificationItemNames.find(n => n.lang === 'fi');
          name = englishName?.name || finnishName?.name || '';
        }
        
        // Try to find English description first, otherwise use Finnish
        let description = '';
        if (item.explanatoryNotes && Array.isArray(item.explanatoryNotes)) {
          const note = item.explanatoryNotes[0];
          if (note?.includes && Array.isArray(note.includes)) {
            const englishIndex = note.lang?.indexOf('en') || -1;
            const finnishIndex = note.lang?.indexOf('fi') || -1;
            
            if (englishIndex >= 0) {
              description = note.includes[englishIndex] || '';
            } else if (finnishIndex >= 0) {
              description = note.includes[finnishIndex] || '';
            } else {
              description = note.includes[0] || '';
            }
          }
        }
        
        industryClassifications[item.code] = {
          name: name,
          description: description,
          isFinnish: !item.classificationItemNames?.some(n => n.lang === 'en')
        };
      }
    });
    
    console.log(`✅ Loaded ${Object.keys(industryClassifications).length} industry classifications`);
    return industryClassifications;
  } catch (error) {
    console.error('⚠️  Error fetching industry classifications:', error.message);
    return {};
  }
}

/**
 * Translate Finnish text to English using an API
 * @param {string} text - Finnish text to translate
 * @returns {Promise<string>} English translation
 */
async function translateToEnglish(text) {
  if (!text || text.length === 0) return text;
  
  // Check if it's already in English (basic check)
  const finnishChars = /[äöåÄÖÅ]/;
  if (!finnishChars.test(text) && /^[a-zA-Z\s,.-]+$/.test(text)) {
    return text;
  }
  
  try {
    console.log(`    🌐 Translating: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    // Using DeepL API (500K characters/month free, best quality for European languages)
    const response = await axios.post(
      'https://api-free.deepl.com/v2/translate',
      null,
      {
        params: {
          auth_key: DEEPL_API_KEY,
          text: text,
          source_lang: 'FI',
          target_lang: 'EN'
        },
        timeout: 10000
      }
    );
    
    const translated = response.data.translations[0].text || text;
    console.log(`    ✅ Translated to: "${translated.substring(0, 50)}${translated.length > 50 ? '...' : ''}"`);
    return translated;
  } catch (error) {
    console.warn(`    ⚠️  Translation API failed: ${error.message}`);
    // Fallback to basic translation map
    const basicTranslation = translateFinnishToEnglishBasic(text);
    console.log(`    📖 Using fallback translation: "${basicTranslation.substring(0, 50)}${basicTranslation.length > 50 ? '...' : ''}"`);
    return basicTranslation;
  }
}

/**
 * Simple Finnish to English translation for industry categories (fallback)
 * @param {string} finnishText - Finnish text to translate
 * @returns {string} English translation (basic)
 */
function translateFinnishToEnglishBasic(finnishText) {
  // Comprehensive translation map for industry terms
  const translations = {
    // High-level categories
    'Maatalous, metsätalous ja kalatalous': 'Agriculture, forestry and fishing',
    'Kaivostoiminta ja louhinta': 'Mining and quarrying',
    'Teollisuus': 'Manufacturing',
    'Sähkö-, kaasu- ja lämpöhuolto, jäähdytysliiketoiminta': 'Electricity, gas, steam and air conditioning supply',
    'Vesihuolto, viemäri- ja jätevesihuolto, jätehuolto ja muu ympäristön puhtaanapito': 'Water supply; sewerage, waste management',
    'Rakentaminen': 'Construction',
    'Tukku- ja vähittäiskauppa': 'Wholesale and retail trade',
    'Kuljetus ja varastointi': 'Transportation and storage',
    'Majoitus- ja ravitsemustoiminta': 'Accommodation and food service activities',
    'Informaatio ja viestintä': 'Information and communication',
    'Rahoitus- ja vakuutustoiminta': 'Financial and insurance activities',
    'Kiinteistöalan toiminta': 'Real estate activities',
    'Ammatillinen, tieteellinen ja tekninen toiminta': 'Professional, scientific and technical activities',
    'Hallinto- ja tukipalvelutoiminta': 'Administrative and support service activities',
    'Julkinen hallinto ja maanpuolustus': 'Public administration and defence',
    'Koulutus': 'Education',
    'Terveys- ja sosiaalipalvelut': 'Human health and social work activities',
    'Taiteet, viihde ja virkistys': 'Arts, entertainment and recreation',
    'Muu palvelutoiminta': 'Other service activities',
    
    // Specific industry terms from logs
    'Asuntojen ja asuinkiinteistöjen hallinta': 'Residential property management',
    'Muualla luokittelematon muu liike-elämän tukipalvelutoiminta': 'Other business support services not elsewhere classified',
    'Hevosten ja muiden hevoseläinten kasvatus': 'Raising of horses and other equines',
    'Sähköasennus': 'Electrical installation',
    'Muuraustyöt': 'Masonry work',
    'Hammaslääkäripalvelut': 'Dental practice activities',
    'Muu lääkintä- ja hammaslääkintäinstrumenttien ja -tarvikkeiden valmistus': 'Other manufacture of medical and dental instruments and supplies',
    'Tieliikenteen muu kuin säännöllinen henkilökuljetus': 'Other passenger land transport',
    'Rakennuspaikan valmistelutyöt': 'Site preparation',
    'Muu kiinteistöalan toiminta palkkio- tai sopimusperhsteella': 'Other real estate activities on a fee or contract basis',
    'Muualla luokittelematon muu rahoituspalvelutoiminta': 'Other financial service activities not elsewhere classified',
    'Kiinteistöjä koskevat välityspalvelut': 'Real estate agency services',
    'Marjojen, pähkinöiden ja muiden puissa ja pensaissa kasvavien hedelmien viljely': 'Growing of berries, nuts and other tree and bush fruits',
    'Sähkönjakelu- ja valvontalaitteiden valmistus': 'Manufacture of electricity distribution and control apparatus',
    'Muu rahoitusta palveleva toiminta pois lukien vakuutus- ja eläkevakuutustoiminta': 'Other activities auxiliary to financial services, excluding insurance and pension funding',
    
    // Emergency services
    'Palo- ja pelastustoimi': 'Fire and rescue services',
    
    // Common truncated patterns (handle incomplete text gracefully)
    'Muualla luokittelematon muu liike-elämän tukipalve': 'Other business support services',
    'Tieliikenteen muu kuin säännöllinen henkilökuljetu': 'Other passenger land transport',
    'Muu kiinteistöalan toiminta palkkio- tai sopimuspe': 'Other real estate activities on fee or contract basis',
    'Muualla luokittelematon muu rahoituspalvelutoimint': 'Other financial service activities',
    'Marjojen, pähkinöiden ja muiden puissa ja pensaiss': 'Growing of berries, nuts and tree fruits',
    'Muu lääkintä- ja hammaslääkintäinstrumenttien ja -': 'Other manufacture of medical and dental instruments',
    'Muu rahoitusta palveleva toiminta pois lukien vaku': 'Other activities auxiliary to financial services'
  };
  
  return translations[finnishText] || finnishText;
}

/**
 * Fetch companies from PRH API (JSON endpoint)
 * @param {number} maxResults - Maximum number of companies to fetch
 * @returns {Promise<Array>} Array of company objects
 */
async function fetchCompaniesFromAPI(maxResults = 100) {
  console.log(`📡 Fetching companies from PRH API with pagination...`);
  console.log(`🔗 Base URL: ${PRH_API_URL}`);
  
  try {
    // First, fetch industry classifications
    const classifications = await fetchIndustryClassifications();
    
    let allFetchedCompanies = [];
    let page = 1;
    const resultsPerPage = 100;
    
    // Fetch companies registered from 2020 onwards using pagination
    while (allFetchedCompanies.length < maxResults) {
      console.log(`  📄 Fetching page ${page}...`);
      
      const response = await axios.get(PRH_API_URL, {
        params: {
          page: page,
          registrationDateStart: '2020-01-01'
        },
        headers: {
          'Accept': 'application/json'
        },
        timeout: 60000
      });

      const pageData = Array.isArray(response.data) ? response.data : (response.data.results || response.data.companies || []);
      
      if (pageData.length === 0) {
        console.log(`  ℹ️  No more results on page ${page}`);
        break;
      }
      
      console.log(`  ✅ Page ${page}: Received ${pageData.length} companies`);
      
      // Filter companies that are registered after 2020 AND have industry classification
      const validCompanies = pageData.filter(company => {
        const regDate = company.businessId?.registrationDate || company.registrationDate;
        const hasIndustryCode = company.mainBusinessLine?.type;
        const year = regDate ? new Date(regDate).getFullYear() : 0;
        
        return year >= 2020 && hasIndustryCode;
      });
      
      console.log(`  ✅ Page ${page}: ${validCompanies.length} companies match criteria (registered >= 2020 with industry code)`);
      
      allFetchedCompanies.push(...validCompanies);
      
      // Check if we have enough
      if (allFetchedCompanies.length >= maxResults) {
        console.log(`  🎯 Reached target of ${maxResults} companies`);
        break;
      }
      
      // Check if we got less than expected (last page)
      if (pageData.length < resultsPerPage) {
        console.log(`  ℹ️  Reached last page (got ${pageData.length} < ${resultsPerPage})`);
        break;
      }
      
      page++;
      
      // Safety limit to prevent infinite loops
      if (page > 50) {
        console.log(`  ⚠️  Reached page limit (50 pages)`);
        break;
      }
      
      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`✅ Total fetched: ${allFetchedCompanies.length} companies with industry classification`);
    
    if (allFetchedCompanies.length === 0) {
      console.log(`⚠️  No companies found matching criteria`);
      return [];
    }
    
    // Take only what we need
    const companies = allFetchedCompanies.slice(0, maxResults);
    console.log(`📊 Processing ${companies.length} companies...`);
    
    // Process companies and translate Finnish text to English if needed
    const processedCompanies = [];
    
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      
      // Extract business ID from nested structure
      const businessId = company.businessId?.value || company.businessId || '';
      
      // Extract the latest/current name (first one without endDate or most recent)
      let companyName = 'Unknown';
      if (company.names && company.names.length > 0) {
        // Find active name (type 1 = official name, without endDate)
        const activeName = company.names.find(n => n.type === '1' && !n.endDate);
        companyName = activeName?.name || company.names[0]?.name || 'Unknown';
      }
      
      // Extract business description (language code 3 = English)
      let description = '';
      if (company.mainBusinessLine?.descriptions) {
        const englishDesc = company.mainBusinessLine.descriptions.find(d => d.languageCode === '3');
        description = englishDesc?.description || company.mainBusinessLine.descriptions[0]?.description || '';
      }
      
      // Extract address (type 1 = visiting address)
      let address = '';
      if (company.addresses && company.addresses.length > 0) {
        const visitingAddress = company.addresses.find(a => a.type === 1) || company.addresses[0];
        if (visitingAddress) {
          const street = visitingAddress.street || '';
          const buildingNumber = visitingAddress.buildingNumber || '';
          const entrance = visitingAddress.entrance ? ` ${visitingAddress.entrance}` : '';
          const apartmentNumber = visitingAddress.apartmentNumber ? ` ${visitingAddress.apartmentNumber}` : '';
          const postCode = visitingAddress.postCode || '';
          const city = visitingAddress.postOffices?.find(p => p.languageCode === '3')?.city || 
                      visitingAddress.postOffices?.find(p => p.languageCode === '1')?.city ||
                      visitingAddress.postOffices?.[0]?.city || '';
          
          // Build address string with proper spacing
          const addressParts = [
            street,
            buildingNumber,
            entrance,
            apartmentNumber
          ].filter(part => part).join('');
          
          address = `${addressParts}, ${postCode} ${city}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, '');
        }
      }
      
      // Registration date
      const registrationDate = company.businessId?.registrationDate || 
                              company.registrationDate || null;
      
      // Extract industry classification and translate to English
      let categoryName = '';
      const industryCode = company.mainBusinessLine?.type;
      
      if (industryCode && classifications[industryCode]) {
        const classification = classifications[industryCode];
        
        // Translate Finnish category name to English if needed
        if (classification.name && classification.isFinnish) {
          categoryName = await translateToEnglish(classification.name);
        } else {
          categoryName = classification.name;
        }
      } else if (industryCode) {
        // Fallback: if no match in classifications, just use "Industry Code: XXXXX"
        categoryName = `Industry Code: ${industryCode}`;
      }
      
      processedCompanies.push({
        name: companyName,
        businessId: businessId,
        industryCode: industryCode || '',
        details: {
          name: companyName,
          description: description,
          address: address,
          registrationDate: registrationDate,
          categoryName: categoryName
        }
      });
    }
    
    console.log(`✅ Processed all ${processedCompanies.length} companies`);
    return processedCompanies;
  } catch (error) {
    console.error('❌ Error fetching companies from API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Create text representation of company for vectorization
 * @param {Object} company - Company object
 * @returns {string} Text representation
 */
function createCompanyText(company) {
  const name = company.details?.name || company.name;
  const description = company.details?.description || '';
  const address = company.details?.address || '';
  const registrationDate = company.details?.registrationDate || '';
  const categoryName = company.details?.categoryName || '';
  
  return `Company: ${name}. Business ID: ${company.businessId}. Industry: ${categoryName}. Description: ${description}. Address: ${address}. Registration Date: ${registrationDate || 'N/A'}.`;
}

/**
 * Convert text to vectors using Voyage AI (with rate limit handling)
 * @param {Array<string>} texts - Array of text strings to vectorize
 * @returns {Promise<Array<Array<number>>>} Array of vectors
 */
async function vectorizeWithVoyage(texts) {
  console.log(`🧮 Vectorizing ${texts.length} company descriptions with Voyage AI...`);
  
  // Batch size: 100 companies per request (safe for rate limits)
  const batchSize = 100;
  const allVectors = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(texts.length / batchSize);
    
    console.log(`  📦 Batch ${batchNum}/${totalBatches}: Vectorizing ${batch.length} companies...`);
    
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
 * Store companies with vectors in Supabase
 * @param {Array} companies - Array of company objects
 * @param {Array} vectors - Array of corresponding vectors
 */
async function storeInSupabase(companies, vectors) {
  console.log(`💾 Storing ${companies.length} companies in Supabase...`);
  
  try {
    // Step 1: Insert companies into 'company' table
    const companyData = companies.map(company => ({
      business_id: company.businessId,
      name: company.name,
      details: company.details || {}
    }));

    console.log(`  📦 Inserting companies into 'company' table...`);
    
    const { data: insertedCompanies, error: companyError } = await supabase
      .from('company')
      .upsert(companyData, { 
        onConflict: 'business_id',
        ignoreDuplicates: false 
      })
      .select('id, business_id');

    if (companyError) {
      console.error(`❌ Error inserting companies:`, companyError);
      throw companyError;
    }

    console.log(`  ✅ Inserted ${insertedCompanies?.length || companies.length} companies`);

    // Step 2: Get company IDs (either from insert or fetch)
    const { data: companyRecords, error: fetchError } = await supabase
      .from('company')
      .select('id, business_id')
      .in('business_id', companies.map(c => c.businessId));

    if (fetchError) {
      console.error(`❌ Error fetching company IDs:`, fetchError);
      throw fetchError;
    }

    // Create a map of business_id to company id
    const businessIdToCompanyId = {};
    companyRecords.forEach(record => {
      businessIdToCompanyId[record.business_id] = record.id;
    });

    // Step 3: Insert embeddings into 'company_embeddings' table
    console.log(`  📦 Inserting embeddings into 'company_embeddings' table...`);
    
    const embeddingData = companies.map((company, index) => ({
      company_id: businessIdToCompanyId[company.businessId],
      embeddings: vectors[index]
    })).filter(item => item.company_id); // Only insert if we have a valid company_id

    // Insert embeddings in batches
    for (let i = 0; i < embeddingData.length; i += BATCH_SIZE) {
      const batch = embeddingData.slice(i, i + BATCH_SIZE);
      console.log(`  📦 Inserting embedding batch ${Math.floor(i / BATCH_SIZE) + 1}...`);
      
      const { error: embeddingError } = await supabase
        .from('company_embeddings')
        .upsert(batch, { 
          onConflict: 'company_id',
          ignoreDuplicates: false 
        });

      if (embeddingError) {
        console.error(`❌ Error inserting embeddings:`, embeddingError);
        throw embeddingError;
      }
    }

    console.log(`✅ Successfully stored all companies and embeddings in Supabase`);
  } catch (error) {
    console.error('❌ Error storing in Supabase:', error.message);
    throw error;
  }
}

/**
 * Main function to orchestrate the entire process
 */
async function main() {
  console.log('🚀 Starting company data pipeline (Direct API Version)...\n');

  try {
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !VOYAGE_API_KEY) {
      throw new Error('⚠️  Missing required environment variables. Please check your .env file.');
    }

    // Step 1: Fetch companies from API
    const companies = await fetchCompaniesFromAPI(500);
    
    if (companies.length === 0) {
      console.log('⚠️  No companies loaded. Exiting...');
      return;
    }

    // Step 2: Create text representations
    console.log('\n📝 Creating text representations...');
    const companyTexts = companies.map(createCompanyText);

    // // Step 3: Vectorize with Voyage AI
    console.log('\n🔄 Vectorizing companies...');
    const vectors = await vectorizeWithVoyage(companyTexts);

    // // Step 4: Store in Supabase
    console.log('\n💫 Storing in Supabase...');
    await storeInSupabase(companies, vectors);

    console.log('\n✨ Pipeline completed successfully! ✨\n');
    console.log(`📊 Summary:`);
    console.log(`   - Companies processed: ${companies.length}`);
    console.log(`   - Vectors generated: ${vectors.length}`);
    console.log(`   - Dimension: ${vectors[0]?.length || 'N/A'}`);
    
  } catch (error) {
    console.error('\n💥 Pipeline failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
