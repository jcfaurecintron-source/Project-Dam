/**
 * OEWS MSA File Fetcher
 * 
 * Fetches BLS OEWS data with proper HTTP etiquette, caching, and integrity checks.
 * No page scraping - direct URL fetch only.
 * 
 * Exit Codes:
 * - 0: Success (downloaded or already cached)
 * - 1: E_FILE_NOT_FOUND (404)
 * - 2: E_BLS_THROTTLE (403/429)
 * - 3: E_CORRUPT_ARCHIVE (invalid/empty ZIP)
 * - 4: E_NETWORK_ERROR (other network issues)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';

// Load config
const config = JSON.parse(fs.readFileSync('oews.config.json', 'utf-8'));

const EXIT_CODES = {
  SUCCESS: 0,
  E_FILE_NOT_FOUND: 1,
  E_BLS_THROTTLE: 2,
  E_CORRUPT_ARCHIVE: 3,
  E_NETWORK_ERROR: 4,
};

interface CacheMetadata {
  lastModified?: string;
  etag?: string;
  sha256?: string;
  downloadedAt?: string;
}

interface FetchResult {
  status: 'SKIP_UNCHANGED' | 'PROCEED_PARSE' | 'MANUAL_REQUIRED';
  url: string;
  lastModified?: string;
  etag?: string;
  bytes?: number;
  sha256?: string;
  unzipCount?: number;
  tablesFound?: string[];
  xlsxPaths?: string[];
}

/**
 * Calculate SHA256 checksum of a file
 */
function calculateSHA256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Load cache metadata if exists
 */
function loadCacheMetadata(zipPath: string): CacheMetadata {
  const metadataPath = `${zipPath}.metadata.json`;
  if (fs.existsSync(metadataPath)) {
    return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  }
  return {};
}

/**
 * Save cache metadata
 */
function saveCacheMetadata(zipPath: string, metadata: CacheMetadata): void {
  const metadataPath = `${zipPath}.metadata.json`;
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Save SHA256 checksum to file
 */
function saveSHA256(filePath: string, hash: string): void {
  const checksumPath = `${filePath}.sha256`;
  fs.writeFileSync(checksumPath, `${hash}  ${path.basename(filePath)}\n`);
}

/**
 * Perform HEAD request to check if file has changed
 */
async function checkIfModified(url: string, cache: CacheMetadata): Promise<{ modified: boolean; headers?: any }> {
  const headers: any = {
    'User-Agent': `Project-Dam-OEWS-Fetch/1.0 (contact: ${config.contact})`,
  };

  if (cache.lastModified) {
    headers['If-Modified-Since'] = cache.lastModified;
  }
  if (cache.etag) {
    headers['If-None-Match'] = cache.etag;
  }

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers,
      timeout: 10000,
    });

    if (response.status === 304) {
      return { modified: false };
    }

    return {
      modified: true,
      headers: {
        lastModified: response.headers.get('last-modified'),
        etag: response.headers.get('etag'),
      },
    };
  } catch (error) {
    // If HEAD fails, we'll try GET
    return { modified: true };
  }
}

/**
 * Download file with streaming
 */
async function downloadFile(url: string, outputPath: string): Promise<{ bytes: number; headers: any }> {
  const headers = {
    'User-Agent': `Project-Dam-OEWS-Fetch/1.0 (contact: ${config.contact})`,
    'Accept': 'application/zip,application/octet-stream,*/*',
  };

  const response = await fetch(url, { headers, timeout: 60000 });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Check content type
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('zip') && !contentType.includes('octet-stream') && !contentType.includes('application/x-zip')) {
    // Might be HTML error page
    const text = await response.text();
    if (text.toLowerCase().includes('<html') || text.toLowerCase().includes('<!doctype')) {
      throw new Error('Received HTML page instead of ZIP file');
    }
  }

  // Stream to file
  const fileStream = fs.createWriteStream(outputPath);
  const buffer = await response.buffer();
  
  return new Promise((resolve, reject) => {
    fileStream.write(buffer);
    fileStream.end();
    fileStream.on('finish', () => {
      resolve({
        bytes: buffer.length,
        headers: {
          lastModified: response.headers.get('last-modified'),
          etag: response.headers.get('etag'),
          contentType: response.headers.get('content-type'),
        },
      });
    });
    fileStream.on('error', reject);
  });
}

/**
 * Validate and extract ZIP file
 */
function extractZip(zipPath: string, extractDir: string): { count: number; files: string[] } {
  // Validate it's actually a ZIP
  if (!fs.existsSync(zipPath)) {
    throw new Error('ZIP file does not exist');
  }

  const stats = fs.statSync(zipPath);
  if (stats.size < 1000) {
    throw new Error('ZIP file too small (likely corrupt or HTML error page)');
  }

  try {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();

    if (zipEntries.length === 0) {
      throw new Error('ZIP file is empty');
    }

    // Create extract directory
    fs.mkdirSync(extractDir, { recursive: true });

    // Extract all files
    zip.extractAllTo(extractDir, true);

    const extractedFiles = zipEntries.map(entry => entry.entryName);
    
    return {
      count: zipEntries.length,
      files: extractedFiles,
    };
  } catch (error: any) {
    throw new Error(`Failed to extract ZIP: ${error.message}`);
  }
}

/**
 * Find Excel workbooks in extracted directory
 * Prioritizes MSA files over others
 */
function findWorkbooks(dir: string): string[] {
  const workbooks: string[] = [];
  
  function searchDir(currentDir: string) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        searchDir(fullPath);
      } else if (item.match(/\.(xlsx|xls)$/i)) {
        workbooks.push(fullPath);
      }
    }
  }
  
  searchDir(dir);
  
  // Sort to prioritize MSA files first
  workbooks.sort((a, b) => {
    const aIsMsa = /MSA.*\.xlsx?$/i.test(a);
    const bIsMsa = /MSA.*\.xlsx?$/i.test(b);
    if (aIsMsa && !bIsMsa) return -1;
    if (!aIsMsa && bIsMsa) return 1;
    return a.localeCompare(b);
  });
  
  return workbooks;
}

/**
 * Main fetch function
 */
async function fetchOews(): Promise<FetchResult> {
  console.log('🔄 OEWS MSA File Fetcher\n');
  
  const { directUrl, rawDir, extractDir, file } = config;
  const zipPath = path.join(rawDir, file);
  
  // Ensure directories exist
  fs.mkdirSync(rawDir, { recursive: true });
  
  // Load cache metadata
  const cache = loadCacheMetadata(zipPath);
  
  console.log(`📍 URL: ${directUrl}`);
  console.log(`📁 Output: ${zipPath}\n`);
  
  // Check if file has been modified (HEAD request)
  if (fs.existsSync(zipPath) && cache.sha256) {
    console.log('🔍 Checking if file has changed (HEAD request)...');
    
    const { modified, headers } = await checkIfModified(directUrl, cache);
    
    if (!modified) {
      console.log('✅ 304 Not Modified - using cached file\n');
      
      // Verify checksum
      const currentHash = calculateSHA256(zipPath);
      if (currentHash === cache.sha256) {
        // Find workbooks in extracted directory
        const workbooks = findWorkbooks(extractDir);
        
        return {
          status: 'SKIP_UNCHANGED',
          url: directUrl,
          lastModified: cache.lastModified,
          etag: cache.etag,
          sha256: cache.sha256,
          tablesFound: workbooks.map(wb => path.basename(wb)),
          xlsxPaths: workbooks,
        };
      } else {
        console.log('⚠️  Checksum mismatch - redownloading...\n');
      }
    } else {
      console.log('📥 File has changed - downloading new version...\n');
    }
  }
  
  // Download file
  let downloadResult;
  let retries = 0;
  const maxRetries = 1;
  
  while (retries <= maxRetries) {
    try {
      console.log(`📥 Downloading (attempt ${retries + 1})...`);
      downloadResult = await downloadFile(directUrl, zipPath);
      console.log(`✅ Downloaded ${(downloadResult.bytes / 1024 / 1024).toFixed(2)} MB\n`);
      break;
    } catch (error: any) {
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('404')) {
        console.error('❌ E_FILE_NOT_FOUND: File not found at URL');
        console.error(`   URL: ${directUrl}`);
        console.error('   Please check the URL or download manually.\n');
        process.exit(EXIT_CODES.E_FILE_NOT_FOUND);
      }
      
      if (errorMsg.includes('403') || errorMsg.includes('429')) {
        console.error('❌ E_BLS_THROTTLE: Access denied or rate limited');
        console.error('   The BLS server is blocking automated requests.');
        console.error('   Please download manually from: https://www.bls.gov/oes/tables.htm\n');
        process.exit(EXIT_CODES.E_BLS_THROTTLE);
      }
      
      if (errorMsg.includes('html')) {
        console.error('❌ Received HTML page instead of ZIP file');
        console.error('   The server may be blocking automated requests.');
        console.error('   Please download manually.\n');
        process.exit(EXIT_CODES.E_BLS_THROTTLE);
      }
      
      if (retries < maxRetries) {
        console.log(`⚠️  Network error, retrying in 2s... (${error.message})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries++;
      } else {
        console.error(`❌ E_NETWORK_ERROR: ${error.message}\n`);
        process.exit(EXIT_CODES.E_NETWORK_ERROR);
      }
    }
  }
  
  if (!downloadResult) {
    console.error('❌ Download failed\n');
    process.exit(EXIT_CODES.E_NETWORK_ERROR);
  }
  
  // Calculate SHA256
  console.log('🔐 Computing SHA256 checksum...');
  const sha256 = calculateSHA256(zipPath);
  console.log(`   ${sha256}\n`);
  
  saveSHA256(zipPath, sha256);
  
  // Check if same as cached
  if (cache.sha256 === sha256) {
    console.log('✅ Checksum unchanged - no reprocessing needed\n');
    return {
      status: 'SKIP_UNCHANGED',
      url: directUrl,
      lastModified: downloadResult.headers.lastModified,
      etag: downloadResult.headers.etag,
      bytes: downloadResult.bytes,
      sha256,
    };
  }
  
  // Extract ZIP
  console.log('📦 Extracting ZIP archive...');
  try {
    const extracted = extractZip(zipPath, extractDir);
    console.log(`✅ Extracted ${extracted.count} files\n`);
    
    // Find workbooks
    console.log('🔍 Searching for Excel workbooks...');
    const workbooks = findWorkbooks(extractDir);
    
    if (workbooks.length === 0) {
      console.error('❌ E_CORRUPT_ARCHIVE: No Excel workbooks found in ZIP');
      fs.unlinkSync(zipPath);
      process.exit(EXIT_CODES.E_CORRUPT_ARCHIVE);
    }
    
    console.log(`✅ Found ${workbooks.length} workbook(s):`);
    workbooks.forEach(wb => console.log(`   - ${path.relative(process.cwd(), wb)}`));
    console.log();
    
    // Save metadata
    const metadata: CacheMetadata = {
      lastModified: downloadResult.headers.lastModified,
      etag: downloadResult.headers.etag,
      sha256,
      downloadedAt: new Date().toISOString(),
    };
    saveCacheMetadata(zipPath, metadata);
    
    return {
      status: 'PROCEED_PARSE',
      url: directUrl,
      lastModified: metadata.lastModified,
      etag: metadata.etag,
      bytes: downloadResult.bytes,
      sha256,
      unzipCount: extracted.count,
      tablesFound: workbooks.map(wb => path.basename(wb)),
      xlsxPaths: workbooks,
    };
    
  } catch (error: any) {
    console.error(`❌ E_CORRUPT_ARCHIVE: ${error.message}`);
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    process.exit(EXIT_CODES.E_CORRUPT_ARCHIVE);
  }
}

/**
 * Run fetcher
 */
async function main() {
  try {
    const result = await fetchOews();
    
    console.log('📊 Summary:');
    console.log(`   Decision: ${result.status}`);
    console.log(`   URL: ${result.url}`);
    if (result.lastModified) console.log(`   Last-Modified: ${result.lastModified}`);
    if (result.etag) console.log(`   ETag: ${result.etag}`);
    if (result.bytes) console.log(`   Bytes: ${result.bytes.toLocaleString()}`);
    if (result.sha256) console.log(`   SHA256: ${result.sha256}`);
    if (result.unzipCount) console.log(`   Files Extracted: ${result.unzipCount}`);
    if (result.tablesFound) console.log(`   Tables Found: ${result.tablesFound.join(', ')}`);
    console.log();
    
    // Write result for next script to consume
    fs.writeFileSync('data/raw/oews/fetch-result.json', JSON.stringify(result, null, 2));
    
    if (result.status === 'PROCEED_PARSE') {
      console.log('✅ New data available - ready for processing');
      console.log('   Run: npm run process-oews-2024\n');
      process.exit(EXIT_CODES.SUCCESS);
    } else {
      console.log('✅ Using cached data - no processing needed\n');
      process.exit(EXIT_CODES.SUCCESS);
    }
    
  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(EXIT_CODES.E_NETWORK_ERROR);
  }
}

main();

