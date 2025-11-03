/**
 * Parse SVG string to extract metadata
 * @param {string} svgString - The SVG string to parse
 * @returns {Object} - Parsed SVG metadata
 */
export function parseSVG(svgString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.documentElement

  // Get canvas dimensions
  const width = svgElement.getAttribute('width') || svgElement.getAttribute('viewBox')?.split(' ')[2] || '0'
  const height = svgElement.getAttribute('height') || svgElement.getAttribute('viewBox')?.split(' ')[3] || '0'

  const canvasSize = {
    width: parseFloat(width),
    height: parseFloat(height)
  }

  // Extract all parts (groups, images, paths, etc.)
  const parts = []
  
  function extractElements(element, parentTransform = '') {
    const tagName = element.tagName?.toLowerCase()
    if (!tagName) return

    const transform = element.getAttribute('transform') || ''
    const combinedTransform = parentTransform ? `${parentTransform} ${transform}`.trim() : transform

    // Extract dimensions and position for this element
    const x = parseFloat(element.getAttribute('x') || '0')
    const y = parseFloat(element.getAttribute('y') || '0')
    const width = parseFloat(element.getAttribute('width') || '0')
    const height = parseFloat(element.getAttribute('height') || '0')

    if (tagName === 'g' || tagName === 'image' || tagName === 'rect' || tagName === 'path' || tagName === 'circle' || tagName === 'ellipse') {
      // Only add if it has meaningful attributes
      if (width > 0 || height > 0 || x !== 0 || y !== 0 || transform) {
        parts.push({
          tag: tagName,
          id: element.getAttribute('id') || '',
          x: x || 0,
          y: y || 0,
          width: width || 0,
          height: height || 0,
          transform: combinedTransform || null,
          attributes: {
            fill: element.getAttribute('fill'),
            stroke: element.getAttribute('stroke'),
            opacity: element.getAttribute('opacity'),
            class: element.getAttribute('class')
          }
        })
      }
    }

    // Recursively process children
    Array.from(element.children || []).forEach(child => {
      extractElements(child, combinedTransform)
    })
  }

  // Start extraction from root, skip the svg element itself
  Array.from(svgElement.children || []).forEach(child => {
    extractElements(child)
  })

  return {
    canvasSize,
    parts,
    raw: svgString
  }
}

/**
 * Format transform attribute into readable offset info
 */
export function parseTransform(transform) {
  if (!transform) return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 }

  // Match translate(x, y)
  const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/)
  // Match scale(x, y) or scale(n)
  const scaleMatch = transform.match(/scale\(([^,)]+)(?:,\s*([^)]+))?\)/)
  // Match rotate(angle, cx, cy)
  const rotateMatch = transform.match(/rotate\(([^,)]+)(?:,\s*([^,)]+),\s*([^)]+))?\)/)

  return {
    x: translateMatch ? parseFloat(translateMatch[1]) : 0,
    y: translateMatch ? parseFloat(translateMatch[2]) : 0,
    scaleX: scaleMatch ? parseFloat(scaleMatch[1]) : 1,
    scaleY: scaleMatch ? (scaleMatch[2] ? parseFloat(scaleMatch[2]) : parseFloat(scaleMatch[1])) : 1,
    rotate: rotateMatch ? parseFloat(rotateMatch[1]) : 0
  }
}

