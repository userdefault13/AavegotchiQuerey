<template>
  <div class="stage-container" :class="{ 'dressing-room-active': isDressingRoomMode }">
    <button @click="$emit('close')" class="close-btn">← Back to Gallery</button>

    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading Aavegotchi data...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <p class="error-text">Error: {{ error.message }}</p>
    </div>

    <div v-else-if="gotchiData" class="stage-content">
      <!-- Gotchi Info Section -->
      <div class="info-section">
        <h1 class="gotchi-title">
          <span class="gotchi-id">#{{ gotchiData.tokenId }}</span>
          <span class="gotchi-name">{{ gotchiData.name || 'Unnamed Aavegotchi' }}</span>
        </h1>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Kinship</div>
            <div class="stat-value">{{ gotchiData.kinship }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">BRS</div>
            <div class="stat-value">{{ gotchiData.brs }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">XP</div>
            <div class="stat-value">{{ gotchiData.xp }}</div>
          </div>
        </div>

        <div class="traits-grid">
          <div class="trait-item">
            <span class="trait-label">NRG:</span>
            <span class="trait-value">{{ gotchiData.nrg }}</span>
          </div>
          <div class="trait-item">
            <span class="trait-label">AGG:</span>
            <span class="trait-value">{{ gotchiData.agg }}</span>
          </div>
          <div class="trait-item">
            <span class="trait-label">SPK:</span>
            <span class="trait-value">{{ gotchiData.spk }}</span>
          </div>
          <div class="trait-item">
            <span class="trait-label">BRN:</span>
            <span class="trait-value">{{ gotchiData.brn }}</span>
          </div>
          <div class="trait-item">
            <span class="trait-label">EYS:</span>
            <span class="trait-value">{{ gotchiData.eys }}</span>
          </div>
          <div class="trait-item">
            <span class="trait-label">EYC:</span>
            <span class="trait-value">{{ gotchiData.eyc }}</span>
          </div>
        </div>
      </div>

      <!-- SVG Section -->
      <div class="svg-section" v-if="svgViews">
        <div class="svg-header">
          <h2 class="section-title">Aavegotchi SVG</h2>
          <div class="view-controls">
            <button 
              @click="previousView" 
              class="nav-btn"
              :disabled="isLoadingSideViews || currentViewIndex === 0"
              title="Previous View"
            >
              ←
            </button>
            <span class="view-indicator">{{ currentViewName }}</span>
            <button 
              @click="nextView" 
              class="nav-btn"
              :disabled="isLoadingSideViews || currentViewIndex >= availableViews.length - 1"
              title="Next View"
            >
              →
            </button>
            <button 
              @click="isDressingRoomMode = !isDressingRoomMode"
              class="dressing-room-btn"
              :class="{ 'active': isDressingRoomMode }"
            >
              {{ isDressingRoomMode ? 'Exit Dressing Room' : 'Dressing Room' }}
            </button>
          </div>
        </div>
        <div class="svg-view-container">
          <div v-if="isLoadingSideViews && currentViewIndex > 0" class="loading-overlay">
            <div class="loading-spinner-small"></div>
            <p>Loading view...</p>
          </div>
          <SVGViewer 
            v-if="currentSvgView && currentSvgView.length > 0"
            :svg-string="currentSvgView" 
            :view-name="currentViewName"
            :gotchi-id="props.gotchiId"
            :data-attribute="'data-gotchi-stage-id'"
          />
          <div v-else-if="isLoadingPreview && isDressingRoomMode" class="svg-loading-fallback">
            <div class="loading-spinner-small"></div>
            <p>Generating preview...</p>
          </div>
          <div v-else class="svg-loading-fallback">
            <div class="loading-spinner-small"></div>
            <p>Loading SVG view...</p>
            <p class="debug-info" v-if="!currentSvgView">No SVG view available</p>
            <p class="debug-info" v-else-if="currentSvgView.length === 0">SVG view is empty</p>
          </div>
          <div class="svg-code-wrapper">
            <button 
              @click="copyToClipboard(currentSvgView, `svg-${currentViewName}`)" 
              class="copy-code-btn"
              :class="{ 'copied': copiedId === `svg-${currentViewName}` }"
            >
              {{ copiedId === `svg-${currentViewName}` ? '✓ Copied!' : 'Copy SVG Code' }}
            </button>
            <details class="svg-code-details">
              <summary class="code-summary">Show SVG Code</summary>
              <pre class="svg-code-block"><code>{{ currentSvgView }}</code></pre>
            </details>
          </div>
          
          <!-- All Views SVG Code Tabs -->
          <div class="all-views-code-section" v-if="availableViews.length > 0">
            <h3 class="section-subtitle">All Views SVG Code</h3>
            <div class="svg-tabs">
              <button 
                v-for="view in availableViews" 
                :key="view"
                @click="activeTab = view"
                :class="['tab-btn', { active: activeTab === view }]"
              >
                {{ view }}
              </button>
            </div>
            <div class="tab-content">
              <div class="code-block-wrapper" v-if="getViewSvgCode(activeTab)">
                <button 
                  @click="copyViewCode(activeTab)" 
                  class="copy-code-btn"
                  :class="{ 'copied': copiedId === `all-views-svg-${activeTab}` }"
                >
                  {{ copiedId === `all-views-svg-${activeTab}` ? '✓ Copied!' : `Copy ${activeTab} SVG` }}
                </button>
                <pre class="svg-code-block">
                  <code>{{ getViewSvgCode(activeTab) }}</code>
                </pre>
              </div>
              <div v-else class="loading-code">
                <p>Loading {{ activeTab }} view code...</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Parts & Wearables Breakdown Section -->
      <div class="breakdown-section" v-if="availableViews.length > 0">
        <h3 class="section-subtitle">Parts & Wearables Breakdown</h3>
        <div class="svg-tabs">
          <button 
            v-for="view in availableViews" 
            :key="view"
            @click="activeBreakdownTab = view"
            :class="['tab-btn', { active: activeBreakdownTab === view }]"
          >
            {{ view }}
          </button>
        </div>
        <div class="tab-content">
          <div v-if="getBreakdownForView(activeBreakdownTab)" class="breakdown-content">
            <!-- Gotchi Parts -->
            <div class="breakdown-category">
              <h4 class="category-title">Gotchi Parts</h4>
              <div class="category-list">
                <div 
                  v-for="(category, categoryName) in getBreakdownForView(activeBreakdownTab).parts" 
                  :key="categoryName"
                  class="category-item"
                >
                  <details class="category-details">
                    <summary class="category-summary">
                      <span class="category-name">{{ categoryName }}</span>
                      <span class="category-count">{{ category.elements.length }} element{{ category.elements.length !== 1 ? 's' : '' }}</span>
                    </summary>
                    <div class="category-elements">
                      <div 
                        v-for="(element, idx) in category.elements" 
                        :key="idx"
                        class="element-item"
                        :class="{ 'is-wearable': element.isWearable }"
                      >
                        <div class="element-header">
                          <div class="element-info">
                            <span class="element-tag">{{ element.tag }}</span>
                            <span v-if="element.attributes.class" class="element-class">{{ element.attributes.class }}</span>
                            <span v-if="element.isWearable" class="wearable-badge">Wearable</span>
                          </div>
                          <div class="element-actions">
                            <button 
                              @click="copyElementSvg(element.svgCode, `part-${activeBreakdownTab}-${categoryName}-${idx}`)"
                              class="copy-element-btn"
                              :class="{ 'copied': copiedId === `part-${activeBreakdownTab}-${categoryName}-${idx}` }"
                              title="Copy SVG Code"
                            >
                              {{ copiedId === `part-${activeBreakdownTab}-${categoryName}-${idx}` ? '✓' : '📋' }}
                            </button>
                          </div>
                        </div>
                        <div class="element-preview-section">
                          <div 
                            v-if="element.svgCode"
                            class="element-thumbnail-wrapper"
                            @mouseenter="showPreview = `part-${activeBreakdownTab}-${categoryName}-${idx}`"
                            @mouseleave="showPreview = null"
                          >
                            <div 
                              class="element-thumbnail"
                              v-html="element.svgCode"
                            ></div>
                            <div 
                              v-if="showPreview === `part-${activeBreakdownTab}-${categoryName}-${idx}`"
                              class="element-preview-popup"
                            >
                              <div 
                                class="preview-svg" 
                                v-html="element.svgCode"
                                :data-preview-id="`part-${activeBreakdownTab}-${categoryName}-${idx}`"
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div class="element-details">
                          <div v-if="element.isWearable && element.wearableClasses" class="element-detail-row">
                            <span class="detail-label">Wearable Classes:</span>
                            <span class="detail-value wearable-classes">
                              <span v-for="(wc, wcIdx) in element.wearableClasses" :key="wcIdx" class="wearable-class-tag">{{ wc }}</span>
                            </span>
                          </div>
                          <div class="element-detail-row">
                            <span class="detail-label">Offset:</span>
                            <span class="detail-value">({{ element.offset.x }}, {{ element.offset.y }})</span>
                          </div>
                          <div class="element-detail-row">
                            <span class="detail-label">Dimension:</span>
                            <span class="detail-value">{{ element.dimension.width }} × {{ element.dimension.height }}</span>
                          </div>
                          <div v-if="element.primaryFill" class="element-detail-row">
                            <span class="detail-label">Primary Fill:</span>
                            <span class="detail-value fill-color">
                              <span class="color-swatch" :style="{ backgroundColor: element.primaryFill }"></span>
                              {{ element.primaryFill }}
                            </span>
                          </div>
                          <div v-if="element.secondaryFill" class="element-detail-row">
                            <span class="detail-label">Secondary Fill:</span>
                            <span class="detail-value fill-color">
                              <span class="color-swatch" :style="{ backgroundColor: element.secondaryFill }"></span>
                              {{ element.secondaryFill }}
                            </span>
                          </div>
                          <div v-if="element.transform" class="element-detail-row">
                            <span class="detail-label">Transform:</span>
                            <span class="detail-value transform-value">{{ element.transform }}</span>
                          </div>
                        </div>
                        <details v-if="element.svgCode" class="element-code-details">
                          <summary class="element-code-summary">Show SVG Code</summary>
                          <pre class="element-code-block"><code>{{ element.svgCode }}</code></pre>
                        </details>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>

            <!-- Wearables -->
            <div class="breakdown-category">
              <h4 class="category-title">Wearables</h4>
              <div class="category-list">
                <!-- Standard Wearable Slots -->
                <div 
                  v-for="(wearable, idx) in getBreakdownForView(activeBreakdownTab).wearables.filter(w => w.slot !== -1)" 
                  :key="idx"
                  class="category-item"
                >
                  <div class="wearable-item">
                    <div class="wearable-header">
                      <span class="wearable-slot">{{ wearable.slotName }}</span>
                      <span v-if="wearable.wearableId !== 0" class="wearable-id">ID: {{ wearable.wearableId }}</span>
                      <span v-else class="wearable-empty">Not equipped</span>
                    </div>
                    <div v-if="wearable.elements.length > 0" class="wearable-details">
                      <div class="wearable-info">
                        <span>Class: {{ wearable.className }}</span>
                        <span>{{ wearable.elements.length }} element{{ wearable.elements.length !== 1 ? 's' : '' }}</span>
                      </div>
                      <details class="wearable-elements">
                        <summary class="wearable-summary">Show elements</summary>
                        <div class="element-list">
                          <div 
                            v-for="(element, elemIdx) in wearable.elements" 
                            :key="elemIdx"
                            class="element-item"
                          >
                            <div class="element-header">
                              <div class="element-info">
                                <span class="element-tag">{{ element.tag }}</span>
                              </div>
                              <div class="element-actions">
                                <button 
                                  @click="copyElementSvg(element.svgCode, `wearable-${activeBreakdownTab}-${wearable.slot}-${elemIdx}`)"
                                  class="copy-element-btn"
                                  :class="{ 'copied': copiedId === `wearable-${activeBreakdownTab}-${wearable.slot}-${elemIdx}` }"
                                  title="Copy SVG Code"
                                >
                                  {{ copiedId === `wearable-${activeBreakdownTab}-${wearable.slot}-${elemIdx}` ? '✓' : '📋' }}
                                </button>
                              </div>
                            </div>
                            <div class="element-preview-section">
                              <div 
                                v-if="element.svgCode"
                                class="element-thumbnail-wrapper"
                                @mouseenter="showPreview = `wearable-${activeBreakdownTab}-${wearable.slot}-${elemIdx}`"
                                @mouseleave="showPreview = null"
                              >
                                <div 
                                  class="element-thumbnail"
                                  v-html="element.svgCode"
                                ></div>
                                <div 
                                  v-if="showPreview === `wearable-${activeBreakdownTab}-${wearable.slot}-${elemIdx}`"
                                  class="element-preview-popup"
                                >
                                  <div 
                                    class="preview-svg" 
                                    v-html="element.svgCode"
                                    :data-preview-id="`wearable-${activeBreakdownTab}-${wearable.slot}-${elemIdx}`"
                                  ></div>
                                </div>
                              </div>
                            </div>
                            <div class="element-details">
                              <div class="element-detail-row">
                                <span class="detail-label">Offset:</span>
                                <span class="detail-value">({{ element.offset.x }}, {{ element.offset.y }})</span>
                              </div>
                              <div class="element-detail-row">
                                <span class="detail-label">Dimension:</span>
                                <span class="detail-value">{{ element.dimension.width }} × {{ element.dimension.height }}</span>
                              </div>
                              <div v-if="element.primaryFill" class="element-detail-row">
                                <span class="detail-label">Primary Fill:</span>
                                <span class="detail-value fill-color">
                                  <span class="color-swatch" :style="{ backgroundColor: element.primaryFill }"></span>
                                  {{ element.primaryFill }}
                                </span>
                              </div>
                              <div v-if="element.secondaryFill" class="element-detail-row">
                                <span class="detail-label">Secondary Fill:</span>
                                <span class="detail-value fill-color">
                                  <span class="color-swatch" :style="{ backgroundColor: element.secondaryFill }"></span>
                                  {{ element.secondaryFill }}
                                </span>
                              </div>
                            </div>
                            <details v-if="element.svgCode" class="element-code-details">
                              <summary class="element-code-summary">Show SVG Code</summary>
                              <pre class="element-code-block"><code>{{ element.svgCode }}</code></pre>
                            </details>
                          </div>
                        </div>
                      </details>
                    </div>
                    <div v-else class="wearable-empty-state">
                      <span>No wearable elements in {{ activeBreakdownTab }} view</span>
                    </div>
                  </div>
                </div>
                
                <!-- Unidentified Wearables (from Other section) -->
                <div 
                  v-for="(wearable, idx) in getBreakdownForView(activeBreakdownTab).wearables.filter(w => w.slot === -1)" 
                  :key="`unidentified-${idx}`"
                  class="category-item unidentified-wearables"
                >
                  <div class="wearable-item">
                    <div class="wearable-header">
                      <span class="wearable-slot">{{ wearable.slotName }}</span>
                      <span class="wearable-class-info">Classes: {{ wearable.className }}</span>
                    </div>
                    <div v-if="wearable.elements.length > 0" class="wearable-details">
                      <div class="wearable-info">
                        <span>Class: {{ wearable.className }}</span>
                        <span>{{ wearable.elements.length }} element{{ wearable.elements.length !== 1 ? 's' : '' }}</span>
                      </div>
                      <details class="wearable-elements">
                        <summary class="wearable-summary">Show elements</summary>
                        <div class="element-list">
                          <div 
                            v-for="(element, elemIdx) in wearable.elements" 
                            :key="elemIdx"
                            class="element-item is-wearable"
                          >
                            <div class="element-header">
                              <div class="element-info">
                                <span class="element-tag">{{ element.tag }}</span>
                                <span v-if="element.attributes.class" class="element-class">{{ element.attributes.class }}</span>
                                <span class="wearable-badge">Wearable</span>
                              </div>
                              <div class="element-actions">
                                <button 
                                  @click="copyElementSvg(element.svgCode, `unidentified-wearable-${activeBreakdownTab}-${idx}-${elemIdx}`)"
                                  class="copy-element-btn"
                                  :class="{ 'copied': copiedId === `unidentified-wearable-${activeBreakdownTab}-${idx}-${elemIdx}` }"
                                  title="Copy SVG Code"
                                >
                                  {{ copiedId === `unidentified-wearable-${activeBreakdownTab}-${idx}-${elemIdx}` ? '✓' : '📋' }}
                                </button>
                              </div>
                            </div>
                            <div class="element-preview-section">
                              <div 
                                v-if="element.svgCode"
                                class="element-thumbnail-wrapper"
                                @mouseenter="showPreview = `unidentified-wearable-${activeBreakdownTab}-${idx}-${elemIdx}`"
                                @mouseleave="showPreview = null"
                              >
                                <div 
                                  class="element-thumbnail"
                                  v-html="element.svgCode"
                                ></div>
                                <div 
                                  v-if="showPreview === `unidentified-wearable-${activeBreakdownTab}-${idx}-${elemIdx}`"
                                  class="element-preview-popup"
                                >
                                  <div 
                                    class="preview-svg" 
                                    v-html="element.svgCode"
                                    :data-preview-id="`unidentified-wearable-${activeBreakdownTab}-${idx}-${elemIdx}`"
                                  ></div>
                                </div>
                              </div>
                            </div>
                            <div class="element-details">
                              <div v-if="element.wearableClasses && element.wearableClasses.length > 0" class="element-detail-row">
                                <span class="detail-label">Wearable Classes:</span>
                                <span class="detail-value wearable-classes">
                                  <span v-for="(wc, wcIdx) in element.wearableClasses" :key="wcIdx" class="wearable-class-tag">{{ wc }}</span>
                                </span>
                              </div>
                              <div class="element-detail-row">
                                <span class="detail-label">Offset:</span>
                                <span class="detail-value">({{ element.offset.x }}, {{ element.offset.y }})</span>
                              </div>
                              <div class="element-detail-row">
                                <span class="detail-label">Dimension:</span>
                                <span class="detail-value">{{ element.dimension.width }} × {{ element.dimension.height }}</span>
                              </div>
                              <div v-if="element.primaryFill" class="element-detail-row">
                                <span class="detail-label">Primary Fill:</span>
                                <span class="detail-value fill-color">
                                  <span class="color-swatch" :style="{ backgroundColor: element.primaryFill }"></span>
                                  {{ element.primaryFill }}
                                </span>
                              </div>
                              <div v-if="element.secondaryFill" class="element-detail-row">
                                <span class="detail-label">Secondary Fill:</span>
                                <span class="detail-value fill-color">
                                  <span class="color-swatch" :style="{ backgroundColor: element.secondaryFill }"></span>
                                  {{ element.secondaryFill }}
                                </span>
                              </div>
                            </div>
                            <details v-if="element.svgCode" class="element-code-details">
                              <summary class="element-code-summary">Show SVG Code</summary>
                              <pre class="element-code-block"><code>{{ element.svgCode }}</code></pre>
                            </details>
                          </div>
                        </div>
                      </details>
                    </div>
                    <div v-else class="wearable-empty-state">
                      <span>No unidentified wearable elements in {{ activeBreakdownTab }} view</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="loading-code">
            <p>Loading {{ activeBreakdownTab }} breakdown...</p>
          </div>
        </div>
      </div>

      <!-- Dressing Room Side Panel -->
      <div v-if="isDressingRoomMode" class="dressing-room-panel">
        <div class="panel-header">
          <h3>Dressing Room</h3>
          <button @click="isDressingRoomMode = false" class="panel-close-btn" title="Close">×</button>
        </div>
        
        <div class="panel-content">
          <!-- Error Message (if preview generation failed) -->
          <div v-if="previewError" class="preview-error-message">
            <div class="error-content">
              <strong>⚠️ Preview Error:</strong>
              <p>{{ previewError }}</p>
              <div class="error-actions">
                <button 
                  v-if="invalidWearableSlots.length > 0" 
                  @click="removeInvalidWearables()" 
                  class="error-action-btn error-action-remove"
                >
                  Remove Invalid ({{ invalidWearableSlots.length }})
                </button>
                <button @click="resetToOriginal(); previewError = null" class="error-action-btn">
                  Reset to Original
                </button>
                <button @click="previewError = null" class="error-close-btn">×</button>
              </div>
            </div>
          </div>
          
          <!-- Slot Tabs -->
          <div class="slot-tabs">
            <button
              v-for="slot in wearableSlots"
              :key="slot.slot"
              @click="selectedWearableSlot = slot.slot"
              class="slot-tab"
              :class="{ active: selectedWearableSlot === slot.slot }"
            >
              {{ slot.name }}
            </button>
          </div>

          <!-- Selected Wearables Summary -->
          <div class="selected-wearables-summary">
            <h4>Equipped Wearables</h4>
            <div class="equipped-list">
              <div
                v-for="slot in wearableSlots"
                :key="slot.slot"
                class="equipped-item"
                :class="{ 'has-wearable': previewWearables[slot.slot] !== 0 }"
              >
                <span class="slot-name">{{ slot.name }}:</span>
                <span class="wearable-id">{{ previewWearables[slot.slot] || 'None' }}</span>
                <button
                  v-if="previewWearables[slot.slot] !== 0"
                  @click="removeWearable(slot.slot)"
                  class="remove-btn"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            </div>
            <button @click="resetToOriginal" class="reset-btn">Reset to Original</button>
          </div>

          <!-- Wearable Browser -->
          <div class="wearable-browser">
            <div class="browser-header">
              <h4>{{ getSlotName(selectedWearableSlot) }} Wearables</h4>
              <div v-if="isLoadingWearables" class="loading-spinner-small"></div>
            </div>
            
            <div v-if="isLoadingWearables" class="loading-wearables">
              <p>Loading wearables...</p>
            </div>
            
            <div v-else-if="wearablesError" class="error-wearables">
              <p>Error loading wearables: {{ wearablesError }}</p>
              <p class="fallback-note">Using ID-only mode. Enter wearable ID manually.</p>
            </div>
            
            <div v-else class="wearable-list">
              <!-- Search/Filter -->
              <input
                v-model="wearableSearch"
                type="text"
                placeholder="Search by ID or name..."
                class="wearable-search"
              />
              
              <!-- Debug Info (always show for debugging) -->
              <div class="text-xs text-gray-400 mb-2 p-2 bg-gray-100 rounded border border-gray-300">
                <strong>Debug Info:</strong><br>
                filteredWearables.length = {{ filteredWearables.length }}<br>
                selectedSlot = {{ selectedWearableSlot }}<br>
                allWearablesCount = {{ wearables?.length || 0 }}<br>
                isDressingRoomMode = {{ isDressingRoomMode }}
              </div>
              
              <!-- Wearable Grid -->
              <div v-if="filteredWearables.length === 0" class="empty-wearables">
                <p>No wearables found for {{ getSlotName(selectedWearableSlot) }} slot.</p>
                <p class="text-sm text-gray-500">Total wearables: {{ wearables?.value?.length || wearables?.length || 0 }}</p>
                <p class="text-sm text-gray-500">Selected slot: {{ selectedWearableSlot }}</p>
                <p class="text-sm text-gray-500">Filtered count: {{ filteredWearables.length }}</p>
              </div>
              <div 
                v-else 
                ref="wearableGridRef"
                class="wearable-grid"
                @scroll="handleWearableGridScroll"
              >
                <div
                  v-for="(wearable, index) in filteredWearables"
                  :key="`wearable-${wearable.id}-${index}`"
                  @click="selectWearable(wearable.id)"
                  class="wearable-item"
                  :class="{ 
                    'selected': previewWearables[selectedWearableSlot] === wearable.id,
                    'equipped': gotchiData?.equippedWearables?.[selectedWearableSlot] === wearable.id
                  }"
                  :title="wearable.name || `Wearable #${wearable.id}`"
                >
                  <div class="wearable-thumbnail">
                    <span v-if="wearable.thumbnail" class="thumbnail-img" v-html="wearable.thumbnail"></span>
                    <span v-else class="thumbnail-placeholder">#{{ wearable.id }}</span>
                  </div>
                  <div class="wearable-info">
                    <span class="wearable-name">{{ wearable.name || `Wearable #${wearable.id}` }}</span>
                    <span class="wearable-id-label">ID: {{ wearable.id }}</span>
                  </div>
                </div>
                <!-- Loading indicator for infinite scroll -->
                <div v-if="isLoadingMoreWearables && hasMoreWearables" class="loading-more-wearables">
                  <div class="loading-spinner-small"></div>
                  <p>Loading more wearables...</p>
                </div>
              </div>
              
              <!-- Manual ID Input (Fallback) -->
              <div class="manual-wearable-input">
                <label>Or enter wearable ID:</label>
                <div class="input-group">
                  <input
                    v-model.number="manualWearableId"
                    type="number"
                    placeholder="Wearable ID"
                    class="wearable-id-input"
                    min="0"
                  />
                  <button @click="applyManualWearable" class="apply-btn">Apply</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SVG Metadata Section -->
      <div class="metadata-section" v-if="svgMetadata">
        <h2 class="section-title">SVG Metadata</h2>
        
        <div class="metadata-content">
          <div class="canvas-info">
            <h3 class="metadata-subtitle">Canvas Size</h3>
            <div class="info-row">
              <span>Width:</span>
              <span class="info-value">{{ svgMetadata.canvasSize.width }}px</span>
            </div>
            <div class="info-row">
              <span>Height:</span>
              <span class="info-value">{{ svgMetadata.canvasSize.height }}px</span>
            </div>
          </div>

          <div class="parts-info" v-if="svgMetadata.parts && svgMetadata.parts.length > 0">
            <h3 class="metadata-subtitle">Parts ({{ svgMetadata.parts.length }})</h3>
            <div class="parts-list">
              <div 
                v-for="(part, index) in svgMetadata.parts.slice(0, 20)" 
                :key="index"
                class="part-item"
              >
                <div class="part-header">
                  <span class="part-tag">{{ part.tag }}</span>
                  <span class="part-id" v-if="part.id">{{ part.id }}</span>
                </div>
                <div class="part-details">
                  <div class="detail-row">
                    <span>Position:</span>
                    <span>({{ part.x }}, {{ part.y }})</span>
                  </div>
                  <div class="detail-row" v-if="part.width > 0 || part.height > 0">
                    <span>Size:</span>
                    <span>{{ part.width }} × {{ part.height }}</span>
                  </div>
                  <div class="detail-row" v-if="part.transform">
                    <span>Transform:</span>
                    <span class="transform-text">{{ part.transform }}</span>
                  </div>
                </div>
              </div>
              <div v-if="svgMetadata.parts.length > 20" class="parts-truncated">
                ... and {{ svgMetadata.parts.length - 20 }} more parts
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import SVGViewer from './SVGViewer.vue'
import { useAavegotchi } from '../composables/useAavegotchi.js'
import { useWearables } from '../composables/useWearables.js'
import { parseSVG } from '../utils/svgParser.js'
import { getContract } from '../utils/contract.js'

const props = defineProps({
  gotchiId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['close'])

const { gotchiDataMap, svgDataMap } = useAavegotchi()

const gotchiData = ref(null)
// useWearables now fetches individual wearable SVGs directly using getSvg
const wearablesComposable = useWearables()
const { isLoadingWearables, wearablesError, getWearablesBySlot, wearableSvgsMap, loadMoreWearables, hasMoreWearables } = wearablesComposable
const wearables = wearablesComposable.wearables // Keep reactivity by not destructuring
const svgViews = ref(null)
const svgMetadata = ref(null)
const isLoading = ref(true)
const error = ref(null)
const copiedId = ref(null)
const styleElement = ref(null)

// Side views state
const sideViews = ref({})
const isLoadingSideViews = ref(false)
const currentViewIndex = ref(0)
const availableViews = ref(['Front'])
const activeTab = ref('Front')
const svgMetadataByView = ref({})
const activeBreakdownTab = ref('Front')
const breakdownByView = ref({})
const showPreview = ref(null)

// Dressing Room Mode State
const isDressingRoomMode = ref(false)
const previewWearables = ref(new Array(16).fill(0))
const previewSvgs = ref({})
const selectedWearableSlot = ref(0)
const isLoadingPreview = ref(false)
const previewError = ref(null) // Store preview generation errors
const invalidWearableSlots = ref([]) // Store slots with invalid wearable IDs
const wearableSearch = ref('')
const manualWearableId = ref(null)
const wearableGridRef = ref(null)
const isLoadingMoreWearables = ref(false)
let scrollTimeout = null
const savedScrollPosition = ref(null)
const previousScrollHeight = ref(0)

// Wearable slots mapping
const wearableSlots = [
  { slot: 0, name: 'Body' },
  { slot: 1, name: 'Face' },
  { slot: 2, name: 'Eyes' },
  { slot: 3, name: 'Head' },
  { slot: 4, name: 'Left Hand' },
  { slot: 5, name: 'Right Hand' },
  { slot: 6, name: 'Pet' },
  { slot: 7, name: 'Background' }
]

// Get filtered wearables for current slot
const filteredWearables = computed(() => {
  const slot = selectedWearableSlot.value
  // Access wearables.value directly - this ensures Vue tracks the dependency
  const allWearables = wearables.value || []
  
  console.log('[filteredWearables] Computed running:', {
    slot,
    allWearablesCount: allWearables.length,
    isArray: Array.isArray(allWearables),
    searchTerm: wearableSearch.value
  })
  
  if (!Array.isArray(allWearables)) {
    console.warn('[filteredWearables] wearables.value is not an array, returning empty')
    return []
  }
  
  // Filter by slot - only include wearables with valid slot data
  let slotWearables = allWearables.filter(w => {
    if (!w) return false
    // If slot is null or undefined, exclude it (no valid slot data)
    if (w.slot === null || w.slot === undefined) return false
    if (typeof w.slot !== 'number') return false
    if (slot === undefined || slot === null) return true
    return w.slot === slot
  })
  
  console.log('[filteredWearables] After slot filter:', slotWearables.length, 'items for slot', slot)
  
  // Apply search filter
  if (wearableSearch.value) {
    const search = wearableSearch.value.toLowerCase()
    slotWearables = slotWearables.filter(w => {
      return w.id.toString().includes(search) || 
             (w.name && w.name.toLowerCase().includes(search))
    })
    console.log('[filteredWearables] After search filter:', slotWearables.length, 'items')
  }
  
  // Return all filtered wearables (pagination handled by useWearables)
  console.log('[filteredWearables] Final result:', slotWearables.length, 'items. First 3:', slotWearables.slice(0, 3).map(w => `#${w.id}(slot${w.slot})`).join(', '))
  return slotWearables
})

// Helper function to get slot name
function getSlotName(slot) {
  const slotInfo = wearableSlots.find(s => s.slot === slot)
  return slotInfo ? slotInfo.name : 'Unknown'
}

// Debug: Watch wearables to ensure they're populated
watch(wearables, (newWearables) => {
  console.log('Wearables changed:', newWearables?.length || 0, 'items')
  if (newWearables && newWearables.length > 0) {
    console.log('Sample wearable:', newWearables[0])
  }
}, { immediate: true })

// Watch filteredWearables and verify DOM rendering (only when dressing room is open)
watch([filteredWearables, isDressingRoomMode], async ([newFiltered, isOpen]) => {
  console.log('filteredWearables changed:', newFiltered?.length || 0, 'items', 'isOpen:', isOpen)
  if (newFiltered && newFiltered.length > 0 && isOpen) {
    await nextTick()
    
    // Restore scroll position if we saved one (when loading more items)
    if (savedScrollPosition.value !== null && wearableGridRef.value) {
      const gridElement = wearableGridRef.value
      // Wait for DOM to update with new items and queries to complete
      await nextTick()
      // Use requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        setTimeout(() => {
          // Restore the scroll position (it should remain the same since we're appending items below)
          if (gridElement && savedScrollPosition.value !== null) {
            gridElement.scrollTop = savedScrollPosition.value
            // Clear saved position
            savedScrollPosition.value = null
            previousScrollHeight.value = 0
          }
        }, 150) // Slightly longer delay to ensure all queries have rendered
      })
    }
    
    // Wait a bit more for panel to fully render
    setTimeout(() => {
      const gridElement = document.querySelector('.wearable-grid')
      if (gridElement) {
        const itemElements = gridElement.querySelectorAll('.wearable-item')
        console.log('DOM check - Grid found:', !!gridElement)
        console.log('DOM check - Items in DOM:', itemElements.length, 'Expected:', newFiltered.length)
        if (itemElements.length !== newFiltered.length) {
          console.warn('⚠️ Mismatch: Expected', newFiltered.length, 'items but found', itemElements.length, 'in DOM')
        } else {
          console.log('✅ All items rendered correctly in DOM')
        }
      } else {
        console.warn('⚠️ Grid element not found in DOM (panel may not be open yet)')
      }
    }, 100)
  }
}, { immediate: true })

// Initialize preview wearables when gotchi data changes
watch(() => gotchiData.value, (data) => {
  if (data && data.equippedWearables) {
    // Initialize previewWearables with current equipped wearables
    previewWearables.value = [...data.equippedWearables]
  }
}, { immediate: true })

// Watch for preview wearables changes and generate preview SVGs
let previewTimeout = null
watch([previewWearables, isDressingRoomMode], async ([wearables, isActive]) => {
  if (!isActive || !gotchiData.value) {
    // Clear preview SVGs when exiting dressing room mode
    if (!isActive) {
      previewSvgs.value = {}
      previewError.value = null // Clear error when exiting
      invalidWearableSlots.value = [] // Clear invalid slots
    }
    return
  }
  
  // Debounce preview generation to avoid too many contract calls
  if (previewTimeout) {
    clearTimeout(previewTimeout)
  }
  previewTimeout = setTimeout(async () => {
    await generatePreviewSvgs()
  }, 300)
}, { deep: true })

// Generate initial preview when entering dressing room mode
watch(isDressingRoomMode, async (isActive) => {
  if (isActive && gotchiData.value && (!previewSvgs.value || Object.keys(previewSvgs.value).length === 0)) {
    // Generate initial preview immediately
    await generatePreviewSvgs()
  }
})

const currentSvgView = computed(() => {
  // If in dressing room mode, use preview SVGs
  if (isDressingRoomMode.value && previewSvgs.value) {
    const viewName = availableViews.value[currentViewIndex.value] || 'Front'
    const previewSvg = previewSvgs.value[viewName]
    if (previewSvg) {
      return previewSvg
    }
  }
  
  // Otherwise use normal SVGs
  const viewName = availableViews.value[currentViewIndex.value] || 'Front'
  console.log('currentSvgView computed:', {
    viewName,
    currentViewIndex: currentViewIndex.value,
    hasSvgViews: !!svgViews.value,
    svgViewsLength: svgViews.value?.length,
    sideViews: Object.keys(sideViews.value),
    requestedSideView: sideViews.value[viewName] ? 'found' : 'not found'
  })
  
  if (viewName === 'Front') {
    const frontView = svgViews.value
    console.log('Returning front view:', frontView ? `${frontView.substring(0, 50)}...` : 'null')
    return frontView
  }
  const sideView = sideViews.value[viewName]
  if (sideView) {
    console.log(`Returning ${viewName} view:`, sideView ? `${sideView.substring(0, 50)}...` : 'null')
    return sideView
  }
  // Fallback to front view if side view not available
  console.log('Falling back to front view')
  return svgViews.value
})

const currentViewName = computed(() => {
  return availableViews.value[currentViewIndex.value] || 'Front'
})

// Watch for gotchi data from the map
watch(() => gotchiDataMap.value[props.gotchiId], async (newData) => {
  if (newData) {
    gotchiData.value = newData
    isLoading.value = false
    
    // Fetch side views when gotchi data is available
    await fetchSideViews()
  }
}, { immediate: true })

// Fetch side views for the gotchi
async function fetchSideViews() {
  if (!gotchiData.value) return
  
  isLoadingSideViews.value = true
  try {
    const contract = getContract()
    const tokenId = gotchiData.value.tokenId
    
    const newViews = ['Front']
    const newSideViews = {}
    
    // Try to fetch side views using getAavegotchiSideSvgs (returns [front, left, right, back])
    try {
      console.log('Attempting to fetch side views using getAavegotchiSideSvgs for token:', tokenId)
      const sidesResponse = await contract.getAavegotchiSideSvgs(tokenId)
      
      let sidesArray = []
      // Ethers might return a Proxy object that looks like an array
      // Check if it has numeric indices and length property
      if (sidesResponse && typeof sidesResponse === 'object') {
        if (typeof sidesResponse.length === 'number' && sidesResponse.length > 0) {
          // It's an array-like object (could be a real array or Proxy)
          // Convert to real array by accessing all indices
          sidesArray = []
          for (let i = 0; i < sidesResponse.length; i++) {
            if (sidesResponse[i] !== undefined) {
              sidesArray.push(sidesResponse[i])
            }
          }
        } else if (sidesResponse.ag_) {
          // Try to extract from ag_ property
          const agValue = sidesResponse.ag_
          if (Array.isArray(agValue)) {
            sidesArray = agValue
          } else if (typeof agValue === 'string') {
            sidesArray = [agValue]
          } else if (agValue && typeof agValue.length === 'number') {
            // Proxy array in ag_
            sidesArray = []
            for (let i = 0; i < agValue.length; i++) {
              if (agValue[i] !== undefined) {
                sidesArray.push(agValue[i])
              }
            }
          }
        } else if (Array.isArray(sidesResponse)) {
          // Real array
          sidesArray = sidesResponse
        }
      }
      
      console.log('Side views from getAavegotchiSideSvgs:', sidesArray)
      
      // Parse side views array - format: [front, left, right, back]
      if (sidesArray && sidesArray.length >= 4) {
        // [0] = front (already have this from svgViews), [1] = left, [2] = right, [3] = back
        newSideViews['Left'] = sidesArray[1]
        newSideViews['Right'] = sidesArray[2]
        newSideViews['Back'] = sidesArray[3]
        newViews.push('Left', 'Right', 'Back')
      } else if (sidesArray && sidesArray.length > 0) {
        // Handle partial arrays
        if (sidesArray.length >= 2) {
          newSideViews['Left'] = sidesArray[1]
          newViews.push('Left')
        }
        if (sidesArray.length >= 3) {
          newSideViews['Right'] = sidesArray[2]
          newViews.push('Right')
        }
        if (sidesArray.length >= 4) {
          newSideViews['Back'] = sidesArray[3]
          newViews.push('Back')
        }
      }
    } catch (getSidesError) {
      console.warn('getAavegotchiSideSvgs not available:', getSidesError.message)
      // Note: previewSideAavegotchi is only used in dressing room mode for previews
      // It should not be used as a fallback here as it may fail with invalid wearable IDs
    }
    
    sideViews.value = newSideViews
    availableViews.value = newViews
    currentViewIndex.value = 0 // Reset to front view
    
    // Ensure activeTab is valid
    if (!newViews.includes(activeTab.value)) {
      activeTab.value = newViews[0] || 'Front'
    }
    
    // Ensure activeBreakdownTab is valid
    if (!newViews.includes(activeBreakdownTab.value)) {
      activeBreakdownTab.value = newViews[0] || 'Front'
    }
    
    // Parse metadata for all available views
    await parseAllViewsMetadata()
    
    console.log('Side views loaded:', {
      views: newViews,
      sideViews: Object.keys(newSideViews)
    })
    
  } catch (err) {
    console.error('Error fetching side views:', err)
    // Don't set error - just log it, we can still show front view
  } finally {
    isLoadingSideViews.value = false
  }
}

// Parse SVG metadata for all views
async function parseAllViewsMetadata() {
  const metadata = {}
  
  // Parse front view
  if (svgViews.value) {
    try {
      metadata['Front'] = parseSVG(svgViews.value)
    } catch (err) {
      console.error('Error parsing Front view metadata:', err)
    }
  }
  
  // Parse side views
  for (const [viewName, svgString] of Object.entries(sideViews.value)) {
    if (svgString) {
      try {
        metadata[viewName] = parseSVG(svgString)
      } catch (err) {
        console.error(`Error parsing ${viewName} view metadata:`, err)
      }
    }
  }
  
  svgMetadataByView.value = metadata
  console.log('Parsed metadata for all views:', Object.keys(metadata))
  
  // Parse breakdown for all views
  await parseAllViewsBreakdown()
}

// Parse parts and wearables breakdown for all views
async function parseAllViewsBreakdown() {
  if (!gotchiData.value) return
  
  const breakdown = {}
  const equippedWearables = gotchiData.value.equippedWearables || []
  
  // Parse front view
  if (svgViews.value) {
    try {
      breakdown['Front'] = parsePartsAndWearables(svgViews.value, equippedWearables)
    } catch (err) {
      console.error('Error parsing Front view breakdown:', err)
    }
  }
  
  // Parse side views
  for (const [viewName, svgString] of Object.entries(sideViews.value)) {
    if (svgString) {
      try {
        breakdown[viewName] = parsePartsAndWearables(svgString, equippedWearables)
      } catch (err) {
        console.error(`Error parsing ${viewName} view breakdown:`, err)
      }
    }
  }
  
  breakdownByView.value = breakdown
  console.log('Parsed breakdown for all views:', Object.keys(breakdown))
}

// Helper function to extract SVG string for an element
function extractElementSvg(element, viewBox = '0 0 64 64') {
  if (!element) return ''
  
  // Clone the element to avoid modifying the original
  const clone = element.cloneNode(true)
  
  // Create a wrapper SVG with viewBox
  const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  wrapper.setAttribute('viewBox', viewBox)
  wrapper.appendChild(clone)
  
  // Get outerHTML or serialize
  const serializer = new XMLSerializer()
  return serializer.serializeToString(wrapper)
}

// Parse parts and wearables from SVG
function parsePartsAndWearables(svgString, equippedWearables) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.documentElement
  
  // Get viewBox from original SVG
  const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
  
  // Define wearable slot mapping
  const wearableSlotMap = {
    0: { name: 'Body', className: 'wearable-body' },
    1: { name: 'Face', className: 'wearable-face' },
    2: { name: 'Eyes', className: 'wearable-eyes' },
    3: { name: 'Head', className: 'wearable-head' },
    4: { name: 'Left Hand', className: 'wearable-hand wearable-hand-left' },
    5: { name: 'Right Hand', className: 'wearable-hand wearable-hand-right' },
    6: { name: 'Pet', className: 'wearable-pet' },
    7: { name: 'Background', className: 'wearable-bg' }
  }
  
  // Gotchi parts categories
  const partsCategories = {
    'Background': ['gotchi-bg'],
    'Body': ['gotchi-body', 'gotchi-body-'],
    'Collateral': ['gotchi-collateral'],
    'Eyes': ['gotchi-eyeColor', 'gotchi-eyes', 'gotchi-eye'],
    'Mouth': ['gotchi-primary-mouth', 'gotchi-mouth'],
    'Hands': ['gotchi-handsDownClosed', 'gotchi-handsDownOpen', 'gotchi-handsUp', 'gotchi-hands', 'gotchi-hand'],
    'Shadow': ['gotchi-shadow'],
    'Other': []
  }
  
  // Always show these categories even if empty (all main gotchi parts)
  const alwaysShowCategories = ['Background', 'Body', 'Collateral', 'Eyes', 'Mouth', 'Hands', 'Shadow']
  
  // Initialize category structures
  const parts = {}
  Object.keys(partsCategories).forEach(cat => {
    parts[cat] = { elements: [] }
  })
  
  // Initialize wearables structure
  const wearables = Object.entries(wearableSlotMap).map(([slot, info]) => ({
    slot: parseInt(slot),
    slotName: info.name,
    className: info.className,
    wearableId: equippedWearables[parseInt(slot)] || 0,
    elements: []
  }))
  
  // Extract elements
  function extractElements(element, parentTransform = '') {
    const tagName = element.tagName?.toLowerCase()
    if (!tagName) return
    
    const transform = element.getAttribute('transform') || ''
    const combinedTransform = parentTransform ? `${parentTransform} ${transform}`.trim() : transform
    const classes = element.getAttribute('class') || ''
    const classList = classes.split(' ').filter(c => c.trim())
    
    // Extract offset from attributes or transform
    let offsetX = parseFloat(element.getAttribute('x') || '0')
    let offsetY = parseFloat(element.getAttribute('y') || '0')
    
    // Extract translate from transform (can have multiple translates)
    if (combinedTransform) {
      const translateMatches = [...combinedTransform.matchAll(/translate\(([\d.-]+)(?:[,\s]+([\d.-]+))?\)/g)]
      if (translateMatches.length > 0) {
        // Sum all translate values
        let totalX = 0
        let totalY = 0
        translateMatches.forEach(match => {
          totalX += parseFloat(match[1]) || 0
          totalY += parseFloat(match[2] || match[1]) || 0
        })
        if (offsetX === 0) offsetX = totalX
        if (offsetY === 0) offsetY = totalY
      }
    }
    
    // Get explicit dimensions
    let computedWidth = parseFloat(element.getAttribute('width') || '0')
    let computedHeight = parseFloat(element.getAttribute('height') || '0')
    
    // Try to calculate bounding box by temporarily rendering the element
    // getBBox() only works for rendered elements
    if ((!computedWidth || !computedHeight || computedWidth === 0 || computedHeight === 0) && 
        (tagName === 'g' || tagName === 'path' || tagName === 'circle' || tagName === 'ellipse')) {
      try {
        // Create a temporary SVG container in the document
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        tempSvg.setAttribute('viewBox', viewBox)
        tempSvg.setAttribute('width', '100')
        tempSvg.setAttribute('height', '100')
        tempSvg.style.position = 'absolute'
        tempSvg.style.top = '-9999px'
        tempSvg.style.left = '-9999px'
        tempSvg.style.visibility = 'hidden'
        document.body.appendChild(tempSvg)
        
        // Clone the element and append it
        const clone = element.cloneNode(true)
        tempSvg.appendChild(clone)
        
        // Try to get bounding box
        try {
          const bbox = clone.getBBox()
          if (bbox && bbox.width > 0 && bbox.height > 0) {
            if (!computedWidth || computedWidth === 0) computedWidth = bbox.width
            if (!computedHeight || computedHeight === 0) computedHeight = bbox.height
          }
          // Use bbox position if we don't have offset yet
          if ((offsetX === 0 && offsetY === 0) || (bbox.x !== 0 || bbox.y !== 0)) {
            if (offsetX === 0) offsetX = bbox.x
            if (offsetY === 0) offsetY = bbox.y
          }
        } catch (e) {
          // getBBox failed, element might not be renderable
        }
        
        // Clean up
        document.body.removeChild(tempSvg)
      } catch (e) {
        // Couldn't create temp SVG, continue with other methods
      }
    }
    
    // Extract SVG code for this element
    let elementSvg = ''
    try {
      elementSvg = extractElementSvg(element, viewBox)
    } catch (err) {
      console.warn('Error extracting SVG for element:', err)
    }
    
    // Extract fill colors (primary and secondary)
    const fill = element.getAttribute('fill') || ''
    const stroke = element.getAttribute('stroke') || ''
    
    // Try to get computed fill from style attribute or inline styles
    const styleAttr = element.getAttribute('style') || ''
    let primaryFill = fill
    let secondaryFill = stroke
    
    // Extract fill from style attribute if present
    const fillMatch = styleAttr.match(/fill:\s*([^;]+)/i)
    if (fillMatch && !primaryFill) {
      primaryFill = fillMatch[1].trim()
    }
    
    // If no explicit fill, check for 'currentColor' or 'none'
    if (!primaryFill || primaryFill === 'none' || primaryFill === 'currentColor') {
      primaryFill = null
    }
    
    // Extract stroke from style attribute if present
    const strokeMatch = styleAttr.match(/stroke:\s*([^;]+)/i)
    if (strokeMatch && !secondaryFill) {
      secondaryFill = strokeMatch[1].trim()
    }
    
    if (!secondaryFill || secondaryFill === 'none' || secondaryFill === 'currentColor') {
      secondaryFill = null
    }
    
    // Calculate bounding box dimensions from various sources
    // For paths, extract from path data
    if (tagName === 'path' && !computedWidth && !computedHeight) {
      const pathData = element.getAttribute('d') || ''
      if (pathData) {
        // Better path parsing - handle all path commands
        const allCoords = []
        const pathCommands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][\s\d.,-]*/g) || []
        
        pathCommands.forEach(cmd => {
          const command = cmd[0]
          const numbers = cmd.substring(1).match(/[\d.-]+/g) || []
          const coords = numbers.map(Number).filter(n => !isNaN(n))
          
          if (command === 'M' || command === 'm' || command === 'L' || command === 'l') {
            // Move/Line - take x,y pairs
            for (let i = 0; i < coords.length; i += 2) {
              if (i < coords.length) allCoords.push({ x: coords[i], y: coords[i + 1] || 0 })
            }
          } else if (command === 'H' || command === 'h') {
            // Horizontal line - only x
            coords.forEach(x => allCoords.push({ x, y: 0 }))
          } else if (command === 'V' || command === 'v') {
            // Vertical line - only y
            coords.forEach(y => allCoords.push({ x: 0, y }))
          } else if (command === 'C' || command === 'c') {
            // Cubic bezier - take last point (x,y)
            for (let i = 4; i < coords.length; i += 6) {
              if (i < coords.length) allCoords.push({ x: coords[i], y: coords[i + 1] || 0 })
            }
          } else if (command === 'Q' || command === 'q') {
            // Quadratic bezier - take last point
            for (let i = 2; i < coords.length; i += 4) {
              if (i < coords.length) allCoords.push({ x: coords[i], y: coords[i + 1] || 0 })
            }
          } else if (command === 'A' || command === 'a') {
            // Arc - take last point
            for (let i = 5; i < coords.length; i += 7) {
              if (i < coords.length) allCoords.push({ x: coords[i], y: coords[i + 1] || 0 })
            }
          }
        })
        
        if (allCoords.length > 0) {
          const xValues = allCoords.map(c => c.x).filter(x => !isNaN(x))
          const yValues = allCoords.map(c => c.y).filter(y => !isNaN(y))
          if (xValues.length > 0 && yValues.length > 0) {
            const minX = Math.min(...xValues)
            const maxX = Math.max(...xValues)
            const minY = Math.min(...yValues)
            const maxY = Math.max(...yValues)
            computedWidth = Math.abs(maxX - minX) || 0
            computedHeight = Math.abs(maxY - minY) || 0
          }
        }
      }
    }
    
    // For rect elements, get from attributes
    if (tagName === 'rect') {
      if (!computedWidth) computedWidth = parseFloat(element.getAttribute('width') || '0')
      if (!computedHeight) computedHeight = parseFloat(element.getAttribute('height') || '0')
    }
    
    // For circle elements, calculate from radius
    if (tagName === 'circle') {
      const r = parseFloat(element.getAttribute('r') || '0')
      if (r > 0) {
        computedWidth = r * 2
        computedHeight = r * 2
      }
    }
    
    // For ellipse elements, calculate from rx and ry
    if (tagName === 'ellipse') {
      const rx = parseFloat(element.getAttribute('rx') || '0')
      const ry = parseFloat(element.getAttribute('ry') || '0')
      if (rx > 0) computedWidth = rx * 2
      if (ry > 0) computedHeight = ry * 2
    }
    
    // Try to get dimensions from viewBox if element is an SVG
    if (tagName === 'svg') {
      const vb = element.getAttribute('viewBox')
      if (vb) {
        const vbParts = vb.split(/\s+/).map(Number).filter(n => !isNaN(n))
        if (vbParts.length >= 4) {
          computedWidth = vbParts[2] || computedWidth
          computedHeight = vbParts[3] || computedHeight
        }
      }
      if (!computedWidth) computedWidth = parseFloat(element.getAttribute('width') || '0')
      if (!computedHeight) computedHeight = parseFloat(element.getAttribute('height') || '0')
    }
    
    // For groups, try to estimate from transform scale
    if (tagName === 'g' && !computedWidth && !computedHeight && combinedTransform) {
      const scaleMatch = combinedTransform.match(/scale\(([\d.-]+)(?:[,\s]+([\d.-]+))?\)/)
      if (scaleMatch) {
        // Scale alone doesn't give us dimensions, but we can try to estimate
        // This is a limitation - we'd need to measure children
      }
    }
    
    // Round to reasonable precision
    offsetX = Math.round(offsetX * 100) / 100
    offsetY = Math.round(offsetY * 100) / 100
    computedWidth = Math.round(computedWidth * 100) / 100
    computedHeight = Math.round(computedHeight * 100) / 100
    
    const elementData = {
      tag: tagName,
      id: element.getAttribute('id') || '',
      x: offsetX,
      y: offsetY,
      width: computedWidth,
      height: computedHeight,
      offset: { x: offsetX, y: offsetY },
      dimension: { width: computedWidth, height: computedHeight },
      primaryFill: primaryFill,
      secondaryFill: secondaryFill,
      transform: combinedTransform || null,
      svgCode: elementSvg,
      attributes: {
        fill: fill,
        stroke: stroke,
        opacity: element.getAttribute('opacity'),
        class: classes
      }
    }
    
    // Check if it's a gotchi part
    let categorized = false
    for (const [categoryName, categoryClasses] of Object.entries(partsCategories)) {
      // Check if any class matches exactly or starts with the category class
      if (categoryClasses.some(cls => {
        return classList.some(classItem => {
          // Normalize class names for comparison
          const normalizedClass = classItem.toLowerCase().trim()
          const normalizedMatch = cls.toLowerCase().trim()
          
          // Exact match
          if (normalizedClass === normalizedMatch) return true
          
          // Starts with match (for classes like gotchi-body-something, gotchi-bodyColor, etc.)
          if (normalizedClass.startsWith(normalizedMatch)) return true
          
          // For body: check if class contains 'gotchi-body' (case-insensitive)
          if (normalizedMatch === 'gotchi-body' && normalizedClass.includes('gotchi-body')) return true
          if (normalizedMatch === 'gotchi-body-' && normalizedClass.includes('gotchi-body')) return true
          
          // For hands: check if class contains 'gotchi-hand' or 'gotchi-hands' (case-insensitive)
          if (normalizedMatch.includes('hand') && (normalizedClass.includes('gotchi-hand') || normalizedClass.includes('gotchi-hands'))) return true
          
          // Additional checks for hands variations
          if (categoryName === 'Hands') {
            if (normalizedClass.includes('hand') && normalizedClass.includes('gotchi')) return true
          }
          
          // Additional checks for body variations
          if (categoryName === 'Body') {
            if (normalizedClass.includes('body') && normalizedClass.includes('gotchi')) return true
          }
          
          // Additional checks for mouth variations
          if (categoryName === 'Mouth') {
            if (normalizedClass.includes('mouth') && normalizedClass.includes('gotchi')) return true
          }
          
          // Additional checks for eyes variations
          if (categoryName === 'Eyes') {
            if ((normalizedClass.includes('eye') || normalizedClass.includes('eyes')) && normalizedClass.includes('gotchi')) return true
          }
          
          return false
        })
      })) {
        parts[categoryName].elements.push(elementData)
        categorized = true
        break
      }
    }
    
    // Check if it's a wearable (before adding to Other)
    let isWearable = false
    for (const wearable of wearables) {
      const wearableClasses = wearable.className.split(' ')
      if (wearableClasses.some(cls => classList.includes(cls))) {
        wearable.elements.push(elementData)
        isWearable = true
        break
      }
    }
    
    // Also check for any wearable- classes that might not match standard slots
    if (!isWearable && classList.some(c => c.startsWith('wearable-'))) {
      isWearable = true
      // Add to wearables with a generic "Unidentified" slot
      let unidentifiedWearable = wearables.find(w => w.slot === -1)
      if (!unidentifiedWearable) {
        unidentifiedWearable = {
          slot: -1,
          slotName: 'Unidentified Wearables',
          className: 'wearable-*',
          wearableId: 0,
          elements: []
        }
        wearables.push(unidentifiedWearable)
      }
      unidentifiedWearable.elements.push(elementData)
      // Mark the element with wearable info
      elementData.isWearable = true
      elementData.wearableClasses = classList.filter(c => c.startsWith('wearable-'))
      categorized = true // Don't add to Other if it's a wearable
    }
    
    // If not in specific categories but has gotchi- class, add to Other
    // But skip if it's already been categorized as a wearable
    if (!categorized && classList.some(c => c.startsWith('gotchi-'))) {
      parts['Other'].elements.push(elementData)
      categorized = true
    }
    
    // Recursively process children
    Array.from(element.children || []).forEach(child => {
      extractElements(child, combinedTransform)
    })
  }
  
  // Start extraction from root
  Array.from(svgElement.children || []).forEach(child => {
    extractElements(child)
  })
  
  // Keep all important categories, even if empty (so Body, Hands, Mouth, Eyes always show)
  // But filter out truly empty ones if they're not important categories
  const filteredParts = {}
  Object.entries(parts).forEach(([name, data]) => {
    // Always include important categories even if empty, or if they have elements
    if (alwaysShowCategories.includes(name) || data.elements.length > 0) {
      filteredParts[name] = data
    }
  })
  
  return {
    parts: filteredParts,
    wearables: wearables.filter(w => w.elements.length > 0 || w.wearableId !== 0)
  }
}

// Get breakdown for a specific view
function getBreakdownForView(viewName) {
  return breakdownByView.value[viewName] || null
}

// Navigation functions
function nextView() {
  if (currentViewIndex.value < availableViews.value.length - 1) {
    currentViewIndex.value++
    // Apply styles for new view
    if (currentSvgView.value) {
      nextTick(() => {
        applySvgStyles(currentSvgView.value)
      })
    }
  }
}

function previousView() {
  if (currentViewIndex.value > 0) {
    currentViewIndex.value--
    // Apply styles for new view
    if (currentSvgView.value) {
      nextTick(() => {
        applySvgStyles(currentSvgView.value)
      })
    }
  }
}

// Extract and apply SVG styles (same logic as AavegotchiCard)
function applySvgStyles(svgString) {
  if (!svgString) return

  // Extract style content from SVG
  const styleMatch = svgString.match(/<style>(.*?)<\/style>/s)
  if (!styleMatch) {
    console.warn(`Stage [${props.gotchiId}] - No style tag found in SVG`)
    return
  }

  const styleContent = styleMatch[1]
  
  // Remove any existing style element for this component
  if (styleElement.value) {
    styleElement.value.remove()
    styleElement.value = null
  }

  // Create a scoped style element that applies only to this SVG
  const styleId = `gotchi-stage-style-${props.gotchiId}`
  
  // Check if style already exists (in case of re-render)
  const existingStyle = document.getElementById(styleId)
  if (existingStyle) {
    existingStyle.remove()
  }
  
  const newStyleElement = document.createElement('style')
  newStyleElement.id = styleId
  
  // Scope the styles to this specific SVG using the data attribute
  // Handle both simple classes (.gotchi-primary) and multi-part classes (.gotchi-primary-mouth)
  const scopedStyles = styleContent
    .replace(/\.gotchi-([\w-]+)\s*\{/g, `svg[data-gotchi-stage-id="${props.gotchiId}"] .gotchi-$1 {`)
  
  newStyleElement.textContent = scopedStyles
  document.head.appendChild(newStyleElement)
  styleElement.value = newStyleElement
  
  console.log(`Stage [${props.gotchiId}] - Applied extracted styles`)
}

// Watch for SVG data from the map when gotchi data is available
watch(() => {
  const data = gotchiData.value
  if (!data) return null
  const svgs = svgDataMap.value[props.gotchiId]
  console.log('Stage watching SVG data for token', props.gotchiId, ':', {
    hasSvgs: !!svgs,
    isString: typeof svgs === 'string',
    svgsLength: svgs?.length,
    svgsValue: svgs ? svgs.substring(0, 100) + '...' : null
  })
  return svgs
}, async (svgs) => {
  console.log('SVG data changed in Stage for token', props.gotchiId, ':', {
    hasSvgs: !!svgs,
    type: typeof svgs,
    length: svgs?.length,
    preview: svgs ? svgs.substring(0, 100) + '...' : null
  })
  if (svgs && typeof svgs === 'string' && svgs.length > 0) {
    // svgs is now a single string, not an object
    svgViews.value = svgs
    console.log('Set svgViews.value to:', svgViews.value ? `${svgViews.value.substring(0, 50)}...` : 'null')
    
    // Apply extracted styles
    await nextTick()
    applySvgStyles(svgs)
    
    // Parse metadata from the SVG string
    try {
      console.log('Parsing SVG metadata, length:', svgs.length)
      svgMetadata.value = parseSVG(svgs)
      console.log('SVG metadata parsed:', {
        canvasSize: svgMetadata.value?.canvasSize,
        partsCount: svgMetadata.value?.parts?.length
      })
      
      // Update metadata for front view in all views metadata
      if (!svgMetadataByView.value['Front']) {
        svgMetadataByView.value['Front'] = svgMetadata.value
      }
    } catch (err) {
      console.error('Error parsing SVG:', err)
    }
  } else {
    console.warn('No valid SVG data available for token', props.gotchiId, ':', {
      svgs,
      type: typeof svgs,
      length: svgs?.length
    })
    svgViews.value = null
  }
}, { immediate: true })

// Watch for current SVG view changes to apply styles
watch(currentSvgView, async (newSvg) => {
  if (newSvg) {
    await nextTick()
    applySvgStyles(newSvg)
  }
})

onUnmounted(() => {
  // Clean up style element when component is destroyed
  if (styleElement.value) {
    styleElement.value.remove()
  }
  // Clean up scroll timeout
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
})

async function copyToClipboard(text, id) {
  if (!text) return
  
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    setTimeout(() => {
      copiedId.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Helper function to get SVG code for any view
function getViewSvgCode(viewName) {
  if (viewName === 'Front') {
    return svgViews.value || ''
  }
  return sideViews.value[viewName] || ''
}

// Copy code for a specific view
async function copyViewCode(viewName) {
  const code = getViewSvgCode(viewName)
  if (!code) return
  await copyToClipboard(code, `all-views-svg-${viewName}`)
}

// Copy SVG code for an element
async function copyElementSvg(svgCode, id) {
  if (!svgCode) return
  await copyToClipboard(svgCode, id)
}

// Dressing Room Functions
function selectWearable(wearableId) {
  previewWearables.value[selectedWearableSlot.value] = wearableId
}

// Handle scroll on wearable grid to load more items
function handleWearableGridScroll(event) {
  const element = event.target
  if (!element) return
  
  // Throttle scroll events to avoid excessive calls
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  
  scrollTimeout = setTimeout(() => {
    // Check if we're near the bottom (within 200px of bottom)
    const scrollThreshold = 200
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < scrollThreshold
    
    if (isNearBottom && hasMoreWearables.value && !isLoadingMoreWearables.value && !isLoadingWearables.value) {
      // Save current scroll position and scroll height before loading
      savedScrollPosition.value = element.scrollTop
      previousScrollHeight.value = element.scrollHeight
      
      isLoadingMoreWearables.value = true
      loadMoreWearables()
      
      // Reset loading state after queries have had time to start
      // The scroll position will be restored when filteredWearables updates
      setTimeout(() => {
        isLoadingMoreWearables.value = false
      }, 500)
    }
  }, 150) // Throttle to every 150ms
}

function removeWearable(slot) {
  previewWearables.value[slot] = 0
}

function removeInvalidWearables() {
  // Remove all invalid wearable IDs (set to 0)
  invalidWearableSlots.value.forEach(slot => {
    previewWearables.value[slot] = 0
  })
  invalidWearableSlots.value = []
  previewError.value = null
}

function resetToOriginal() {
  if (gotchiData.value && gotchiData.value.equippedWearables) {
    previewWearables.value = [...gotchiData.value.equippedWearables]
  }
}

function applyManualWearable() {
  if (manualWearableId.value !== null && manualWearableId.value >= 0) {
    previewWearables.value[selectedWearableSlot.value] = manualWearableId.value
    manualWearableId.value = null
  }
}

// Generate preview SVGs using previewSideAavegotchi
async function generatePreviewSvgs() {
  if (!gotchiData.value) return
  
  isLoadingPreview.value = true
  previewError.value = null // Clear any previous errors
  try {
    const contract = getContract()
    
    // Validate and filter wearable IDs
    // Only use wearable IDs that are > 0 (0 means empty slot, which is valid)
    // Validate against wearableSvgsMap - if a wearable has SVG data, it should work in preview
    const validatedWearables = [...previewWearables.value]
    const originalWearables = gotchiData.value.equippedWearables || []
    const svgMap = wearableSvgsMap.value || {}
    
    // Check each wearable ID and validate it
    for (let i = 0; i < validatedWearables.length; i++) {
      const currentId = validatedWearables[i]
      
      // If wearable ID is 0, it's an empty slot (valid)
      if (currentId === 0) {
        continue
      }
      
      // If it's the same as original, assume it's valid (original equipped wearables should work)
      if (currentId === originalWearables[i]) {
        continue
      }
      
      // If the wearable ID doesn't have SVG data in our map, it might not exist
      // Fall back to original equipped wearable for this slot
      if (!svgMap[currentId]) {
        console.warn(`Wearable ID ${currentId} not found in SVG map, falling back to original equipped wearable ${originalWearables[i] || 0}`)
        validatedWearables[i] = originalWearables[i] || 0
      } else {
        // Log which wearable we're trying (for debugging)
        console.log(`Preview slot ${i}: trying wearable ID ${currentId}`)
      }
    }
    
    // First, try to validate wearable IDs by checking if getItemSvg works for them
    // This helps catch invalid IDs before calling previewSideAavegotchi
    const validatedWearablesWithCheck = [...validatedWearables]
    for (let i = 0; i < validatedWearablesWithCheck.length; i++) {
      const wearableId = validatedWearablesWithCheck[i]
      if (wearableId !== 0 && !svgMap[wearableId]) {
        // Try to validate by calling getItemSvg if not in map
        try {
          await contract.getItemSvg(wearableId)
          // If successful, add to validation - wearable exists
        } catch (err) {
          // If getItemSvg fails, the wearable doesn't exist - use original or 0
          console.warn(`Wearable ID ${wearableId} validation failed, using original: ${originalWearables[i] || 0}`)
          validatedWearablesWithCheck[i] = originalWearables[i] || 0
        }
      }
    }
    
    // Call previewSideAavegotchi with validated wearables
    const previewResponse = await contract.previewSideAavegotchi(
      gotchiData.value.hauntId,
      gotchiData.value.collateral,
      gotchiData.value.numericTraits,
      validatedWearablesWithCheck
    )
    
    // Parse response (similar to fetchSideViews logic)
    let previewArray = []
    if (Array.isArray(previewResponse)) {
      previewArray = previewResponse
    } else if (previewResponse && previewResponse.ag_) {
      previewArray = Array.isArray(previewResponse.ag_) ? previewResponse.ag_ : [previewResponse.ag_]
    } else if (previewResponse && typeof previewResponse.length === 'number') {
      // Handle Proxy array
      previewArray = []
      for (let i = 0; i < previewResponse.length; i++) {
        if (previewResponse[i] !== undefined) {
          previewArray.push(previewResponse[i])
        }
      }
    }
    
    // Map preview SVGs to view names
    const newPreviewSvgs = {}
    if (previewArray.length >= 4) {
      newPreviewSvgs['Front'] = previewArray[0] || ''
      newPreviewSvgs['Left'] = previewArray[1] || ''
      newPreviewSvgs['Right'] = previewArray[2] || ''
      newPreviewSvgs['Back'] = previewArray[3] || ''
    } else if (previewArray.length > 0) {
      // Fallback: use first SVG for front view
      newPreviewSvgs['Front'] = previewArray[0] || ''
    }
    
    previewSvgs.value = newPreviewSvgs
    
    // Apply styles to preview SVGs
    await nextTick()
    Object.values(newPreviewSvgs).forEach(svg => {
      if (svg) {
        applySvgStyles(svg)
      }
    })
    
    console.log('Generated preview SVGs:', Object.keys(newPreviewSvgs))
  } catch (error) {
    console.error('Error generating preview SVGs:', error)
    console.error('Preview wearables array:', previewWearables.value)
    console.error('Original equipped wearables:', gotchiData.value?.equippedWearables)
    
    // Show user-friendly error message for invalid wearable IDs
    if (error.message && error.message.includes('SVG type or id does not exist')) {
      // Try to identify which wearable ID caused the issue
      // Check all non-zero wearables that differ from original, or all non-zero if no originals
      const invalidWearables = []
      const originalWearables = gotchiData.value?.equippedWearables || []
      
      for (let i = 0; i < previewWearables.value.length; i++) {
        const wearableId = Number(previewWearables.value[i]) || 0
        const originalId = Number(originalWearables[i]) || 0
        
        // Include if:
        // 1. Non-zero and different from original (user changed it)
        // 2. Or if original is also non-zero and we're using it (might be invalid too)
        if (wearableId !== 0) {
          const slotName = wearableSlots.find(s => s.slot === i)?.name || `Slot ${i}`
          const isChanged = wearableId !== originalId
          invalidWearables.push({ 
            slot: i, 
            slotName, 
            id: wearableId, 
            originalId,
            isChanged 
          })
        }
      }
      
      if (invalidWearables.length > 0) {
        console.warn('Invalid wearable IDs detected:', invalidWearables)
        // Store invalid slots for quick removal
        invalidWearableSlots.value = invalidWearables.map(w => w.slot)
        
        // Show all problematic wearable IDs (both changed and original)
        const allList = invalidWearables.map(w => `${w.slotName} (ID: ${w.id})`).join(', ')
        const changedWearables = invalidWearables.filter(w => w.isChanged)
        
        if (changedWearables.length > 0) {
          // User changed some wearables - show those prominently
          const changedList = changedWearables.map(w => `${w.slotName} (ID: ${w.id})`).join(', ')
          previewError.value = `Invalid wearable IDs detected: ${changedList}. These IDs may not exist in the contract or may not be compatible with previewSideAavegotchi. Please try different wearables or remove them.`
        } else {
          // All wearables match original - if they fail, it's likely a contract issue, not user error
          // Don't show error for original equipped wearables - just silently fail preview
          console.warn('Preview failed with original equipped wearables. This may be a contract limitation.')
          previewError.value = null // Don't show error for original wearables
          previewSvgs.value = {} // Clear preview and show original gotchi
        }
      } else {
        invalidWearableSlots.value = [] // Clear if no invalid wearables found
        // No non-zero wearables found, but error occurred - might be a contract issue
        previewError.value = 'Error generating preview. The contract rejected the wearable configuration. This might be a contract issue. Please try resetting to original equipped wearables.'
      }
    } else {
      previewError.value = `Error generating preview: ${error.message || 'Unknown error'}`
    }
    // Clear preview SVGs on error so user sees original gotchi
    previewSvgs.value = {}
  } finally {
    isLoadingPreview.value = false
  }
}
</script>

<style scoped>
.stage-container {
  @apply w-full p-6 max-w-7xl mx-auto;
  transition: margin-right 0.3s ease;
}

.stage-container.dressing-room-active {
  @apply mr-96;
}

.close-btn {
  @apply mb-6 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium text-gray-800 dark:text-gray-200;
}

.loading-container,
.error-container {
  @apply flex flex-col items-center justify-center py-12 gap-4;
}

.loading-spinner {
  @apply w-12 h-12 border-4 border-gray-300 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin;
}

.error-text {
  @apply text-red-600 dark:text-red-400 font-medium;
}

.stage-content {
  @apply space-y-8;
}

.info-section {
  @apply bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md transition-colors;
}

.gotchi-title {
  @apply text-3xl font-bold mb-6 flex flex-col sm:flex-row gap-2 items-baseline;
}

.gotchi-id {
  @apply text-blue-600 dark:text-blue-400;
}

.gotchi-name {
  @apply text-gray-800 dark:text-gray-100;
}

.stats-grid {
  @apply grid grid-cols-3 gap-4 mb-6;
}

.stat-card {
  @apply bg-gradient-to-br from-purple-100 dark:from-purple-900 to-purple-200 dark:to-purple-800 rounded-lg p-4 text-center;
}

.stat-label {
  @apply text-sm text-purple-700 dark:text-purple-300 font-medium mb-1;
}

.stat-value {
  @apply text-2xl font-bold text-purple-900 dark:text-purple-100;
}

.traits-grid {
  @apply grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3;
}

.trait-item {
  @apply bg-gray-100 dark:bg-gray-700 rounded-lg p-3 text-center;
}

.trait-label {
  @apply text-xs text-gray-600 dark:text-gray-300 block mb-1;
}

.trait-value {
  @apply text-lg font-bold text-gray-800 dark:text-gray-100;
}

.svg-section {
  @apply bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md transition-colors;
}

.svg-header {
  @apply flex items-center justify-between mb-6;
}

.section-title {
  @apply text-2xl font-bold text-gray-800 dark:text-gray-100;
}

.view-controls {
  @apply flex items-center gap-3;
}

.dressing-room-btn {
  @apply px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors;
  @apply ml-2 text-sm;
}

.dressing-room-btn.active {
  @apply bg-purple-800;
}

.nav-btn {
  @apply px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors;
  @apply disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-300 dark:disabled:hover:bg-gray-600;
  @apply font-bold text-lg min-w-[50px];
}

.view-indicator {
  @apply px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-semibold text-gray-700 dark:text-gray-200 min-w-[80px] text-center;
}

.loading-overlay {
  @apply absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 flex flex-col items-center justify-center gap-2 z-10 rounded-lg;
}

.loading-spinner-small {
  @apply w-8 h-8 border-2 border-gray-300 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin;
}

.svg-loading-fallback {
  @apply flex flex-col items-center justify-center gap-4 p-8 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-gray-200 dark:border-gray-600;
  min-height: 300px;
}

.debug-info {
  @apply text-sm text-gray-500 dark:text-gray-400 italic;
}

.svg-view-container {
  @apply flex flex-col gap-6 relative;
}

.svg-view-item {
  @apply flex flex-col gap-4;
}

.view-title {
  @apply text-lg font-semibold text-gray-700 dark:text-gray-200;
}

.metadata-section {
  @apply rounded-lg p-6 shadow-md transition-colors;
  background-color: #374151;
}

.metadata-content {
  @apply space-y-6;
}

.canvas-info {
  @apply rounded-lg p-4;
  background-color: #2563EB;
}

.metadata-subtitle {
  @apply text-lg font-semibold mb-4;
  color: #ffffff;
}

.info-row {
  @apply flex justify-between items-center py-2 last:border-0;
  border-bottom: 1px solid #60a5fa;
}

.info-row > span:first-child {
  color: #60a5fa;
}

.info-value {
  @apply font-mono font-semibold;
  color: #ffffff;
}

.parts-info {
  @apply mt-6;
}

.parts-list {
  @apply space-y-3 max-h-96 overflow-y-auto;
}

.part-item {
  @apply rounded-lg p-3 border;
  background-color: #374151;
  border-color: #4b5563;
  border-width: 1px;
}

.part-header {
  @apply flex items-center gap-2 mb-2;
}

.part-tag {
  @apply bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs font-mono font-semibold;
}

.part-id {
  @apply text-xs text-gray-600 dark:text-gray-400 font-mono;
}

.part-details {
  @apply space-y-1 text-sm;
}

.detail-row {
  @apply flex justify-between text-gray-700 dark:text-gray-300;
}

.transform-text {
  @apply font-mono text-xs break-all max-w-xs;
}

.parts-truncated {
  @apply text-center text-gray-500 dark:text-gray-400 italic py-2;
}

.svg-code-section {
  @apply bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md transition-colors;
}

.svg-code-container {
  @apply space-y-4;
}

.svg-code-block {
  @apply bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono;
  @apply border border-gray-700;
  max-height: 400px;
  overflow-y: auto;
}

.svg-code-block.small {
  @apply text-xs;
  max-height: 200px;
}

.svg-code-block code {
  @apply text-green-400;
  white-space: pre;
}

.copy-code-btn {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
  @apply font-medium;
}

.copy-code-btn.small {
  @apply px-3 py-1.5 text-sm;
}

.copy-code-btn.copied {
  @apply bg-green-600 hover:bg-green-700;
}

.svg-code-wrapper {
  @apply mt-4 space-y-2;
}

.svg-code-details {
  @apply bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600;
}

.code-summary {
  @apply px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 font-medium text-sm text-gray-700 dark:text-gray-200;
}

.all-views-code-section {
  @apply mt-8 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md transition-colors;
}

.section-subtitle {
  @apply text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4;
}

.svg-tabs {
  @apply flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700;
  overflow-x: auto;
}

.tab-btn {
  @apply px-4 py-2 font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors;
  @apply border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600;
  @apply whitespace-nowrap;
}

.tab-btn.active {
  @apply text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400;
}

.tab-content {
  @apply mt-4;
}

.code-block-wrapper {
  @apply space-y-2;
}

.loading-code {
  @apply flex items-center justify-center py-8 text-gray-500 dark:text-gray-400;
}

.breakdown-section {
  @apply mt-8 rounded-lg p-6 shadow-md transition-colors;
  background-color: #374151;
}

.breakdown-content {
  @apply space-y-6;
}

.breakdown-category {
  @apply space-y-4;
}

.category-title {
  @apply text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3;
}

.category-list {
  @apply space-y-2;
}

.category-item {
  @apply rounded-lg border p-4;
  background-color: #374151;
  border-color: #4b5563;
  border-width: 1px;
}

.category-details {
  @apply w-full;
}

.category-summary {
  @apply flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors;
  @apply list-none;
}

.category-summary::-webkit-details-marker {
  display: none;
}

.category-name {
  @apply font-medium;
  color: #60a5fa;
}

.category-count {
  @apply text-sm px-2 py-1 rounded;
  background-color: #111827;
  color: #ffffff;
}

.category-elements {
  @apply px-4 pb-4 space-y-2;
}

.element-item {
  @apply bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700 text-sm transition-colors;
}

.element-info {
  @apply flex items-center gap-2 mb-2;
}

.element-tag {
  @apply bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs font-mono font-semibold;
}

.element-class {
  @apply text-xs font-mono;
  color: #2563EB;
}

.element-details {
  @apply space-y-2 text-xs text-gray-600 dark:text-gray-400 mt-2;
}

.element-detail-row {
  @apply flex items-center gap-2;
}

.detail-label {
  @apply font-semibold min-w-[100px];
  color: #60a5fa;
}

.detail-value {
  @apply text-gray-600 dark:text-gray-300;
}

.fill-color {
  @apply flex items-center gap-2;
}

.color-swatch {
  @apply inline-block w-4 h-4 rounded border border-gray-300 dark:border-gray-600;
  flex-shrink: 0;
}

.transform-value {
  @apply font-mono text-xs break-all;
  max-width: 300px;
}

.element-header {
  @apply flex items-center justify-between mb-2;
}

.element-actions {
  @apply flex items-center gap-2;
}

.copy-element-btn {
  @apply px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors;
  @apply min-w-[32px] flex items-center justify-center;
}

.copy-element-btn.copied {
  @apply bg-green-600 hover:bg-green-700;
}

.element-preview-section {
  @apply my-2;
}

.element-thumbnail-wrapper {
  @apply relative inline-block;
}

.element-thumbnail {
  @apply border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 p-2;
  @apply inline-block cursor-pointer;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.element-thumbnail :deep(svg) {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}

.element-preview-popup {
  @apply absolute z-50 pointer-events-none;
  @apply bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg shadow-2xl p-4;
  top: 100%;
  left: 50%;
  margin-top: 8px;
  transform: translateX(-50%);
}

.preview-svg {
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.preview-svg :deep(svg) {
  width: 160px;
  height: 160px;
  max-width: 160px;
  max-height: 160px;
  display: block;
}

/* Ensure preview SVG styles are applied */
.preview-svg :deep(svg) * {
  /* Allow SVG's internal styles to apply */
}

.element-code-details {
  @apply mt-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600;
}

.element-code-summary {
  @apply px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 font-medium text-xs text-gray-700 dark:text-gray-200;
}

.element-code-block {
  @apply bg-gray-900 text-green-400 p-3 rounded text-xs font-mono;
  @apply border-t border-gray-700 overflow-x-auto;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
}

.element-code-block code {
  @apply text-green-400;
  white-space: pre;
}

.element-item.is-wearable {
  @apply border-l-4 border-purple-500 dark:border-purple-400;
}

.wearable-badge {
  @apply bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded text-xs font-semibold ml-2;
}

.wearable-classes {
  @apply flex flex-wrap gap-2;
}

.wearable-class-tag {
  @apply bg-purple-50 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded text-xs font-mono border border-purple-200 dark:border-purple-700;
}

.unidentified-wearables {
  @apply border-l-4 border-purple-400;
}

.wearable-class-info {
  @apply text-xs text-gray-600 dark:text-gray-400 font-mono;
}

/* Generic wearable-item - removed to avoid conflicts with grid-specific styles */
/* .wearable-item {
  @apply bg-gray-50 rounded-lg border border-gray-200 p-4;
} */

/* Dressing Room Styles */
.dressing-room-panel {
  @apply fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-800 shadow-2xl z-50 transition-colors;
  @apply flex flex-col;
  overflow-y: auto;
}

.panel-header {
  @apply flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900;
  @apply sticky top-0 z-10;
}

.panel-header h3 {
  @apply text-lg font-semibold text-gray-800 dark:text-gray-100;
}

.panel-close-btn {
  @apply w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded;
  @apply text-2xl font-light;
}

.panel-content {
  @apply flex-1 p-4 space-y-4;
}

.preview-error-message {
  @apply bg-red-50 border-l-4 border-red-500 p-3 rounded-lg mb-4;
}

.preview-error-message .error-content {
  @apply relative;
}

.preview-error-message strong {
  @apply text-red-800 block mb-1;
}

.preview-error-message p {
  @apply text-red-700 text-sm mb-0;
}

.preview-error-message .error-actions {
  @apply flex items-center gap-2 mt-2;
}

.preview-error-message .error-action-btn {
  @apply px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors;
}

.preview-error-message .error-action-remove {
  @apply bg-orange-600 hover:bg-orange-700;
}

.preview-error-message .error-close-btn {
  @apply w-6 h-6 flex items-center justify-center text-red-600 hover:text-red-800 hover:bg-red-100 rounded;
  @apply text-lg font-light ml-auto;
}

.slot-tabs {
  @apply flex flex-wrap gap-2;
}

.slot-tab {
  @apply px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600;
  @apply bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors;
}

.slot-tab.active {
  @apply bg-purple-600 text-white border-purple-600;
}

.selected-wearables-summary {
  @apply bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600;
}

.selected-wearables-summary h4 {
  @apply font-semibold text-gray-800 dark:text-gray-100 mb-3;
}

.equipped-list {
  @apply space-y-2 mb-3;
}

.equipped-item {
  @apply flex items-center justify-between p-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700;
}

.equipped-item.has-wearable {
  @apply border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900;
}

.slot-name {
  @apply font-medium text-gray-700 dark:text-gray-200 text-sm;
}

.wearable-id {
  @apply text-gray-600 dark:text-gray-300 text-sm font-mono;
}

.remove-btn {
  @apply w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-700;
  @apply hover:bg-red-50 rounded text-lg;
}

.reset-btn {
  @apply w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium;
  @apply hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors;
}

.wearable-browser {
  @apply space-y-4;
}

.browser-header {
  @apply flex items-center justify-between;
}

.browser-header h4 {
  @apply font-semibold text-gray-800 dark:text-gray-100;
}

.loading-wearables,
.error-wearables {
  @apply p-4 text-center text-gray-500 dark:text-gray-400;
}

.loading-more-wearables {
  @apply col-span-2 flex flex-col items-center justify-center gap-2 p-4 text-gray-500 dark:text-gray-400;
}

.fallback-note {
  @apply text-xs text-gray-400 dark:text-gray-500 mt-2;
}

.empty-wearables {
  @apply p-8 text-center text-gray-500 dark:text-gray-400;
}

.empty-wearables p {
  @apply mb-2;
}

.wearable-search {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100;
  @apply focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400;
}

.wearable-grid {
  @apply grid grid-cols-2 gap-3;
  max-height: 500px !important; /* Increased from 96 (384px) to 500px for better visibility */
  overflow-y: auto !important;
  overflow-x: hidden !important;
  min-height: 200px !important; /* Ensure grid has minimum visible height */
  padding: 4px !important; /* Add padding for scrollbar */
  width: 100% !important; /* Force full width */
  display: grid !important; /* Ensure grid display */
  visibility: visible !important;
  opacity: 1 !important;
  /* Ensure smooth scrolling */
  scroll-behavior: smooth;
  /* Add visible scrollbar */
  scrollbar-width: thin;
  scrollbar-color: #cbd5e0 #f7fafc;
}

.wearable-grid::-webkit-scrollbar {
  width: 8px;
}

.wearable-grid::-webkit-scrollbar-track {
  background: #f7fafc;
}

.dark .wearable-grid::-webkit-scrollbar-track {
  background: #1f2937;
}

.wearable-grid::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 4px;
}

.dark .wearable-grid::-webkit-scrollbar-thumb {
  background: #4b5563;
}

.wearable-grid::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

.dark .wearable-grid::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

/* Ensure items are visible and properly sized */
.wearable-grid .wearable-item {
  @apply cursor-pointer p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700;
  @apply hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900 transition-colors;
  @apply bg-white dark:bg-gray-800;
  min-height: 120px !important; /* Ensure items have minimum height */
  width: 100% !important; /* Force full width */
  display: flex !important;
  flex-direction: column !important;
  opacity: 1 !important; /* Force visibility */
  visibility: visible !important; /* Force visibility */
  /* Ensure items take up space */
  flex-shrink: 0;
  position: relative !important; /* Ensure proper positioning */
  z-index: 1 !important; /* Ensure items are above other elements */
  /* Debug: Make items more visible */
  box-sizing: border-box !important;
  margin: 0 !important;
}

.wearable-browser .wearable-item {
  @apply cursor-pointer p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700;
  @apply hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900 transition-colors;
  @apply bg-white dark:bg-gray-800;
}

.wearable-browser .wearable-item.selected {
  @apply border-purple-600 dark:border-purple-500 bg-purple-100 dark:bg-purple-900;
}

.wearable-browser .wearable-item.equipped {
  @apply border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900;
}

.wearable-browser .wearable-item.equipped.selected {
  @apply border-purple-600 dark:border-purple-500 bg-purple-200 dark:bg-purple-800;
}

.wearable-thumbnail {
  @apply w-full aspect-square bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center mb-2;
  min-height: 80px !important; /* Ensure thumbnail has minimum height */
  flex-shrink: 0; /* Prevent shrinking */
  overflow: hidden; /* Clip SVG to container */
  position: relative; /* For positioning */
}

.thumbnail-img {
  @apply w-full h-full;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.thumbnail-img :deep(svg) {
  width: 100% !important;
  height: 100% !important;
  display: block !important;
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important; /* Scale SVG to fit container */
}

.thumbnail-placeholder {
  @apply text-gray-700 dark:text-gray-300 text-sm font-bold font-mono;
  font-size: 1.25rem !important; /* Make placeholder text larger and more visible */
  display: block !important; /* Ensure text is visible */
  opacity: 1 !important;
  visibility: visible !important;
}

.wearable-info {
  @apply flex flex-col gap-1;
  width: 100% !important; /* Ensure info section takes full width */
  flex-shrink: 0; /* Prevent shrinking */
}

.wearable-name {
  @apply text-xs font-medium text-gray-800 dark:text-gray-200 truncate;
  display: block !important;
  opacity: 1 !important;
  visibility: visible !important;
}

.wearable-id-label {
  @apply text-xs text-gray-500 dark:text-gray-400 font-mono;
  display: block !important;
  opacity: 1 !important;
  visibility: visible !important;
}

/* Ensure wearable-list container is visible */
.wearable-list {
  @apply w-full;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

.manual-wearable-input {
  @apply mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600;
}

.manual-wearable-input label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2;
}

.input-group {
  @apply flex gap-2;
}

.wearable-id-input {
  @apply flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg;
  @apply bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100;
  @apply focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400;
}

.apply-btn {
  @apply px-4 py-2 bg-purple-600 text-white rounded-lg font-medium;
  @apply hover:bg-purple-700 transition-colors;
}

.wearable-header {
  @apply flex items-center gap-3 mb-2;
}

.wearable-slot {
  @apply font-semibold;
  color: #60a5fa;
}

.wearable-id {
  @apply px-2 py-1 rounded text-xs font-mono;
  background-color: #111827;
  color: #ffffff;
}

.wearable-empty {
  @apply text-gray-500 text-sm italic;
}

.wearable-details {
  @apply mt-2;
}

.wearable-info {
  @apply flex items-center gap-3 text-sm mb-2;
  color: #ffffff;
}

.wearable-elements {
  @apply mt-2;
}

.wearable-summary {
  @apply text-xs cursor-pointer hover:underline;
  color: #60a5fa;
}

.element-list {
  @apply mt-2 space-y-2;
}

.wearable-empty-state {
  @apply text-sm text-gray-500 italic;
}
</style>

