import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Clean up empty strings from hands arrays in collateral base files
 */
function main() {
  const baseDir = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/Body')
  
  console.log('=== Cleanup Empty Hands ===')
  console.log(`Base directory: ${baseDir}\n`)
  
  if (!fs.existsSync(baseDir)) {
    console.error(`Error: Base directory does not exist: ${baseDir}`)
    process.exit(1)
  }
  
  // Read all base files
  const baseFiles = fs.readdirSync(baseDir)
    .filter(f => f.startsWith('collateral-base-') && f.endsWith('.json'))
    .map(f => path.join(baseDir, f))
  
  console.log(`Found ${baseFiles.length} files\n`)
  
  let cleanedCount = 0
  
  for (const filePath of baseFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      const originalLength = data.hands?.length || 0
      
      if (data.hands && Array.isArray(data.hands)) {
        // Remove empty strings and null values
        data.hands = data.hands.filter(svg => svg !== '' && svg !== null && svg !== undefined)
        
        if (data.hands.length !== originalLength) {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
          console.log(`  ✓ Cleaned ${path.basename(filePath)}: removed ${originalLength - data.hands.length} empty entries`)
          cleanedCount++
        }
      }
    } catch (error) {
      console.error(`  ✗ Error processing ${path.basename(filePath)}:`, error.message)
    }
  }
  
  console.log(`\n=== Summary ===`)
  console.log(`Total: ${baseFiles.length}`)
  console.log(`Cleaned: ${cleanedCount}`)
}

main()


