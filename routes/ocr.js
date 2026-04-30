import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import multer from "multer";
import Account from "../models/Account.js";
import Quality from "../models/Quality.js";

const router = Router();
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } }); // 15MB limit

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to ensure masters exist in the database
async function ensureMasters(data, cache = {}) {
  const { 
    firmName, // The internal firm (Delivery At)
    partyName, // The customer (M/s Party)
    weaverName, // The sender (Header)
    partyGstin, // GST from party_obj
    weaverGstin, // GST from weaver_obj
    qualityName,
    transporterName,
    hsnCode 
  } = data;
  
  const masters = {
    firmId: null,
    partyId: null,
    weaverId: null,
    qualityId: null,
    transporterId: null,
    partyNotFound: false,
    weaverNotFound: false,
    partyMatchedBy: null, // 'gstin' or 'name'
    weaverMatchedBy: null,
  };

  // Helper to normalize names for safer comparison
  const normalize = (name) => 
    name.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

  // Helper to clean GST numbers (remove OCR noise, trim, uppercase)
  const cleanGST = (gst) => (gst || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  try {
    // 1. Internal Firm (Mill)
    if (firmName) {
      const cleanName = firmName.trim();
      const normName = normalize(cleanName);
      console.log(`🔍 Checking for Mill: ${cleanName} (norm: ${normName})`);
      
      let account = await Account.findOne({ 
        $or: [
          { accountName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } },
          { accountName: { $regex: new RegExp(`^${escapeRegExp(normName).split(" ").join("[\\s\\.]*")}[\\s\\.]*$`, 'i') } }
        ],
        roleType: "Mill"
      });

      if (account) {
        masters.firmId = account._id;
      } else {
        console.log(`⚠️ Mill not found: ${cleanName}. Skipping auto-creation.`);
      }
    }

    // 2. Party (Customer) — GSTIN first, then name fallback
    const partyGstClean = cleanGST(partyGstin);
    if (partyGstClean && partyGstClean.length >= 15) {
      console.log(`🔍 Matching Party by GSTIN: ${partyGstClean}`);
      const account = await Account.findOne({
        gstin: { $regex: new RegExp(`^${escapeRegExp(partyGstClean)}$`, 'i') },
        roleType: { $in: ["Master", "Customer", "Supplier"] }
      });
      if (account) {
        masters.partyId = account._id;
        masters.partyName = account.accountName;
        masters.partyMatchedBy = "gstin";
        console.log(`✅ Party matched by GSTIN: ${account.accountName}`);
      } else {
        console.log(`⚠️ No Party found with GSTIN: ${partyGstClean}`);
        masters.partyNotFound = true;
      }
    }
    
    // Name-based fallback only if GSTIN match failed
    if (!masters.partyId && partyName) {
      const cleanName = partyName.trim();
      const normName = normalize(cleanName);
      console.log(`🔍 Falling back to Party name match: ${cleanName}`);

      let account = await Account.findOne({ 
        $or: [
          { accountName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } },
          { accountName: { $regex: new RegExp(`^${escapeRegExp(normName).split(" ").join("[\\s\\.]*")}[\\s\\.]*$`, 'i') } }
        ],
        roleType: { $in: ["Master", "Customer", "Supplier"] }
      });

      if (account) {
        masters.partyId = account._id;
        masters.partyName = account.accountName;
        masters.partyMatchedBy = "name";
      } else {
        console.log(`⚠️ Party not found by name: ${cleanName}.`);
        masters.partyNotFound = true;
      }
    }

    // 3. Weaver — GSTIN first, then name fallback
    const weaverGstClean = cleanGST(weaverGstin);
    if (weaverGstClean && weaverGstClean.length >= 15) {
      console.log(`🔍 Matching Weaver by GSTIN: ${weaverGstClean}`);
      const weaverAccount = await Account.findOne({
        gstin: { $regex: new RegExp(`^${escapeRegExp(weaverGstClean)}$`, 'i') },
        roleType: "Weaver"
      });
      if (weaverAccount) {
        masters.weaverId = weaverAccount._id;
        masters.weaverName = weaverAccount.accountName;
        masters.weaverMatchedBy = "gstin";
        console.log(`✅ Weaver matched by GSTIN: ${weaverAccount.accountName}`);
      } else {
        console.log(`⚠️ No Weaver found with GSTIN: ${weaverGstClean}`);
        masters.weaverNotFound = true;
      }
    }

    // Name-based fallback only if GSTIN match failed
    if (!masters.weaverId && weaverName) {
      const cleanName = weaverName.trim();
      const normName = normalize(cleanName);
      console.log(`🔍 Falling back to Weaver name match: ${cleanName}`);

      let weaverAccount = await Account.findOne({ 
        $or: [
          { accountName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } },
          { accountName: { $regex: new RegExp(`^${escapeRegExp(normName).split(" ").join("[\\s\\.]*")}[\\s\\.]*$`, 'i') } }
        ],
        roleType: "Weaver"
      });

      if (weaverAccount) {
        masters.weaverId = weaverAccount._id;
        masters.weaverName = weaverAccount.accountName;
        masters.weaverMatchedBy = "name";
      } else {
        console.log(`⚠️ Weaver not found by name: ${cleanName}.`);
        masters.weaverNotFound = true;
      }
    }

    // 4. Quality
    if (qualityName) {
      const cleanName = qualityName.trim();
      console.log(`🔍 Checking for Quality: ${cleanName}`);
      let quality = await Quality.findOne({ 
        qualityName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } 
      });
      if (quality) {
        masters.qualityId = quality._id;
        masters.qualityName = quality.qualityName;
      } else {
        console.log(`⚠️ Quality not found: ${cleanName}. Skipping auto-creation.`);
      }
    }

    // 5. Transporter
    if (transporterName) {
      const cleanName = transporterName.trim();
      console.log(`🔍 Checking for Transporter: ${cleanName}`);
      let transporter = await Account.findOne({
        accountName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, "i") },
        roleType: "Transporter",
      });
      if (transporter) {
        masters.transporterId = transporter._id;
        masters.transporterName = transporter.accountName;
      } else {
        console.log(`⚠️ Transporter not found: ${cleanName}. Skipping auto-creation.`);
      }
    }

    console.log("✅ ensureMasters completed:", masters);
  } catch (err) {
    console.error("❌ Error in ensureMasters:", err);
  }

  return masters;
}

// POST /api/ocr/extract
router.post("/extract", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    console.log(`🔍 Forwarding file ${file.originalname} to external OCR API...`);

    // Timeout for the entire OCR operation (including retries)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s total for retries

    // Helper: call external OCR with retry on failure (Render free tier cold start)
    const callExternalOcr = async (signal) => {
      const OCR_URL = "https://challan-extractor.onrender.com/extract";
      const MAX_RETRIES = 2;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`🔍 OCR attempt ${attempt}/${MAX_RETRIES}...`);
          
          // Must re-create FormData for retry (stream consumed after first attempt)
          const retryFormData = new FormData();
          const retryBlob = new Blob([file.buffer], { type: file.mimetype });
          retryFormData.append("file", retryBlob, file.originalname);

          const response = await fetch(OCR_URL, {
            method: "POST",
            body: retryFormData,
            signal,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'TextilePro-ERP-Backend'
            }
          });

          if (response.ok) {
            return response;
          }

          const errorText = await response.text();
          console.error(`❌ OCR attempt ${attempt} failed: ${response.status} - ${errorText}`);

          // If it's the last attempt, throw
          if (attempt === MAX_RETRIES) {
            throw new Error(`External OCR API failed after ${MAX_RETRIES} attempts (status: ${response.status}). The OCR service may be temporarily unavailable — please try again in a few seconds.`);
          }

          // Wait before retry (Render cold start takes ~3-5s)
          console.log(`⏳ Waiting 3s before retry...`);
          await new Promise(r => setTimeout(r, 3000));
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          if (attempt === MAX_RETRIES) throw err;
          console.log(`⏳ Attempt ${attempt} error: ${err.message}. Retrying in 3s...`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    };

    const externalResponse = await callExternalOcr(controller.signal);
    clearTimeout(timeoutId);

    const data = await externalResponse.json();
    
    // The API returns { challans: [...] }
    if (!data.challans || !Array.isArray(data.challans)) {
       return res.json(data); 
    }

    // Process each challan sequentially
    const processedChallans = [];
    const masterCache = {};
    for (const c of data.challans) {
      // Try multiple fields for firm/mill and party
      const extractedFirm = c.delivery_at || c.firm || c.mill || c.firm_name || "";
      const extractedParty = c.party || c.customer || c.party_name || "";
      const extractedWeaver = c.weaver || c.weaver_name || "";

      // Extract GSTIN from _obj fields (OCR extractor provides these)
      const partyGstin = c.party_obj?.gstin_no || c.gstin_no || "";
      const weaverGstin = c.weaver_obj?.gstin_no || "";

      // Prevent saving Firm or Party names as Weaver names
      let weaverName = extractedWeaver;
      if (weaverName && 
          (weaverName.toLowerCase() === extractedFirm.toLowerCase() || 
           weaverName.toLowerCase() === extractedParty.toLowerCase())) {
        console.log(`⚠️ Skipping Weaver name match: "${weaverName}" matches Firm or Party.`);
        weaverName = "";
      }

      const masters = await ensureMasters({
        firmName: extractedFirm,
        partyName: extractedParty,
        weaverName: weaverName,
        partyGstin: partyGstin,
        weaverGstin: weaverGstin,
        qualityName: c.quality,
        transporterName: c.transpoter || c.transporter,
        hsnCode: c.hsn_code
      }, masterCache);
      
      processedChallans.push({
        ...c,
        ...masters
      });
    }

    // Return the processed batch
    res.json({
      ...data,
      challans: processedChallans
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error("❌ OCR Proxy Error: External API timed out after 60s");
      return res.status(504).json({ error: "OCR extraction timed out. The external service might be slow." });
    }
    console.error("❌ OCR Proxy Error:", err.message);
    next(err);
  }
});

export default router;
