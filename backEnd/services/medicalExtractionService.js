import fs from "fs";
import { PDFParse } from "pdf-parse";

// ==========================================
// NORMALIZE BLOOD GROUP
// ==========================================

const normalizeBloodGroup = (value) => {
  if (!value) {
    return null;
  }

  return value.toUpperCase().replace(/\s+/g, "");
};

// ==========================================
// NUMBER HELPER
// ==========================================

const getNumber = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const number = Number(value);

  return Number.isNaN(number) ? null : number;
};

// ==========================================
// BLOOD GROUP
// ==========================================

const extractBloodGroup = (text) => {
  if (!text) {
    return null;
  }

  const patterns = [
    /blood\s*group\s*[:\-]?\s*(AB|A|B|O)\s*([+-])/i,

    /blood\s*type\s*[:\-]?\s*(AB|A|B|O)\s*([+-])/i,

    /abo\s*(?:group|type)?\s*[:\-]?\s*(AB|A|B|O)\s*([+-])/i,

    /\b(AB|A|B|O)\s*(positive|negative)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) {
      continue;
    }

    let group = match[1];

    let rh = match[2];

    if (rh?.toLowerCase() === "positive") {
      rh = "+";
    }

    if (rh?.toLowerCase() === "negative") {
      rh = "-";
    }

    return normalizeBloodGroup(`${group}${rh}`);
  }

  return null;
};

// ==========================================
// CBC FIELDS
// ==========================================

const extractHemoglobin = (text) => {
  const match = text.match(/hemoglobin\s+(\d+(?:\.\d+)?)/i);

  return match ? getNumber(match[1]) : null;
};

const extractWbc = (text) => {
  const match = text.match(/total\s+leukocyte\s+count\s+(\d+(?:\.\d+)?)/i);

  return match ? getNumber(match[1]) : null;
};

const extractRbc = (text) => {
  const match = text.match(/red\s+blood\s+cell\s+count\s+(\d+(?:\.\d+)?)/i);

  return match ? getNumber(match[1]) : null;
};

const extractHematocrit = (text) => {
  const match = text.match(/hematocrit(?:\s*\(pcv\))?\s+(\d+(?:\.\d+)?)/i);

  return match ? getNumber(match[1]) : null;
};

const extractPlatelets = (text) => {
  const match = text.match(/platelet\s+count\s+(\d+(?:\.\d+)?)/i);

  return match ? getNumber(match[1]) : null;
};

// ==========================================
// HEIGHT
// ==========================================

const extractHeight = (text) => {
  const match = text.match(
    /height\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:cm|centimeter|centimeters)/i,
  );

  return match ? getNumber(match[1]) : null;
};

// ==========================================
// WEIGHT
// ==========================================

const extractWeight = (text) => {
  const match = text.match(
    /weight\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilogram|kilograms)/i,
  );

  return match ? getNumber(match[1]) : null;
};

// ==========================================
// PDF EXTRACTION
// ==========================================

export const extractMedicalDataFromPdf = async (filePath) => {
  let parser = null;

  try {
    const buffer = fs.readFileSync(filePath);

    parser = new PDFParse({
      data: buffer,
    });

    const result = await parser.getText();

    const text = result?.text || "";

    const extractedData = {
      bloodGroup: extractBloodGroup(text),

      hla: {
        hlaA: [],
        hlaB: [],
        hlaDR: [],
      },

      heightCm: extractHeight(text),

      weightKg: extractWeight(text),

      cbc: {
        hemoglobin: extractHemoglobin(text),

        wbc: extractWbc(text),

        rbc: extractRbc(text),

        hematocrit: extractHematocrit(text),

        platelets: extractPlatelets(text),
      },
    };

    return {
      extractedData,
    };
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch (error) {
        console.warn("PDF parser cleanup warning:", error.message);
      }
    }
  }
};
