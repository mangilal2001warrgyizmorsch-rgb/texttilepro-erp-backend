import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import multer from "multer";
import Account from "../models/Account.js";
import Quality from "../models/Quality.js";
import Weaver from "../models/Weaver.js";

const router = Router();
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } }); // 15MB limit

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to ensure masters exist in the database
async function ensureMasters(data, cache = {}) {
  const { partyName, weaverName, qualityName } = data;
  
  const masters = {
    millId: null,
    weaverId: null,
    qualityId: null
  };

  try {
    if (partyName) {
      const cleanName = partyName.trim();
      if (cache[cleanName]) {
        masters.millId = cache[cleanName];
      } else {
        let account = await Account.findOne({ 
          accountName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') },
          roleType: "Mill"
        });
        if (!account) {
          account = await Account.create({
            accountName: cleanName,
            roleType: "Mill",
            gstType: "Regular",
            isActive: true
          });
          console.log(`✅ Created new Mill: ${cleanName}`);
        }
        masters.millId = account._id;
        cache[cleanName] = account._id;
      }
    }

    if (weaverName && weaverName.trim()) {
      const cleanName = weaverName.trim();
      if (cache[cleanName]) {
        masters.weaverId = cache[cleanName];
      } else {
        let weaver = await Weaver.findOne({ 
          weaverName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } 
        });
        if (!weaver) {
          weaver = await Weaver.create({
            weaverName: cleanName,
            weaverCode: cleanName.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000)
          });
          console.log(`✅ Created new Weaver: ${cleanName}`);
        }
        masters.weaverId = weaver._id;
        cache[cleanName] = weaver._id;
      }
    }

    if (qualityName) {
      const cleanName = qualityName.trim();
      if (cache[cleanName]) {
        masters.qualityId = cache[cleanName];
      } else {
        let quality = await Quality.findOne({ 
          qualityName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } 
        });
        if (!quality) {
          quality = await Quality.create({
            qualityName: cleanName,
            processType: "Dyeing"
          });
          console.log(`✅ Created new Quality: ${cleanName}`);
        }
        masters.qualityId = quality._id;
        cache[cleanName] = quality._id;
      }
    }
  } catch (err) {
    console.error("❌ Error ensuring masters:", err);
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
      const masters = await ensureMasters({
        partyName: c.firm || c.party, 
        qualityName: c.quality,
        weaverName: c.weaver
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
