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

  try {
    // 1. Internal Firm (Mill)
    if (firmName) {
      const cleanName = firmName.trim();
      let account = await Account.findOne({ 
        accountName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') },
        roleType: "Mill"
      });
      if (!account) {
        account = await Account.create({
          accountName: cleanName,
          roleType: "Mill",
          isActive: true
        });
      }
      masters.firmId = account._id;
    }

    // 2. Party (Customer) - DO NOT AUTO CREATE
    if (partyName) {
      const cleanName = partyName.trim();
      let account = await Account.findOne({ 
        accountName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') },
        roleType: { $in: ["Master", "Customer", "Supplier"] }
      });
      if (account) {
        masters.partyId = account._id;
        masters.partyName = account.accountName;
      } else {
        masters.partyNotFound = true;
        masters.partyName = cleanName; // Keep the name for display
      }
    }

    // 3. Weaver
    if (weaverName) {
      const cleanName = weaverName.trim();
      let weaver = await Weaver.findOne({ 
        weaverName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } 
      });
      if (!weaver) {
        weaver = await Weaver.create({
          weaverName: cleanName,
          weaverCode: cleanName.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000)
        });
      }
      masters.weaverId = weaver._id;
    }

    // 4. Quality
    if (qualityName) {
      const cleanName = qualityName.trim();
      let quality = await Quality.findOne({ 
        qualityName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } 
      });
      if (!quality) {
        quality = await Quality.create({
          qualityName: cleanName,
          processType: "Dyeing",
          hsnCode: hsnCode || undefined
        });
      }
      masters.qualityId = quality._id;
    }

    // 5. Transporter
    if (transporterName) {
      const cleanName = transporterName.trim();
      let transporter = await Account.findOne({ 
        accountName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') },
        roleType: "Transporter"
      });
      if (!transporter) {
        transporter = await Account.create({
          accountName: cleanName,
          roleType: "Transporter",
          isActive: true
        });
      }
      masters.transporterId = transporter._id;
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
        firmName: c.delivery_at, // Internal Mill (Destination)
        partyName: c.party, // Customer (Buyer)
        weaverName: c.firm || c.weaver, // Sender (Weaver)
        qualityName: c.quality,
        transporterName: c.transpoter,
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
