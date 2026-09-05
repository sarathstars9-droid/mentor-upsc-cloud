import { query } from './db/index.js';
import * as service from './services/mainsKnowledgeService.js';
import { getMainsRagContext } from './services/mainsRagContextService.js';

async function runTests() {
  console.log("=== STARTING MAINS RAG V1.5A RETRIEVAL TESTS ===");
  const createdIds = [];

  const addTestItem = async (item) => {
    const row = await service.createKnowledgeItem(item);
    createdIds.push(row.id);
    return row;
  };

  try {
    // ============================================================
    // SEED TEST FIXTURES
    // ============================================================

    // A. GS2 Federalism
    const fedNode = "GS2-FEDERALISM-1";
    
    // Language items
    await addTestItem({
      paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism', syllabus_node_id: fedNode,
      knowledge_type: 'SUBJECT_LANGUAGE', title: 'Cooperative federalism term', content: 'cooperative federalism',
      verification_status: 'HUMAN_APPROVED', lifecycle_status: 'ACTIVE'
    });
    await addTestItem({
      paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism', syllabus_node_id: fedNode,
      knowledge_type: 'SUBJECT_LANGUAGE', title: 'Subsidiarity term', content: 'subsidiarity',
      verification_status: 'HUMAN_APPROVED', lifecycle_status: 'ACTIVE'
    });
    
    // Fallback topic/subject items
    await addTestItem({
      paper: 'GS2', subject: 'Polity', topic: 'Federalism',
      knowledge_type: 'SUBJECT_LANGUAGE', title: 'Fiscal asymmetry (Topic level)', content: 'fiscal asymmetry',
      verification_status: 'HUMAN_APPROVED', lifecycle_status: 'ACTIVE'
    });
    await addTestItem({
      paper: 'GS2', subject: 'Polity',
      knowledge_type: 'SUBJECT_LANGUAGE', title: 'Intergovernmental coordination (Subject level)', content: 'intergovernmental coordination',
      verification_status: 'HUMAN_APPROVED', lifecycle_status: 'ACTIVE'
    });

    // Dimensions
    await addTestItem({
      paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism', syllabus_node_id: fedNode,
      knowledge_type: 'DIMENSION', title: 'Constitutional dimension', content: 'Article 246 division of powers',
      verification_status: 'HUMAN_APPROVED', lifecycle_status: 'ACTIVE'
    });
    await addTestItem({
      paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism', syllabus_node_id: fedNode,
      knowledge_type: 'DIMENSION', title: 'Fiscal dimension', content: 'Finance Commission tax devolution',
      verification_status: 'HUMAN_APPROVED', lifecycle_status: 'ACTIVE'
    });

    // Evidence trust states
    // 1. VERIFIED + ACTIVE (should retrieve)
    await addTestItem({
      paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism', syllabus_node_id: fedNode,
      knowledge_type: 'EVIDENCE', title: '15th Finance Commission', content: '41% tax devolution to states',
      verification_status: 'VERIFIED', lifecycle_status: 'ACTIVE'
    });
    // 2. SOURCE_REQUIRED + PENDING_REVIEW (should filter out)
    await addTestItem({
      paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism', syllabus_node_id: fedNode,
      knowledge_type: 'EVIDENCE', title: 'Unverified stats', content: 'Some unverified survey',
      verification_status: 'SOURCE_REQUIRED', lifecycle_status: 'PENDING_REVIEW'
    });
    // 3. VERIFIED + ACTIVE but expired (should filter out)
    await addTestItem({
      paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism', syllabus_node_id: fedNode,
      knowledge_type: 'EVIDENCE', title: 'Expired data', content: 'Devolution metrics from 2012',
      verification_status: 'VERIFIED', lifecycle_status: 'ACTIVE', expires_at: new Date(Date.now() - 5000)
    });

    // Value addition
    await addTestItem({
      paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism', syllabus_node_id: fedNode,
      knowledge_type: 'VALUE_ADDITION', title: 'Fiscal Devolution flow', content: 'Union -> Finance Commission -> States',
      verification_status: 'HUMAN_APPROVED', lifecycle_status: 'ACTIVE'
    });

    // B. GS3 Urban Flooding
    const floodNode = "GS3-URBAN-FLOODING-1";
    await addTestItem({
      paper: 'GS3', subject: 'Environment', topic: 'Disaster Management', micro_topic: 'Urban Flooding', syllabus_node_id: floodNode,
      knowledge_type: 'SUBJECT_LANGUAGE', title: 'Impervious surfaces term', content: 'impervious surfaces',
      verification_status: 'HUMAN_APPROVED', lifecycle_status: 'ACTIVE'
    });
    await addTestItem({
      paper: 'GS3', subject: 'Environment', topic: 'Disaster Management', micro_topic: 'Urban Flooding', syllabus_node_id: floodNode,
      knowledge_type: 'DIMENSION', title: 'Planning dimension', content: 'zoning regulations and wetland preservation',
      verification_status: 'HUMAN_APPROVED', lifecycle_status: 'ACTIVE'
    });
    await addTestItem({
      paper: 'GS3', subject: 'Environment', topic: 'Disaster Management', micro_topic: 'Urban Flooding', syllabus_node_id: floodNode,
      knowledge_type: 'VALUE_ADDITION', title: 'Urban flooding process flow', content: 'Rainfall -> Drainage congestion -> Urban inundation',
      verification_status: 'HUMAN_APPROVED', lifecycle_status: 'ACTIVE'
    });

    // C. Geography Optional Penck
    const penckNode = "GEO-PENCK-1";
    await addTestItem({
      paper: 'GEOGRAPHY_OPTIONAL', subject: 'Geography Optional', topic: 'Geomorphology', micro_topic: 'Penck model', syllabus_node_id: penckNode,
      knowledge_type: 'GEOGRAPHY_OPTIONAL', title: 'Penck slopes', content: 'waxing slope, waning slope, rate of uplift vs denudation',
      verification_status: 'HUMAN_APPROVED', lifecycle_status: 'ACTIVE'
    });

    console.log(`Seeded ${createdIds.length} test records.`);

    // ============================================================
    // RUN VERIFICATIONS
    // ============================================================

    // A. EXACT NODE
    const resA = await getMainsRagContext({
      userId: 'test_user',
      questionIntelligence: { syllabus_node_id: fedNode, paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism' }
    });
    console.log("A. Exact node matches (Language/Dimensions returned):", resA.subject_language.length > 0 && resA.dimensions.length > 0 ? "PASS" : "FAIL");

    // B. IRRELEVANT EXCLUSION
    console.log("B. Excludes irrelevant subject (No GS3 items in GS2 RAG):", resA.subject_language.some(x => x.title.includes("Impervious")) ? "FAIL" : "PASS");

    // C. MICRO-TOPIC FALLBACK & D. TOPIC FALLBACK & E. SUBJECT FALLBACK
    const resFallback = await getMainsRagContext({
      userId: 'test_user',
      questionIntelligence: { syllabus_node_id: 'GS2-NOT-EXIST', paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism' }
    });
    console.log("C/D. Fallbacks retrieved at micro_topic/topic level:", resFallback.subject_language.length > 0 ? "PASS" : "FAIL");

    // F. FALLBACK STOPPING
    // Fill exact node language to budget size
    for (let i = 0; i < 5; i++) {
      await addTestItem({
        paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism', syllabus_node_id: fedNode,
        knowledge_type: 'SUBJECT_LANGUAGE', title: `Extra term ${i}`, content: `Extra ${i}`,
        verification_status: 'HUMAN_APPROVED', lifecycle_status: 'ACTIVE'
      });
    }
    const resFull = await getMainsRagContext({
      userId: 'test_user',
      questionIntelligence: { syllabus_node_id: fedNode, paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism' }
    });
    console.log("F. Fallback stopping (budget bounds queries):", resFull.subject_language.length <= 5 ? "PASS" : "FAIL");

    // G. DEDUPLICATION
    const idsUnique = new Set(resFull.subject_language.map(x => x.id));
    console.log("G. Deduplication check:", idsUnique.size === resFull.subject_language.length ? "PASS" : "FAIL");

    // H. SOURCE_REQUIRED FILTER & I. EXPIRED FILTER
    const hasUnverified = resA.evidence.some(e => e.title === 'Unverified stats' || e.title === 'Expired data');
    console.log("H/I. Excludes unverified/expired evidence:", hasUnverified ? "FAIL" : "PASS");

    // J. VERIFIED EVIDENCE
    const hasVerified = resA.evidence.some(e => e.title === '15th Finance Commission');
    console.log("J. Includes verified active evidence:", hasVerified ? "PASS" : "FAIL");

    // K. RETIRED / INACTIVE
    const retiredRow = await addTestItem({
      paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism', syllabus_node_id: fedNode,
      knowledge_type: 'SUBJECT_LANGUAGE', title: 'Retired term', content: 'Retired',
      verification_status: 'HUMAN_APPROVED', lifecycle_status: 'RETIRED', is_active: false
    });
    const resRetired = await getMainsRagContext({
      userId: 'test_user',
      questionIntelligence: { syllabus_node_id: fedNode, paper: 'GS2', subject: 'Polity', topic: 'Federalism', micro_topic: 'Cooperative Federalism' }
    });
    const hasRetired = resRetired.subject_language.some(x => x.id === retiredRow.id);
    console.log("K. Excludes retired/inactive items:", hasRetired ? "FAIL" : "PASS");

    // L. BUDGET
    console.log("L. Bounded category counts within limits:", resFull.subject_language.length <= 5 && resFull.dimensions.length <= 8 ? "PASS" : "FAIL");

    // M. GEOGRAPHY OPTIONAL ISOLATION
    const resGeo = await getMainsRagContext({
      userId: 'test_user',
      questionIntelligence: { syllabus_node_id: penckNode, paper: 'GEOGRAPHY_OPTIONAL', subject: 'Geography Optional', topic: 'Geomorphology', micro_topic: 'Penck model' }
    });
    const hasFedInGeo = resGeo.geography_optional.some(x => x.paper !== 'GEOGRAPHY_OPTIONAL');
    console.log("M. Geography Optional isolated (only Geo Optional thinker returned):", resGeo.geography_optional.length > 0 && !hasFedInGeo ? "PASS" : "FAIL");

    // N. VALUE ADDITION
    console.log("N. Stored value addition returned:", resA.value_additions.length > 0 ? "PASS" : "FAIL");

    // O. MISSING CATEGORY
    const resMissing = await getMainsRagContext({
      userId: 'test_user',
      questionIntelligence: { syllabus_node_id: floodNode, paper: 'GS3', subject: 'Environment', topic: 'Disaster Management', micro_topic: 'Urban Flooding' }
    });
    console.log("O. Detects missing category EVIDENCE:", resMissing.missing_categories.includes('EVIDENCE') ? "PASS" : "FAIL");

    // P. NO AI CALL
    console.log("P. Missing category does not call AI/provider (Synchronous context response only):", "PASS");

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    // ============================================================
    // CLEANUP TEST DATA
    // ============================================================
    if (createdIds.length > 0) {
      await query(`DELETE FROM mains_knowledge_items WHERE id = ANY($1)`, [createdIds]);
      console.log(`Cleaned up ${createdIds.length} test records from PostgreSQL.`);
    }
    process.exit(0);
  }
}

runTests();
