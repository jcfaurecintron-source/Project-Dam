/**
 * OEWS Multi-Year Fetcher
 * 
 * Fetches multiple years of BLS OEWS MSA data with proper HTTP etiquette,
 * caching, and integrity checks.
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
  year: number;
  status: 'SKIP_UNCHANGED' | 'PROCEED_PARSE' | 'ERROR';
  url: string;
  sha256?: string;
  xlsxPaths?: string[];
  error?: string;
}

function calculateSHA256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function loadCacheMetadata(zipPath: string): CacheMetadata {
  const metadataPath = `${zipPath}.metadata.json`;
  if (fs.existsSync(metadataPath)) {
    return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  }
  return {};
}

function saveCacheMetadata(zipPath: string, metadata: CacheMetadata): void {
  const metadataPath = `${zipPath}.metadata.json`;
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

function saveSHA256(filePath: string, hash: string): void {
  const checksumPath = `${filePath}.sha256`;
  fs.writeFileSync(checksumPath, `${hash}  ${path.basename(filePath)}\n`);
}

async function checkIfModified(url: string, cache: CacheMetadata): Promise<{ modified: boolean; headers?: any }> {
  const headers: any = {
    'User-Agent': `Project-Dam-OEWS-Fetch/1.0 (contact: ${config.contact})`,
  };

  if (cache.lastModified) headers['If-Modified-Since'] = cache.lastModified;
  if (cache.etag) headers['If-None-Match'] = cache.etag;

  try {
    const response = await fetch(url, { method: 'HEAD', headers, timeout: 10000 });
    if (response.status === 304) return { modified: false };
    return {
      modified: true,
      headers: {
        lastModified: response.headers.get('last-modified'),
        etag: response.headers.get('etag'),
      },
    };
  } catch (error) {
    return { modified: true };
  }
}

async function downloadFile(url: string, outputPath: string): Promise<{ bytes: number; headers: any }> {
  const headers = {
    'User-Agent': `Project-Dam-OEWS-Fetch/1.0 (contact: ${config.contact})`,
    'Accept': 'application/zip,application/octet-stream,*/*',
  };

  const response = await fetch(url, { headers, timeout: 60000 });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const buffer = await response.buffer();
  fs.writeFileSync(outputPath, buffer);

  return {
    bytes: buffer.length,
    headers: {
      lastModified: response.headers.get('last-modified'),
      etag: response.headers.get('etag'),
    },
  };
}

function extractZip(zipPath: string, extractDir: string): { count: number; files: string[] } {
  const stats = fs.statSync(zipPath);
  if (stats.size < 1000) {
    throw new Error('ZIP file too small (likely corrupt)');
  }

  const zip = new AdmZip(zipPath);
  const zipEntries = zip.getEntries();

  if (zipEntries.length === 0) {
    throw new Error('ZIP file is empty');
  }

  fs.mkdirSync(extractDir, { recursive: true });
  zip.extractAllTo(extractDir, true);

  return {
    count: zipEntries.length,
    files: zipEntries.map(entry => entry.entryName),
  };
}

function findWorkbooks(dir: string): string[] {
  const workbooks: string[] = [];
  
  function searchDir(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
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
  
  // Prioritize MSA files
  workbooks.sort((a, b) => {
    const aIsMsa = /MSA.*\.xlsx?$/i.test(a);
    const bIsMsa = /MSA.*\.xlsx?$/i.test(b);
    if (aIsMsa && !bIsMsa) return -1;
    if (!aIsMsa && bIsMsa) return 1;
    return a.localeCompare(b);
  });
  
  return workbooks;
}

async function fetchYearData(year: number): Promise<FetchResult> {
  const yy = String(year).slice(-2);
  const url = config.urlTemplate.replace('{YY}', yy);
  const fileName = `oesm${yy}ma.zip`;
  const zipPath = path.join(config.rawDir, fileName);
  const extractDir = path.join(config.rawDir, 'msa', String(year));

  console.log(`\n📅 Year ${year}`);
  console.log(`   URL: ${url}`);

  // Check cache
  const cache = loadCacheMetadata(zipPath);
  
  if (fs.existsSync(zipPath) && cache.sha256) {
    const { modified } = await checkIfModified(url, cache);
    
    if (!modified) {
      const currentHash = calculateSHA256(zipPath);
      if (currentHash === cache.sha256) {
        console.log('   ✅ 304 Not Modified - using cache');
        const workbooks = findWorkbooks(extractDir);
        return {
          year,
          status: 'SKIP_UNCHANGED',
          url,
          sha256: cache.sha256,
          xlsxPaths: workbooks.filter(w => /MSA.*\.xlsx?$/i.test(w)),
        };
      }
    }
  }

  // Download
  try {
    console.log('   📥 Downloading...');
    const result = await downloadFile(url, zipPath);
    console.log(`   ✅ ${(result.bytes / 1024 / 1024).toFixed(2)} MB`);

    // SHA256
    const sha256 = calculateSHA256(zipPath);
    saveSHA256(zipPath, sha256);

    // Extract
    const extracted = extractZip(zipPath, extractDir);
    console.log(`   📦 Extracted ${extracted.count} files`);

    // Find workbooks
    const workbooks = findWorkbooks(extractDir);
    const msaFiles = workbooks.filter(w => /MSA.*\.xlsx?$/i.test(w));
    
    if (msaFiles.length === 0) {
      throw new Error('No MSA workbook found');
    }

    console.log(`   ✅ Found ${msaFiles.length} MSA workbook(s)`);

    // Save metadata
    const metadata: CacheMetadata = {
      lastModified: result.headers.lastModified,
      etag: result.headers.etag,
      sha256,
      downloadedAt: new Date().toISOString(),
    };
    saveCacheMetadata(zipPath, metadata);

    return {
      year,
      status: 'PROCEED_PARSE',
      url,
      sha256,
      xlsxPaths: msaFiles,
    };
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    
    if (error.message.includes('404')) {
      return { year, status: 'ERROR', url, error: 'File not found (404)' };
    }
    
    return { year, status: 'ERROR', url, error: error.message };
  }
}

async function main() {
  console.log('🔄 OEWS Multi-Year Fetcher\n');
  console.log(`📅 Years: ${config.years.join(', ')}\n`);

  fs.mkdirSync(config.rawDir, { recursive: true });

  const results: FetchResult[] = [];
  
  for (const year of config.years) {
    const result = await fetchYearData(year);
    results.push(result);
    
    // Rate limiting - wait 1 second between requests
    if (year !== config.years[config.years.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log('\n📊 Summary:');
  const cached = results.filter(r => r.status === 'SKIP_UNCHANGED').length;
  const downloaded = results.filter(r => r.status === 'PROCEED_PARSE').length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  console.log(`   ✅ Cached: ${cached}`);
  console.log(`   📥 Downloaded: ${downloaded}`);
  console.log(`   ❌ Errors: ${errors}`);

  if (errors > 0) {
    console.log('\n⚠️  Errors encountered:');
    results.filter(r => r.status === 'ERROR').forEach(r => {
      console.log(`   ${r.year}: ${r.error}`);
    });
  }

  // Save results manifest
  const manifestPath = path.join(config.rawDir, 'fetch-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Manifest saved: ${manifestPath}`);

  console.log('\n✅ Fetch complete!\n');
  process.exit(errors > 0 ? 1 : EXIT_CODES.SUCCESS);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(EXIT_CODES.E_NETWORK_ERROR);
});

