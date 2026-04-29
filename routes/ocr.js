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
    partyNotFound: false
  };

  // Helper to normalize names for safer comparison
  const normalize = (name) => 
    name.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

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

    // 2. Party (Customer)
    if (partyName) {
      const cleanName = partyName.trim();
      const normName = normalize(cleanName);
      console.log(`🔍 Checking for Party: ${cleanName} (norm: ${normName})`);

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
      } else {
        console.log(`⚠️ Party not found: ${cleanName}. Skipping auto-creation.`);
      }
    }

    // 3. Weaver
    if (weaverName) {
      const cleanName = weaverName.trim();
      const normName = normalize(cleanName);
      console.log(`🔍 Checking for Weaver: ${cleanName}`);

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
      } else {
        console.log(`⚠️ Weaver not found: ${cleanName}. Skipping auto-creation.`);
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

    // Prepare FormData for the external API
    const externalFormData = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype });
    externalFormData.append("file", blob, file.originalname);

    // Call the user's preferred API with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    let externalResponse;
    try {
      externalResponse = await fetch("https://challan-extractor.onrender.com/extract", {
        method: "POST",
        body: externalFormData,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TextilePro-ERP-Backend'
        }
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!externalResponse.ok) {
      const errorText = await externalResponse.text();
      console.error(`❌ External OCR API Error: ${externalResponse.status} - ${errorText}`);
      throw new Error(`External OCR API failed: ${externalResponse.status}`);
    }

    const data = await externalResponse.json();
    
    // The API returns { challans: [...] }
    if (!data.challans || !Array.isArray(data.challans)) {
       return res.json(data); 
    }

    // Process each challan sequentially to avoid duplicate master creation if multiple challans have same Mill/Quality
    const processedChallans = [];
    const masterCache = {}; // Local cache for this request to avoid redundant DB checks
    for (const c of data.challans) {
      // Try multiple fields for firm/mill and party
      const extractedFirm = c.delivery_at || c.firm || c.mill || c.firm_name || "";
      const extractedParty = c.party || c.customer || c.party_name || "";
      const extractedWeaver = c.weaver || c.weaver_name || "";

      // Prevent saving Firm or Party names as Weaver names
      let weaverName = extractedWeaver;
      if (weaverName && 
          (weaverName.toLowerCase() === extractedFirm.toLowerCase() || 
           weaverName.toLowerCase() === extractedParty.toLowerCase())) {
        console.log(`⚠️ Skipping Weaver creation: "${weaverName}" matches Firm or Party.`);
        weaverName = "";
      }

      const masters = await ensureMasters({
        firmName: extractedFirm,
        partyName: extractedParty,
        weaverName: weaverName,
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
