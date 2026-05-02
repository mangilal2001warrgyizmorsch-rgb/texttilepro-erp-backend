import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import multer from "multer";
import Account from "../models/Account.js";
import Quality from "../models/Quality.js";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = "uploads/documents";
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const router = Router();
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 15 * 1024 * 1024 } }); // 15MB limit

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to build a master detail snapshot from an Account document
function buildMasterSnapshot(account) {
  if (!account) return null;
  return {
    name: account.accountName || "",
    gstin: account.gstin || "",
    panNo: account.panNo || "",
    address: account.address || "",
    city: account.city || "",
    state: account.state || "",
    pincode: account.pincode || "",
    mobileNo: account.mobileNo || "",
    email: account.email || "",
    gstType: account.gstType || "",
    clientCode: account.clientCode || "",
  };
}

// Helper to normalize names for safer comparison
const normalize = (name) =>
  name.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

// Helper to clean GST numbers (remove OCR noise, trim, uppercase)
const cleanGST = (gst) => (gst || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

// ────────────────────────────────────────────────────────────────────────────
// ensureMasters — Resolves master data from the database using GSTIN-first
// matching. Returns full master snapshots for embedding in Orders.
// ────────────────────────────────────────────────────────────────────────────
async function ensureMasters(data, cache = {}) {
  const {
    firmName,
    partyName,
    weaverName,
    partyGstin,
    weaverGstin,
    qualityName,
    transporterName,
    hsnCode
  } = data;

  const masters = {
    firmId: null,
    firmName: null,
    firmDetails: null,
    partyId: null,
    partyName: null,
    partyDetails: null,
    weaverId: null,
    weaverName: null,
    weaverDetails: null,
    qualityId: null,
    qualityName: null,
    qualityDetails: null,
    transporterId: null,
    transporterName: null,
    partyNotFound: false,
    weaverNotFound: false,
    partyMatchedBy: null, // 'gstin' or 'name'
    weaverMatchedBy: null,
  };

  try {
    // ── 1. FIRM (Mill) ──────────────────────────────────────────────────────
    if (firmName) {
      const cleanName = firmName.trim();
      const normName = normalize(cleanName);
      console.log(`🔍 Checking for Mill: ${cleanName}`);

      let account = await Account.findOne({
        $or: [
          { accountName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } },
          { accountName: { $regex: new RegExp(`^${escapeRegExp(normName).split(" ").join("[\\s\\.]*")}[\\s\\.]*$`, 'i') } }
        ],
        roleType: "Mill"
      });

      if (account) {
        masters.firmId = account._id;
        masters.firmName = account.accountName;
        masters.firmDetails = buildMasterSnapshot(account);
        console.log(`✅ Mill matched: ${account.accountName}`);
      } else {
        console.log(`⚠️ Mill not found: ${cleanName}. Skipping auto-creation.`);
      }
    }

    // ── 2. PARTY (Customer) — GSTIN first, then name fallback ───────────────
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
        masters.partyDetails = buildMasterSnapshot(account);
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
        masters.partyDetails = buildMasterSnapshot(account);
        masters.partyMatchedBy = "name";
        console.log(`✅ Party matched by name: ${account.accountName}`);
      } else {
        console.log(`⚠️ Party not found by name: ${cleanName}.`);
        masters.partyNotFound = true;
      }
    }

    // ── 3. WEAVER — GSTIN first, then name fallback ─────────────────────────
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
        masters.weaverDetails = buildMasterSnapshot(weaverAccount);
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
        masters.weaverDetails = buildMasterSnapshot(weaverAccount);
        masters.weaverMatchedBy = "name";
        console.log(`✅ Weaver matched by name: ${weaverAccount.accountName}`);
      } else {
        console.log(`⚠️ Weaver not found by name: ${cleanName}.`);
        masters.weaverNotFound = true;
      }
    }

    // ── 4. QUALITY — Name-based match, return full snapshot ────────────────
    masters.hsnCode = hsnCode || null;
    if (qualityName) {
      const cleanName = qualityName.trim();
      console.log(`🔍 Checking for Quality: ${cleanName}`);
      let quality = await Quality.findOne({
        qualityName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') }
      });
      if (quality) {
        masters.qualityId = quality._id;
        masters.qualityName = quality.qualityName;
        masters.hsnCode = quality.hsnCode || masters.hsnCode; // Master HSN takes priority
        masters.qualityDetails = {
          qualityName: quality.qualityName,
          gsm: quality.gsm || null,
          width: quality.width || null,
          unit: quality.unit || "",
          hsnCode: quality.hsnCode || "",
          processType: quality.processType || "",
          expectedLossPercent: quality.expectedLossPercent || null,
          shortPercent: quality.shortPercent || null,
          defaultJobRate: quality.defaultJobRate || null,
          greyRate: quality.greyRate || null,
          dispatchRate: quality.dispatchRate || null,
        };
        console.log(`✅ Quality matched: ${quality.qualityName} (GSM: ${quality.gsm}, Width: ${quality.width})`);
      } else {
        console.log(`⚠️ Quality not found: ${cleanName}. Using OCR data as fallback.`);
        masters.qualityName = cleanName;
      }
    }

    // ── 5. TRANSPORTER ──────────────────────────────────────────────────────
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

    console.log("✅ ensureMasters completed:", JSON.stringify({
      firmId: masters.firmId,
      partyId: masters.partyId,
      weaverId: masters.weaverId,
      partyMatchedBy: masters.partyMatchedBy,
      weaverMatchedBy: masters.weaverMatchedBy,
    }));
  } catch (err) {
    console.error("❌ Error in ensureMasters:", err);
  }

  return masters;
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/ocr/extract
// ────────────────────────────────────────────────────────────────────────────
router.post("/extract", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const fileUrl = `/uploads/documents/${file.filename}`;
    const filePath = file.path;

    console.log(`🔍 Forwarding file ${file.originalname} to external OCR API...`);

    // Timeout for the entire OCR operation (including retries)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s total for retries

    // Helper: call external OCR with retry on failure (Render free tier cold start)
    const callExternalOcr = async (signal) => {
      const OCR_URL = "https://challan-extractor2.onrender.com/extract";
      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const formData = new FormData();
          const fileData = fs.readFileSync(filePath);
          const blob = new Blob([fileData], { type: "application/pdf" });
          formData.append("file", blob, file.originalname);

          const response = await fetch(OCR_URL, {
            method: "POST",
            body: formData,
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
      const extractedParty = c.party || c.customer || c.party_name || c.party_obj?.name || "";
      const extractedWeaver = c.weaver || c.weaver_name || c.weaver_obj?.name || "";

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
      fileUrl,
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
