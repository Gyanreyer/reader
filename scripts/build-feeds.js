import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Path to the feeds.yml file
const feedsYmlPath = fileURLToPath(import.meta.resolve("../feeds.yml"));
const outputJsonPath = fileURLToPath(import.meta.resolve("../_site/feeds.json"));

const listEntryDashRegex = /\s*-\s+/;

try {
  // Read the feeds.yml file
  const feedsYmlContent = fs.readFileSync(feedsYmlPath, 'utf8');

  // Parse YAML array of strings (simple format: - "url")
  const urls = [];
  const lines = feedsYmlContent.split(listEntryDashRegex);

  for (const line of lines) {
    let trimmedLine = line.trim();

    if (trimmedLine.trim() === '') {
      // Skip empty lines
      continue;
    }

    const firstChar = trimmedLine.charAt(0);
    const lastChar = trimmedLine.charAt(trimmedLine.length - 1);
    if (firstChar === lastChar && (firstChar === '"' || firstChar === "'")) {
      // Remove surrounding quotes if they match      
      trimmedLine = trimmedLine.slice(1, -1);
    }

    urls.push(encodeURI(trimmedLine));
  }

  // Ensure _site directory exists
  const siteDir = path.dirname(outputJsonPath);
  if (!fs.existsSync(siteDir)) {
    fs.mkdirSync(siteDir, { recursive: true });
  }

  // Convert to JSON and write to file
  const jsonContent = JSON.stringify(urls);
  fs.writeFileSync(outputJsonPath, jsonContent, 'utf8');

  console.log(`✅ Successfully converted ${urls.length} feeds from YAML to JSON`);
  console.log(`📁 Output written to: ${outputJsonPath}`);
} catch (error) {
  console.error('❌ Error converting feeds:', error.message);
  process.exit(1);
}