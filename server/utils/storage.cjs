const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function getFilePath(fileName) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  return path.join(DATA_DIR, fileName);
}

function readData(fileName, fallback = []) {
  const filePath = getFilePath(fileName);

  try {
    if (!fs.existsSync(filePath)) {
      writeData(fileName, fallback);
      return fallback;
    }

    let data = fs.readFileSync(filePath, "utf8");
    if (data.charCodeAt(0) === 0xFEFF) {
      data = data.slice(1);
    }

    if (!data.trim()) {
      return fallback;
    }

    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${fileName}:`, error.message);
    return fallback;
  }
}

function writeData(fileName, data) {
  const filePath = getFilePath(fileName);

  fs.writeFileSync(
    filePath,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  return true;
}

function createRecord(fileName, record) {
  const records = readData(fileName, []);

  records.push(record);

  writeData(fileName, records);

  return record;
}

function findById(fileName, id) {
  const records = readData(fileName, []);

  return records.find(
    (record) => String(record.id) === String(id)
  );
}

function updateById(fileName, id, updates) {
  const records = readData(fileName, []);

  const index = records.findIndex(
    (record) => String(record.id) === String(id)
  );

  if (index === -1) {
    return null;
  }

  records[index] = {
    ...records[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  writeData(fileName, records);

  return records[index];
}

function deleteById(fileName, id) {
  const records = readData(fileName, []);

  const filtered = records.filter(
    (record) => String(record.id) !== String(id)
  );

  if (filtered.length === records.length) {
    return false;
  }

  writeData(fileName, filtered);

  return true;
}

function generateId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 8)}`;
}

module.exports = {
  readData,
  writeData,
  createRecord,
  findById,
  updateById,
  deleteById,
  generateId,
};