import { ref, onMounted } from 'vue'

const isDark = ref(false)

export function useTheme() {
  // Initialize theme from localStorage or system preference
  const initializeTheme = () => {
    if (typeof window === 'undefined') return
    
    const stored = localStorage.getItem('theme')
    if (stored) {
      isDark.value = stored === 'dark'
    } else {
      // Check system preference
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    applyTheme()
  }

  // Apply theme to document
  const applyTheme = () => {
    if (typeof document === 'undefined') return
    
    if (isDark.value) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // Toggle theme
  const toggleTheme = () => {
    isDark.value = !isDark.value
    applyTheme()
  }

  // Initialize immediately (for SSR compatibility, also on mount)
  if (typeof window !== 'undefined') {
    initializeTheme()
    
    // Watch for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      // Only apply if user hasn't manually set a preference
      if (!localStorage.getItem('theme')) {
        isDark.value = e.matches
        applyTheme()
      }
    })
  }

  // Also initialize on mount (for Vue reactivity)
  onMounted(() => {
    if (typeof window !== 'undefined') {
      initializeTheme()
    }
  })

  return {
    isDark,
    toggleTheme
  }
}

