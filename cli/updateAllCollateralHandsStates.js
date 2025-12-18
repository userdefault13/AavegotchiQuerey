import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { updateCollateralBaseWithAllHandStates } from './extractAllHandsStates.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Find all collateral base JSON files
 */
function findAllCollateralBaseJSONs() {
  const exportsDir = path.join(__dirname, 'exports', 'Body')
  
  if (!fs.existsSync(exportsDir)) {
    console.error(`Exports directory not found: ${exportsDir}`)
    return []
  }
  
  const files = fs.readdirSync(exportsDir)
  const jsonFiles = files.filter(f => f.startsWith('collateral-base-') && f.endsWith('.json'))
  
  return jsonFiles.map(f => path.join(exportsDir, f))
}

/**
 * Main function
 */
async function main() {
  console.log('=== Update All Collateral Base JSONs with All Hand States ===\n')
  
  const jsonFiles = findAllCollateralBaseJSONs()
  
  if (jsonFiles.length === 0) {
    console.log('No collateral base JSON files found')
    return
  }
  
  console.log(`Found ${jsonFiles.length} collateral base JSON file(s):\n`)
  jsonFiles.forEach(f => console.log(`  - ${path.basename(f)}`))
  console.log('')
  
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < jsonFiles.length; i++) {
    const jsonPath = jsonFiles[i]
    const filename = path.basename(jsonPath)
    
    console.log(`[${i + 1}/${jsonFiles.length}] Processing: ${filename}`)
    
    try {
      // Suppress the internal console.log messages and only show errors
      const originalLog = console.log
      console.log = () => {} // Suppress logs
      
      await updateCollateralBaseWithAllHandStates(jsonPath)
      
      console.log = originalLog // Restore logs
      console.log(`  ✓ Updated successfully\n`)
      successCount++
    } catch (error) {
      errorCount++
      console.error(`  ✗ Error: ${error.message}\n`)
    }
  }
  
  console.log('========================================')
  console.log('BATCH UPDATE COMPLETE')
  console.log('========================================')
  console.log(`Successfully updated: ${successCount}/${jsonFiles.length}`)
  console.log(`Errors: ${errorCount}/${jsonFiles.length}`)
  console.log('========================================')
}

main().catch(error => {
  console.error('\n✗ Fatal error:', error.message)
  console.error(error.stack)
  process.exit(1)
})

