import mongoose from "mongoose";
import Account from "./models/Account.js";
import Quality from "./models/Quality.js";
import Weaver from "./models/Weaver.js";
import dotenv from "dotenv";

dotenv.config();

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureMasters(data, cache = {}) {
  const { partyName, partyAddress, gstin, weaverName, qualityName, transporterName, hsnCode } = data;
  
  const masters = {
    millId: null,
    weaverId: null,
    qualityId: null,
    transporterId: null
  };

  try {
    if (partyName) {
      const cleanName = partyName.trim();
      const cacheKey = `mill_${cleanName}`;
      if (cache[cacheKey]) {
        masters.millId = cache[cacheKey];
      } else {
        let account = await Account.findOne({ 
          accountName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') },
          roleType: "Mill"
        });
        
        let shouldSave = false;
        if (!account) {
          account = new Account({
            accountName: cleanName,
            roleType: "Mill",
            gstType: "Regular",
            isActive: true,
            address: partyAddress || undefined,
            gstin: gstin || undefined
          });
          shouldSave = true;
          console.log(`✅ Created new Mill: ${cleanName}`);
        } else {
          if (!account.address && partyAddress) {
            account.address = partyAddress;
            shouldSave = true;
          }
          if (!account.gstin && gstin) {
            account.gstin = gstin;
            shouldSave = true;
          }
          if (shouldSave) {
            console.log(`✅ Updated missing info for Mill: ${cleanName}`);
          }
        }
        
        if (shouldSave) await account.save();
        masters.millId = account._id;
        cache[cacheKey] = account._id;
      }
    }

    if (weaverName && weaverName.trim()) {
      const cleanName = weaverName.trim();
      const cacheKey = `weaver_${cleanName}`;
      if (cache[cacheKey]) {
        masters.weaverId = cache[cacheKey];
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
        cache[cacheKey] = weaver._id;
      }
    }

    if (qualityName) {
      const cleanName = qualityName.trim();
      const cacheKey = `quality_${cleanName}`;
      if (cache[cacheKey]) {
        masters.qualityId = cache[cacheKey];
      } else {
        let quality = await Quality.findOne({ 
          qualityName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } 
        });
        
        let shouldSave = false;
        if (!quality) {
          quality = new Quality({
            qualityName: cleanName,
            processType: "Dyeing",
            hsnCode: hsnCode || undefined
          });
          shouldSave = true;
          console.log(`✅ Created new Quality: ${cleanName}`);
        } else {
          if (!quality.hsnCode && hsnCode) {
            quality.hsnCode = hsnCode;
            shouldSave = true;
          }
          if (shouldSave) {
            console.log(`✅ Updated missing info for Quality: ${cleanName}`);
          }
        }
        
        if (shouldSave) await quality.save();
        masters.qualityId = quality._id;
        cache[cacheKey] = quality._id;
      }
    }

    if (transporterName && transporterName.trim()) {
      const cleanName = transporterName.trim();
      const cacheKey = `transporter_${cleanName}`;
      if (cache[cacheKey]) {
        masters.transporterId = cache[cacheKey];
      } else {
        let transporter = await Account.findOne({ 
          accountName: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') },
          roleType: "Transporter"
        });
        if (!transporter) {
          transporter = await Account.create({
            accountName: cleanName,
            roleType: "Transporter",
            gstType: "Regular",
            isActive: true
          });
          console.log(`✅ Created new Transporter: ${cleanName}`);
        }
        masters.transporterId = transporter._id;
        cache[cacheKey] = transporter._id;
      }
    }
  } catch (err) {
    console.error("❌ Error ensuring masters:", err);
  }

  return masters;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");
  
  await ensureMasters({
    partyName: "Test Party",
    partyAddress: "Test Address",
    gstin: "Test GSTIN",
    qualityName: "Test Quality",
    weaverName: "Test Weaver",
    transporterName: "Test Transporter",
    hsnCode: "Test HSN"
  });
  
  console.log("Done");
  process.exit(0);
}

run();
