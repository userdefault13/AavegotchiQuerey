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
                          <div v-if="element.offset" class="element-detail-row">
                            <span class="detail-label">Offset:</span>
                            <span class="detail-value">({{ element.offset?.x || 0 }}, {{ element.offset?.y || 0 }})</span>
                          </div>
                          <div v-if="element.dimension" class="element-detail-row">
                            <span class="detail-label">Dimension:</span>
                            <span class="detail-value">{{ element.dimension?.width || 0 }} × {{ element.dimension?.height || 0 }}</span>
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
                              <div v-if="element.offset" class="element-detail-row">
                                <span class="detail-label">Offset:</span>
                                <span class="detail-value">({{ element.offset?.x || 0 }}, {{ element.offset?.y || 0 }})</span>
                              </div>
                              <div v-if="element.dimension" class="element-detail-row">
                                <span class="detail-label">Dimension:</span>
                                <span class="detail-value">{{ element.dimension?.width || 0 }} × {{ element.dimension?.height || 0 }}</span>
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
                              <div v-if="element.offset" class="element-detail-row">
                                <span class="detail-label">Offset:</span>
                                <span class="detail-value">({{ element.offset?.x || 0 }}, {{ element.offset?.y || 0 }})</span>
                              </div>
                              <div v-if="element.dimension" class="element-detail-row">
                                <span class="detail-label">Dimension:</span>
                                <span class="detail-value">{{ element.dimension?.width || 0 }} × {{ element.dimension?.height || 0 }}</span>
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
const cleanSideViews = ref({}) // Clean Gotchi views without wearables (for hand extraction)
const baseGotchiPartsByView = ref({}) // Base Gotchi parts extracted from clean SVG per view: { Front: {...}, Left: {...}, Right: {...}, Back: {...} }
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
const hasReachedEnd = ref(false)
const isCurrentlyLoadingMore = ref(false)

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
// Reset end-of-list state when filters change
watch([selectedWearableSlot, wearableSearch], () => {
  hasReachedEnd.value = false
  isCurrentlyLoadingMore.value = false // Reset loading flag when filters change
})

// Reset end-of-list state when more items become available
watch(() => hasMoreWearables.value, (hasMore) => {
  if (hasMore) {
    hasReachedEnd.value = false
  }
})

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
    
    // Always fetch via getAavegotchi to extract collateral and ensure we have all data
    // The collateral address is in the tuple response from getAavegotchi
    console.log('Fetching gotchi data via getAavegotchi to extract collateral for token:', tokenId)
    const gotchi = await contract.getAavegotchi(tokenId)
    const collateral = gotchi.collateral
    const hauntId = Number(gotchi.hauntId)
    const numericTraits = gotchi.numericTraits.map(t => Number(t))
    console.log('Fetched gotchi data:', { 
      collateral, 
      hauntId, 
      numericTraits: numericTraits.length,
      numericTraitsArray: numericTraits 
    })
    
    // Use ALL 6 traits (contract expects int16[6] per ABI)
    const traitsForContract = numericTraits // Use all 6 traits, don't slice
    
    const newViews = ['Front']
    const newSideViews = {}
    
    // Try to fetch side views using previewSideAavegotchi (returns [front, left, right, back])
    // This uses the gotchi's actual data (hauntId, collateral, traits, wearables)
    // Fallback to getAavegotchiSideSvgs if previewSideAavegotchi fails
    let sidesArray = []
    try {
      console.log('Attempting to fetch side views using previewSideAavegotchi for token:', tokenId)
      const sidesResponse = await contract.previewSideAavegotchi(
        hauntId,
        collateral,
        traitsForContract,
        gotchiData.value.equippedWearables || new Array(16).fill(0)
      )
      
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
      
      console.log('Side views from previewSideAavegotchi:', sidesArray)
      
      // Parse side views array - format: [front, left, right, back]
      // Note: Based on user feedback, it appears the array might be [front, right, left, back]
      // Let's check the SVG content to determine which is which, or swap if needed
      if (sidesArray && sidesArray.length >= 4) {
        // Check SVG content to determine which is left vs right
        // Left view should contain "gotchi-bodyLeft" or "bodyLeft"
        // Right view should contain "gotchi-bodyRight" or "bodyRight"
        const view1 = (sidesArray[1] || '').toLowerCase()
        const view2 = (sidesArray[2] || '').toLowerCase()
        
        const view1IsLeft = view1.includes('bodyleft') || view1.includes('gotchi-bodyleft')
        const view2IsLeft = view2.includes('bodyleft') || view2.includes('gotchi-bodyleft')
        
        if (view1IsLeft && !view2IsLeft) {
          // Standard order: [front, left, right, back]
          newSideViews['Left'] = sidesArray[1]
          newSideViews['Right'] = sidesArray[2]
        } else if (view2IsLeft && !view1IsLeft) {
          // Swapped order: [front, right, left, back]
          newSideViews['Left'] = sidesArray[2]
          newSideViews['Right'] = sidesArray[1]
        } else {
          // Can't determine, use default but log warning
          console.warn('Could not determine left/right view order, using default')
          newSideViews['Left'] = sidesArray[1]
          newSideViews['Right'] = sidesArray[2]
        }
        
        newSideViews['Back'] = sidesArray[3]
        newViews.push('Left', 'Right', 'Back')
      } else if (sidesArray && sidesArray.length > 0) {
        // Handle partial arrays - try to detect order
        if (sidesArray.length >= 2) {
          const view1 = (sidesArray[1] || '').toLowerCase()
          if (view1.includes('bodyleft') || view1.includes('gotchi-bodyleft')) {
            newSideViews['Left'] = sidesArray[1]
            newViews.push('Left')
          } else if (view1.includes('bodyright') || view1.includes('gotchi-bodyright')) {
            newSideViews['Right'] = sidesArray[1]
            newViews.push('Right')
          } else {
            // Default assumption
            newSideViews['Left'] = sidesArray[1]
            newViews.push('Left')
          }
        }
        if (sidesArray.length >= 3) {
          const view2 = (sidesArray[2] || '').toLowerCase()
          if (!newSideViews['Left'] && (view2.includes('bodyleft') || view2.includes('gotchi-bodyleft'))) {
            newSideViews['Left'] = sidesArray[2]
            newViews.push('Left')
          } else if (!newSideViews['Right'] && (view2.includes('bodyright') || view2.includes('gotchi-bodyright'))) {
            newSideViews['Right'] = sidesArray[2]
            newViews.push('Right')
          } else if (!newSideViews['Right']) {
            newSideViews['Right'] = sidesArray[2]
            newViews.push('Right')
          }
        }
        if (sidesArray.length >= 4) {
          newSideViews['Back'] = sidesArray[3]
          newViews.push('Back')
        }
      }
    } catch (getSidesError) {
      console.warn('previewSideAavegotchi failed, trying fallback getAavegotchiSideSvgs:', getSidesError.message)
      
      // Fallback to getAavegotchiSideSvgs which only needs tokenId
      try {
        console.log('Attempting to fetch side views using getAavegotchiSideSvgs for token:', tokenId)
        const fallbackResponse = await contract.getAavegotchiSideSvgs(tokenId)
        
        // Parse fallback response (same format as previewSideAavegotchi)
        if (fallbackResponse && typeof fallbackResponse === 'object') {
          if (typeof fallbackResponse.length === 'number' && fallbackResponse.length > 0) {
            sidesArray = []
            for (let i = 0; i < fallbackResponse.length; i++) {
              if (fallbackResponse[i] !== undefined) {
                sidesArray.push(fallbackResponse[i])
              }
            }
          } else if (fallbackResponse.ag_) {
            const agValue = fallbackResponse.ag_
            if (Array.isArray(agValue)) {
              sidesArray = agValue
            } else if (typeof agValue === 'string') {
              sidesArray = [agValue]
            } else if (agValue && typeof agValue.length === 'number') {
              sidesArray = []
              for (let i = 0; i < agValue.length; i++) {
                if (agValue[i] !== undefined) {
                  sidesArray.push(agValue[i])
                }
              }
            }
          } else if (Array.isArray(fallbackResponse)) {
            sidesArray = fallbackResponse
          }
        }
        
        console.log('Side views from getAavegotchiSideSvgs:', sidesArray)
        
        // Parse side views array - format: [front, left, right, back]
        if (sidesArray && sidesArray.length >= 4) {
          const view1 = (sidesArray[1] || '').toLowerCase()
          const view2 = (sidesArray[2] || '').toLowerCase()
          
          const view1IsLeft = view1.includes('bodyleft') || view1.includes('gotchi-bodyleft')
          const view2IsLeft = view2.includes('bodyleft') || view2.includes('gotchi-bodyleft')
          
          if (view1IsLeft && !view2IsLeft) {
            newSideViews['Left'] = sidesArray[1]
            newSideViews['Right'] = sidesArray[2]
          } else if (view2IsLeft && !view1IsLeft) {
            newSideViews['Left'] = sidesArray[2]
            newSideViews['Right'] = sidesArray[1]
          } else {
            console.warn('Could not determine left/right view order, using default')
            newSideViews['Left'] = sidesArray[1]
            newSideViews['Right'] = sidesArray[2]
          }
          
          newSideViews['Back'] = sidesArray[3]
          newViews.push('Left', 'Right', 'Back')
        } else if (sidesArray && sidesArray.length > 0) {
          // Handle partial arrays
          if (sidesArray.length >= 2) {
            const view1 = (sidesArray[1] || '').toLowerCase()
            if (view1.includes('bodyleft') || view1.includes('gotchi-bodyleft')) {
              newSideViews['Left'] = sidesArray[1]
              newViews.push('Left')
            } else if (view1.includes('bodyright') || view1.includes('gotchi-bodyright')) {
              newSideViews['Right'] = sidesArray[1]
              newViews.push('Right')
            } else {
              newSideViews['Left'] = sidesArray[1]
              newViews.push('Left')
            }
          }
          if (sidesArray.length >= 3) {
            const view2 = (sidesArray[2] || '').toLowerCase()
            if (!newSideViews['Left'] && (view2.includes('bodyleft') || view2.includes('gotchi-bodyleft'))) {
              newSideViews['Left'] = sidesArray[2]
              newViews.push('Left')
            } else if (!newSideViews['Right'] && (view2.includes('bodyright') || view2.includes('gotchi-bodyright'))) {
              newSideViews['Right'] = sidesArray[2]
              newViews.push('Right')
            } else if (!newSideViews['Right']) {
              newSideViews['Right'] = sidesArray[2]
              newViews.push('Right')
            }
          }
          if (sidesArray.length >= 4) {
            newSideViews['Back'] = sidesArray[3]
            newViews.push('Back')
          }
        }
      } catch (fallbackError) {
        console.error('Both previewSideAavegotchi and getAavegotchiSideSvgs failed:', fallbackError)
        console.error('Error details:', {
          previewError: getSidesError.message,
          fallbackError: fallbackError.message,
          tokenId: gotchiData.value?.tokenId,
          hauntId: gotchiData.value?.hauntId,
          collateral: gotchiData.value?.collateral,
          hasTraits: !!gotchiData.value?.numericTraits,
          hasWearables: !!gotchiData.value?.equippedWearables
        })
      }
    }
    
    sideViews.value = newSideViews
    availableViews.value = newViews
    currentViewIndex.value = 0 // Reset to front view
    
    // Fetch clean base Gotchi views (without wearables) using neutral traits
    // This gives us the base Gotchi parts: mouth, body, eyes, collateral, hands, background, shadow
    // Use hauntId = 1 (haunt1), neutral traits [50,50,50,50,50,50], and empty wearables to get clean base Gotchi
    try {
      console.log('\n========== CLEAN AAVEGOTCHI FETCH ==========')
      console.log('Purpose: Fetching clean base Gotchi views (no wearables, neutral traits) for parts extraction')
      
      // Use hauntId = 1 (haunt1) as specified by user for base Gotchi template
      const baseHauntId = 1
      if (!collateral && collateral !== 0) {
        throw new Error('Invalid collateral: ' + collateral)
      }
      
      // Use neutral traits [50,50,50,50,50,50] to get base Gotchi parts
      const neutralTraits = [50, 50, 50, 50, 50, 50]
      const emptyWearables = new Array(16).fill(0)
      
      console.log('📞 Calling previewSideAavegotchi for clean base Gotchi with:', {
        hauntId: baseHauntId,
        collateral: collateral,
        traits: neutralTraits,
        wearables: emptyWearables,
        wearablesLength: emptyWearables.length
      })
      
      const callStartTime = performance.now()
      const cleanSidesResponse = await contract.previewSideAavegotchi(
        baseHauntId,
        collateral,
        neutralTraits,
        emptyWearables
      )
      const callEndTime = performance.now()
      
      console.log(`⏱️  Contract call completed in ${(callEndTime - callStartTime).toFixed(2)}ms`)
      console.log('📦 Raw response type:', typeof cleanSidesResponse)
      console.log('📦 Raw response keys:', cleanSidesResponse ? Object.keys(cleanSidesResponse) : 'null')
      console.log('📦 Has length property:', typeof (cleanSidesResponse?.length) === 'number' ? cleanSidesResponse.length : 'no')
      
      // Parse clean sides response
      let cleanSidesArray = []
      if (cleanSidesResponse && typeof cleanSidesResponse === 'object') {
        if (typeof cleanSidesResponse.length === 'number' && cleanSidesResponse.length > 0) {
          console.log(`📋 Parsing as array-like object with length: ${cleanSidesResponse.length}`)
          cleanSidesArray = []
          for (let i = 0; i < cleanSidesResponse.length; i++) {
            if (cleanSidesResponse[i] !== undefined) {
              cleanSidesArray.push(cleanSidesResponse[i])
              console.log(`  ✓ Index ${i}: ${typeof cleanSidesResponse[i]} (length: ${typeof cleanSidesResponse[i] === 'string' ? cleanSidesResponse[i].length : 'N/A'})`)
            }
          }
        } else if (cleanSidesResponse.ag_) {
          console.log('📋 Parsing via ag_ property')
          const agValue = cleanSidesResponse.ag_
          if (Array.isArray(agValue)) {
            cleanSidesArray = agValue
            console.log(`  ✓ Array with ${agValue.length} items`)
          } else if (typeof agValue === 'string') {
            cleanSidesArray = [agValue]
            console.log(`  ✓ Single string (length: ${agValue.length})`)
          } else if (agValue && typeof agValue.length === 'number') {
            console.log(`  ✓ Array-like ag_ with length: ${agValue.length}`)
            cleanSidesArray = []
            for (let i = 0; i < agValue.length; i++) {
              if (agValue[i] !== undefined) {
                cleanSidesArray.push(agValue[i])
              }
            }
          }
        } else if (Array.isArray(cleanSidesResponse)) {
          console.log('📋 Parsing as real array')
          cleanSidesArray = cleanSidesResponse
        }
      }
      
      console.log(`✅ Parsed ${cleanSidesArray.length} view(s) from clean aavegotchi response`)
      
      if (cleanSidesArray && cleanSidesArray.length >= 4) {
        const cleanSideViewsObj = {}
        
        // Log each view's characteristics
        console.log('\n📊 Analyzing each view:')
        cleanSidesArray.forEach((svg, index) => {
          const viewName = index === 0 ? 'Front' : index === 1 ? 'Left/Right-1' : index === 2 ? 'Left/Right-2' : index === 3 ? 'Back' : `View-${index}`
          const svgLength = typeof svg === 'string' ? svg.length : 0
          const hasBodyLeft = typeof svg === 'string' && svg.toLowerCase().includes('bodyleft')
          const hasBodyRight = typeof svg === 'string' && svg.toLowerCase().includes('bodyright')
          
          console.log(`  [${index}] ${viewName}:`, {
            type: typeof svg,
            length: svgLength,
            hasBodyLeft,
            hasBodyRight,
            preview: typeof svg === 'string' ? svg.substring(0, 100) + '...' : 'N/A'
          })
        })
        
        // Extract base Gotchi parts from the front view
        const frontView = cleanSidesArray[0]
        if (frontView) {
          console.log('\n🔍 Extracting base parts from Front view...')
          const extractedParts = extractBaseParts(frontView, 'Front')
          baseGotchiPartsByView.value['Front'] = extractedParts
          console.log('✅ Base Gotchi parts extracted for Front:', {
            parts: Object.keys(extractedParts),
            partsCount: Object.keys(extractedParts).length,
            hasBackground: !!extractedParts.Background,
            hasBody: !!extractedParts.Body,
            hasMouth: !!extractedParts.Mouth,
            hasEyes: !!extractedParts.Eyes,
            hasCollateral: !!extractedParts.Collateral,
            hasHands: !!extractedParts.Hands,
            hasShadow: !!extractedParts.Shadow
          })
        }
        
        // Determine left/right order
        const view1 = (cleanSidesArray[1] || '').toLowerCase()
        const view2 = (cleanSidesArray[2] || '').toLowerCase()
        const view1IsLeft = view1.includes('bodyleft') || view1.includes('gotchi-bodyleft')
        const view2IsLeft = view2.includes('bodyleft') || view2.includes('gotchi-bodyleft')
        
        console.log('\n🔄 Determining Left/Right view order:')
        console.log('  View 1 (index 1) is Left:', view1IsLeft)
        console.log('  View 2 (index 2) is Left:', view2IsLeft)
        
        if (view1IsLeft && !view2IsLeft) {
          cleanSideViewsObj['Left'] = cleanSidesArray[1]
          cleanSideViewsObj['Right'] = cleanSidesArray[2]
          console.log('  ✅ Standard order: [Front, Left, Right, Back]')
        } else if (view2IsLeft && !view1IsLeft) {
          cleanSideViewsObj['Left'] = cleanSidesArray[2]
          cleanSideViewsObj['Right'] = cleanSidesArray[1]
          console.log('  ✅ Swapped order: [Front, Right, Left, Back]')
        } else {
          cleanSideViewsObj['Left'] = cleanSidesArray[1]
          cleanSideViewsObj['Right'] = cleanSidesArray[2]
          console.log('  ⚠️  Could not determine order, using default')
        }
        
        cleanSideViewsObj['Back'] = cleanSidesArray[3]
        cleanSideViews.value = cleanSideViewsObj
        
        // Extract parts from Left and Right views immediately
        console.log('\n🔍 Extracting parts from Left view...')
        if (cleanSideViewsObj['Left']) {
          const leftParts = extractBaseParts(cleanSideViewsObj['Left'], 'Left')
          baseGotchiPartsByView.value['Left'] = leftParts
          console.log('✅ Left view parts extracted:', {
            parts: Object.keys(leftParts),
            partsCount: Object.keys(leftParts).length,
            hasBackground: !!leftParts.Background,
            hasBody: !!leftParts.Body,
            hasMouth: !!leftParts.Mouth,
            hasEyes: !!leftParts.Eyes,
            hasCollateral: !!leftParts.Collateral,
            hasHands: !!leftParts.Hands,
            hasShadow: !!leftParts.Shadow
          })
        }
        
        console.log('\n🔍 Extracting parts from Right view...')
        if (cleanSideViewsObj['Right']) {
          const rightParts = extractBaseParts(cleanSideViewsObj['Right'], 'Right')
          baseGotchiPartsByView.value['Right'] = rightParts
          console.log('✅ Right view parts extracted:', {
            parts: Object.keys(rightParts),
            partsCount: Object.keys(rightParts).length,
            hasBackground: !!rightParts.Background,
            hasBody: !!rightParts.Body,
            hasMouth: !!rightParts.Mouth,
            hasEyes: !!rightParts.Eyes,
            hasCollateral: !!rightParts.Collateral,
            hasHands: !!rightParts.Hands,
            hasShadow: !!rightParts.Shadow
          })
        }
        
        console.log('\n🔍 Extracting parts from Back view...')
        if (cleanSideViewsObj['Back']) {
          const backParts = extractBaseParts(cleanSideViewsObj['Back'], 'Back')
          baseGotchiPartsByView.value['Back'] = backParts
          console.log('✅ Back view parts extracted:', {
            parts: Object.keys(backParts),
            partsCount: Object.keys(backParts).length,
            hasBackground: !!backParts.Background,
            hasBody: !!backParts.Body,
            hasMouth: !!backParts.Mouth,
            hasEyes: !!backParts.Eyes,
            hasCollateral: !!backParts.Collateral,
            hasHands: !!backParts.Hands,
            hasShadow: !!backParts.Shadow
          })
        }
        
        console.log('✅ Clean side views stored:', Object.keys(cleanSideViews.value))
        console.log('✅ Base parts extracted for views:', Object.keys(baseGotchiPartsByView.value))
        console.log('========== END CLEAN AAVEGOTCHI FETCH ==========\n')
      } else {
        console.warn('⚠️  Clean sides array has insufficient views:', cleanSidesArray.length)
      }
    } catch (cleanError) {
      console.warn('Failed to fetch clean side views for hand extraction:', {
        message: cleanError.message,
        error: cleanError,
        params: {
          hauntId,
          collateral,
          numericTraitsLength: numericTraits?.length,
          tokenId
        }
      })
      // Don't fail the whole operation if this fails
      // We'll extract hands from the regular side views instead
      cleanSideViews.value = {}
    }
    
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
    
    console.log('Side views summary:', {
      availableViews: newViews,
      sideViewsKeys: Object.keys(newSideViews),
      sideViewsCount: Object.keys(newSideViews).length,
      newViewsCount: newViews.length
    })
    
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
// NEW APPROACH: Use clean base Gotchi parts extracted from previewSideAavegotchi with neutral traits
async function parseAllViewsBreakdown() {
  try {
    if (!gotchiData.value) {
      console.warn('parseAllViewsBreakdown: No gotchiData available')
      return
    }
    
    console.log('Starting parseAllViewsBreakdown...')
    const breakdown = {}
    const equippedWearables = gotchiData.value.equippedWearables || []
  
  // Helper function to create element data from SVG string
  const createElementFromSvg = (svgString, partName, viewName = 'Unknown') => {
    if (!svgString) {
      console.log(`[${viewName}] createElementFromSvg: No SVG string for ${partName}`)
      return null
    }
    
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgString, 'image/svg+xml')
    const svgElement = doc.documentElement
    const firstChild = svgElement.firstElementChild
    
    if (!firstChild) {
      console.log(`[${viewName}] createElementFromSvg: No firstChild for ${partName}, SVG length: ${svgString.length}`)
      return null
    }
    
    // Calculate offset and dimension
    // Default values to prevent errors
    let offsetX = 0
    let offsetY = 0
    let computedWidth = 64
    let computedHeight = 64
    
    // Try to get from attributes
    const xAttr = firstChild.getAttribute('x')
    const yAttr = firstChild.getAttribute('y')
    const widthAttr = firstChild.getAttribute('width')
    const heightAttr = firstChild.getAttribute('height')
    
    if (xAttr !== null) offsetX = parseFloat(xAttr) || 0
    if (yAttr !== null) offsetY = parseFloat(yAttr) || 0
    if (widthAttr !== null) computedWidth = parseFloat(widthAttr) || 64
    if (heightAttr !== null) computedHeight = parseFloat(heightAttr) || 64
    
    // Use viewBox as fallback
    const viewBox = svgElement.getAttribute('viewBox')
    if (viewBox && (computedWidth === 64 || computedHeight === 64)) {
      const vbParts = viewBox.split(/\s+/).map(Number).filter(n => !isNaN(n))
      if (vbParts.length >= 4) {
        if (computedWidth === 64) computedWidth = vbParts[2] || 64
        if (computedHeight === 64) computedHeight = vbParts[3] || 64
      }
    }
    
    // Extract fill colors
    let primaryFill = firstChild.getAttribute('fill') || null
    if (!primaryFill) {
      const path = firstChild.querySelector('path[fill]')
      if (path) primaryFill = path.getAttribute('fill')
    }
    
    return {
      tag: firstChild.tagName.toLowerCase(),
      attributes: {
        class: firstChild.getAttribute('class') || '',
        ...Object.fromEntries(
          Array.from(firstChild.attributes).map(attr => [attr.name, attr.value])
        )
      },
      offset: { x: offsetX, y: offsetY },
      dimension: { width: computedWidth, height: computedHeight },
      primaryFill: primaryFill,
      secondaryFill: null,
      transform: firstChild.getAttribute('transform') || null,
      svgCode: svgString,
      partName: partName
    }
  }
  
  // Helper to create breakdown structure
  const createBreakdown = (baseParts, viewName) => {
    const parts = {
      'Background': { elements: [] },
      'Body': { elements: [] },
      'Mouth': { elements: [] },
      'Eyes': { elements: [] },
      'Collateral': { elements: [] },
      'Hands': { elements: [] },
      'Shadow': { elements: [] },
      'Other': { elements: [] }
    }
    
    // Add base Gotchi parts
    if (baseParts.Background) {
      const el = createElementFromSvg(baseParts.Background, 'Background', viewName)
      if (el) parts.Background.elements.push(el)
    }
    
    if (baseParts.Body) {
      console.log(`[${viewName}] Body SVG content for breakdown:`, baseParts.Body)
      // Check if white fill path is present
      const bodyParser = new DOMParser()
      const bodyDoc = bodyParser.parseFromString(baseParts.Body, 'image/svg+xml')
      const whiteFillPaths = bodyDoc.querySelectorAll('path[fill="#fff"], path[fill="#ffffff"]')
      console.log(`[${viewName}] Body contains ${whiteFillPaths.length} white fill path(s)`)
      if (whiteFillPaths.length > 0) {
        whiteFillPaths.forEach((path, idx) => {
          const pathData = path.getAttribute('d') || ''
          console.log(`[${viewName}] Body white fill path ${idx + 1}: length=${pathData.length}, pathData="${pathData.substring(0, 50)}..."`)
        })
      }
      const el = createElementFromSvg(baseParts.Body, 'Body', viewName)
      if (el) parts.Body.elements.push(el)
    }
    
    if (baseParts.Mouth) {
      const el = createElementFromSvg(baseParts.Mouth, 'Mouth', viewName)
      if (el) parts.Mouth.elements.push(el)
    }
    
    if (baseParts.Eyes) {
      const el = createElementFromSvg(baseParts.Eyes, 'Eyes', viewName)
      if (el) parts.Eyes.elements.push(el)
    }
    
    if (baseParts.Collateral) {
      const el = createElementFromSvg(baseParts.Collateral, 'Collateral', viewName)
      if (el) parts.Collateral.elements.push(el)
    }
    
    if (baseParts.Hands) {
      console.log(`[${viewName}] Processing Hands for breakdown, hands SVG length:`, baseParts.Hands.length)
      console.log(`[${viewName}] Hands SVG content:`, baseParts.Hands)
      // Hands contain multiple groups - extract all of them, not just firstElementChild
      const parser = new DOMParser()
      const doc = parser.parseFromString(baseParts.Hands, 'image/svg+xml')
      const svgElement = doc.documentElement
      const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
      const serializer = new XMLSerializer()
      
      // Extract all hand groups (skip style element)
      // Include both standard hand groups (gotchi-handsDownClosed, etc.) and wearable hand groups (gotchi-hand-wearable)
      const handGroups = Array.from(svgElement.children).filter(el => {
        if (el.tagName !== 'g') return false
        const className = (el.getAttribute('class') || '').toLowerCase()
        return className.includes('gotchi-hand') || 
               className.includes('gotchi-handsdownclosed') ||
               className.includes('gotchi-handsdownopen') ||
               className.includes('gotchi-handsup')
      })
      
      // Separate white fill groups from primary/secondary groups
      const whiteFillGroups = []
      const primaryGroups = []
      const standardGroups = [] // Standard hand groups like gotchi-handsDownClosed
      
      handGroups.forEach(group => {
        const className = (group.getAttribute('class') || '').toLowerCase()
        const hasWhiteFill = group.querySelector('path[fill="#fff"], path[fill="#ffffff"]')
        const hasPrimary = group.querySelector('.gotchi-primary, path[class*="gotchi-primary"]')
        const hasSecondary = group.querySelector('.gotchi-secondary, path[class*="gotchi-secondary"], g[class*="gotchi-secondary"]')
        const isWhiteFillOnly = hasWhiteFill && !hasPrimary && !hasSecondary
        const isPrimaryGroup = hasPrimary || hasSecondary
        const isStandardGroup = className.includes('gotchi-handsdownclosed') || 
                                className.includes('gotchi-handsdownopen') || 
                                className.includes('gotchi-handsup')
        
        if (isStandardGroup) {
          standardGroups.push(group)
        } else if (isWhiteFillOnly) {
          whiteFillGroups.push(group)
        } else if (isPrimaryGroup) {
          primaryGroups.push(group)
        } else {
          // Fallback: add to primary groups
          primaryGroups.push(group)
        }
      })
      
      console.log(`[${viewName}] Hand groups classification:`, {
        total: handGroups.length,
        standard: standardGroups.length,
        whiteFillOnly: whiteFillGroups.length,
        primary: primaryGroups.length,
        handGroupsTypes: handGroups.map(g => ({
          class: g.getAttribute('class'),
          hasWhiteFill: !!g.querySelector('path[fill="#fff"], path[fill="#ffffff"]'),
          hasPrimary: !!g.querySelector('.gotchi-primary, path[class*="gotchi-primary"]'),
          hasSecondary: !!g.querySelector('.gotchi-secondary, path[class*="gotchi-secondary"], g[class*="gotchi-secondary"]')
        }))
      })
      
      // Combine white fill groups with their corresponding primary groups
      // For side views, combine white fill + primary into single groups
      const combinedGroups = []
      
      // First, add standard groups as-is (front/back views)
      standardGroups.forEach(group => {
        combinedGroups.push(group)
      })
      
      // Then, combine white fill + primary groups for side views
      // Match white fill groups with primary groups - if counts match, combine by index
      // Otherwise, try proximity matching
      const processedWhiteFill = new Set()
      const processedPrimary = new Set()
      
      console.log(`[${viewName}] Attempting to combine ${whiteFillGroups.length} white fill groups with ${primaryGroups.length} primary groups`)
      
      whiteFillGroups.forEach((whiteFillGroup, wfIdx) => {
        if (processedWhiteFill.has(wfIdx)) return
        
        const whiteFillPath = whiteFillGroup.querySelector('path[fill="#fff"], path[fill="#ffffff"]')
        if (!whiteFillPath) {
          console.log(`[${viewName}] White fill group ${wfIdx} has no white fill path`)
          return
        }
        
        const whiteFillData = whiteFillPath.getAttribute('d') || ''
        const whiteFillMatch = whiteFillData.match(/M\s*(\d+)\s*(\d+)/)
        if (!whiteFillMatch) {
          console.log(`[${viewName}] White fill group ${wfIdx} path data has no start coordinates`)
          return
        }
        
        const whiteFillX = parseInt(whiteFillMatch[1])
        const whiteFillY = parseInt(whiteFillMatch[2])
        
        // Try to match by index first (if counts match)
        let matchedPrimary = null
        let matchedIdx = -1
        
        if (whiteFillGroups.length === primaryGroups.length && !processedPrimary.has(wfIdx)) {
          // Same count - match by index
          matchedPrimary = primaryGroups[wfIdx]
          matchedIdx = wfIdx
          console.log(`[${viewName}] Matching white fill group ${wfIdx} with primary group ${wfIdx} (by index)`)
        } else {
          // Find nearest primary group by proximity
          let minDistance = Infinity
          
          primaryGroups.forEach((primaryGroup, pIdx) => {
            if (processedPrimary.has(pIdx)) return
            
            const primaryPath = primaryGroup.querySelector('.gotchi-primary, path[class*="gotchi-primary"]')
            if (!primaryPath) return
            
            const primaryData = primaryPath.getAttribute('d') || ''
            const primaryMatch = primaryData.match(/M\s*(\d+)\s*(\d+)/)
            if (!primaryMatch) return
            
            const primaryX = parseInt(primaryMatch[1])
            const primaryY = parseInt(primaryMatch[2])
            
            const distance = Math.sqrt(Math.pow(primaryX - whiteFillX, 2) + Math.pow(primaryY - whiteFillY, 2))
            
            if (distance < minDistance) {
              minDistance = distance
              matchedPrimary = primaryGroup
              matchedIdx = pIdx
            }
          })
          
          if (matchedPrimary && minDistance <= 20) { // Increased threshold to 20px
            console.log(`[${viewName}] Matching white fill group ${wfIdx} with primary group ${matchedIdx} (distance: ${minDistance.toFixed(1)}px)`)
          } else {
            console.log(`[${viewName}] No match found for white fill group ${wfIdx} (min distance: ${minDistance === Infinity ? 'N/A' : minDistance.toFixed(1)}px)`)
          }
        }
        
        // Combine if found a matching primary group
        if (matchedPrimary) {
          // Create combined group
          const combinedGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
          combinedGroup.setAttribute('class', 'gotchi-hand-wearable')
          
          // Extract all children from primary group and separate by type
          const primaryClone = matchedPrimary.cloneNode(true)
          const primaryChildren = Array.from(primaryClone.children)
          
          // Separate into primary paths, secondary groups, and white fill (if any)
          const primaryPaths = []
          const secondaryGroups = []
          const secondaryPaths = []
          const whiteFillPaths = []
          
          primaryChildren.forEach(child => {
            if (child.tagName === 'path') {
              const fill = child.getAttribute('fill') || ''
              const classes = (child.getAttribute('class') || '').toLowerCase()
              if (fill === '#fff' || fill === '#ffffff') {
                whiteFillPaths.push(child)
              } else if (classes.includes('gotchi-secondary')) {
                secondaryPaths.push(child)
              } else {
                primaryPaths.push(child)
              }
            } else if (child.tagName === 'g') {
              const classes = (child.getAttribute('class') || '').toLowerCase()
              if (classes.includes('gotchi-secondary')) {
                secondaryGroups.push(child)
              } else {
                // Other groups, add as primary
                primaryPaths.push(child)
              }
            }
          })
          
          // Extract white fill paths from white fill group
          const whiteFillClone = whiteFillGroup.cloneNode(true)
          Array.from(whiteFillClone.children).forEach(child => {
            if (child.tagName === 'path') {
              whiteFillPaths.push(child)
            }
          })
          
          // Add in correct z-order: primary first (bottom), then white fill (middle), then secondary (top)
          // This ensures secondary (light pink) is visible on top of white fill
          primaryPaths.forEach(p => combinedGroup.appendChild(p.cloneNode(true)))
          whiteFillPaths.forEach(p => combinedGroup.appendChild(p.cloneNode(true)))
          secondaryGroups.forEach(g => combinedGroup.appendChild(g.cloneNode(true)))
          secondaryPaths.forEach(p => combinedGroup.appendChild(p.cloneNode(true)))
          
          console.log(`[${viewName}] ✓ Combined white fill group ${wfIdx} with primary group ${matchedIdx}`, {
            primaryPaths: primaryPaths.length,
            whiteFillPaths: whiteFillPaths.length,
            secondaryGroups: secondaryGroups.length,
            secondaryPaths: secondaryPaths.length,
            order: 'primary -> white fill -> secondary'
          })
          combinedGroups.push(combinedGroup)
          processedWhiteFill.add(wfIdx)
          processedPrimary.add(matchedIdx)
        } else {
          // No matching primary group found, add white fill as-is
          console.log(`[${viewName}] No match for white fill group ${wfIdx}, adding as-is`)
          combinedGroups.push(whiteFillGroup)
          processedWhiteFill.add(wfIdx)
        }
      })
      
      // Add remaining primary groups that weren't combined
      primaryGroups.forEach((group, idx) => {
        if (!processedPrimary.has(idx)) {
          console.log(`[${viewName}] Adding uncombined primary group ${idx}`)
          combinedGroups.push(group)
        }
      })
      
      console.log(`[${viewName}] Final combined groups count: ${combinedGroups.length} (was ${handGroups.length} before combining)`)
      
      // Create element for each combined group
      combinedGroups.forEach((group, index) => {
        // Create a wrapper SVG for this group
        const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        wrapper.setAttribute('viewBox', viewBox)
        
        // Include style if it exists (for colors)
        const styleElement = svgElement.querySelector('style')
        if (styleElement) {
          wrapper.appendChild(styleElement.cloneNode(true))
        }
        
        wrapper.appendChild(group.cloneNode(true))
        const groupSvg = serializer.serializeToString(wrapper)
        
        const el = createElementFromSvg(groupSvg, `Hands-${index}`, viewName)
        if (el) parts.Hands.elements.push(el)
      })
      
      // If no groups found, try to extract as single element (fallback)
      if (handGroups.length === 0) {
        const el = createElementFromSvg(baseParts.Hands, 'Hands', viewName)
        if (el) parts.Hands.elements.push(el)
      }
    }
    
    if (baseParts.Shadow) {
      const el = createElementFromSvg(baseParts.Shadow, 'Shadow', viewName)
      if (el) parts.Shadow.elements.push(el)
    }
    
    // Extract wearables from the actual SVG (with wearables)
    // For now, return empty array - wearables will be extracted separately later
    // The template expects an array of wearable objects with: slot, slotName, className, wearableId, elements
    const wearables = []
    
    return {
      parts,
      wearables
    }
  }
  
    // Use base Gotchi parts from clean front view for Front view
    // If base parts weren't extracted (clean views failed), extract from front SVG as fallback
    let frontBaseParts = baseGotchiPartsByView.value['Front']
    if (!frontBaseParts || Object.keys(frontBaseParts).length === 0) {
      if (svgViews.value) {
        console.log('[Front] Base parts not available from clean fetch, extracting from front SVG as fallback')
        frontBaseParts = extractBaseParts(svgViews.value, 'Front')
        baseGotchiPartsByView.value['Front'] = frontBaseParts // Store for future use
      } else {
        console.warn('[Front] No base parts available and no front SVG to extract from')
        frontBaseParts = {}
      }
    } else {
      console.log('[Front] Using base parts from clean fetch')
    }
  
    if (Object.keys(frontBaseParts).length > 0) {
      console.log('Creating Front view breakdown from base Gotchi parts')
      breakdown['Front'] = createBreakdown(frontBaseParts, 'Front')
      console.log('Front view breakdown:', {
        parts: Object.keys(breakdown['Front'].parts).map(k => ({
          name: k,
          count: breakdown['Front'].parts[k].elements.length
        }))
      })
    } else {
      console.warn('No base Gotchi parts available for Front view breakdown')
    }
  
    // For side views, use per-view parts from clean fetch
    for (const [viewName, svgString] of Object.entries(sideViews.value)) {
      if (svgString) {
        let sideBaseParts = {} // Declare outside try block for error handling
        try {
          console.log(`\n========== PARSING ${viewName.toUpperCase()} VIEW ==========`)
          
          // First, try to use parts from clean fetch (already extracted per view)
          if (baseGotchiPartsByView.value[viewName] && Object.keys(baseGotchiPartsByView.value[viewName]).length > 0) {
            console.log(`[${viewName}] Using base parts from clean fetch`)
            sideBaseParts = baseGotchiPartsByView.value[viewName]
          } else if (cleanSideViews.value[viewName]) {
            // Fallback: extract from clean side view if available but not yet extracted
            console.log(`[${viewName}] Clean side view available but parts not extracted, extracting now...`)
            sideBaseParts = extractBaseParts(cleanSideViews.value[viewName], viewName)
            baseGotchiPartsByView.value[viewName] = sideBaseParts // Store for future use
          } else {
            // Fallback: extract from regular side view SVG (wearables will be removed during extraction)
            console.log(`[${viewName}] Clean side view not available, extracting base parts from regular side view SVG (wearables will be filtered out)`)
            sideBaseParts = extractBaseParts(svgString, viewName)
          }
          
          // Log what was extracted
          console.log(`[${viewName}] Using base parts:`, {
            source: baseGotchiPartsByView.value[viewName] ? 'clean fetch' : cleanSideViews.value[viewName] ? 'clean view extraction' : 'regular view extraction',
            keys: Object.keys(sideBaseParts),
            hasBackground: !!sideBaseParts.Background,
            hasBody: !!sideBaseParts.Body,
            hasMouth: !!sideBaseParts.Mouth,
            hasEyes: !!sideBaseParts.Eyes,
            hasCollateral: !!sideBaseParts.Collateral,
            hasHands: !!sideBaseParts.Hands,
            hasShadow: !!sideBaseParts.Shadow,
            handsLength: sideBaseParts.Hands ? sideBaseParts.Hands.length : 0
          })
          
          // Only fallback to Front parts if side view parts don't exist at all (not if extraction failed)
          // This ensures side views use their own structure, not Front view structure
          if (Object.keys(sideBaseParts).length === 0 && baseGotchiPartsByView.value['Front']) {
            console.warn(`[${viewName}] No parts extracted for ${viewName} view, falling back to Front view parts (may not match side view structure)`)
            sideBaseParts = baseGotchiPartsByView.value['Front']
          }
          
          breakdown[viewName] = createBreakdown(sideBaseParts, viewName)
          
          console.log(`[${viewName}] Breakdown:`, {
            parts: Object.keys(breakdown[viewName].parts).map(k => ({
              name: k,
              count: breakdown[viewName].parts[k].elements.length
            }))
          })
          
          console.log(`========== END ${viewName.toUpperCase()} VIEW ==========\n`)
        } catch (err) {
          console.error(`Error parsing ${viewName} view breakdown:`, err)
          console.error(`Error stack:`, err.stack)
          // Still try to create breakdown with what we have
          try {
            breakdown[viewName] = createBreakdown(sideBaseParts || {}, viewName)
            console.log(`[${viewName}] Created breakdown after error (fallback)`)
          } catch (fallbackErr) {
            console.error(`[${viewName}] Fallback breakdown creation also failed:`, fallbackErr)
          }
        }
      }
    }
  
  // Ensure all available views have a breakdown (even if empty)
  for (const viewName of availableViews.value) {
    if (!breakdown[viewName]) {
      console.warn(`No breakdown created for ${viewName}, creating empty structure`)
      breakdown[viewName] = {
        parts: {
          'Background': { elements: [] },
          'Body': { elements: [] },
          'Mouth': { elements: [] },
          'Eyes': { elements: [] },
          'Collateral': { elements: [] },
          'Hands': { elements: [] },
          'Shadow': { elements: [] },
          'Other': { elements: [] }
        },
        wearables: []
      }
    }
  }
  
    breakdownByView.value = breakdown
    console.log('Parsed breakdown for all views:', Object.keys(breakdown))
    console.log('Breakdown structure check:', {
      Front: breakdown['Front'] ? 'exists' : 'missing',
      Left: breakdown['Left'] ? 'exists' : 'missing',
      Right: breakdown['Right'] ? 'exists' : 'missing',
      Back: breakdown['Back'] ? 'exists' : 'missing'
    })
    console.log('parseAllViewsBreakdown completed successfully')
  } catch (error) {
    console.error('Error in parseAllViewsBreakdown:', error)
    // Ensure breakdownByView is set even on error (empty structure)
    breakdownByView.value = {
      Front: {
        parts: {
          'Background': { elements: [] },
          'Body': { elements: [] },
          'Mouth': { elements: [] },
          'Eyes': { elements: [] },
          'Collateral': { elements: [] },
          'Hands': { elements: [] },
          'Shadow': { elements: [] },
          'Other': { elements: [] }
        },
        wearables: []
      }
    }
  }
}

  // Extract base Gotchi parts from clean SVG (without wearables)
  // If the SVG contains wearables, they will be removed before extraction
  function extractBaseParts(cleanSvgString, viewName = 'Unknown') {
    if (!cleanSvgString) return {}
    
    console.log(`\n[extractBaseParts] Extracting parts for view: ${viewName}`)
    
    const parser = new DOMParser()
    const doc = parser.parseFromString(cleanSvgString, 'image/svg+xml')
    const svgElement = doc.documentElement
    const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
    
    const parts = {}
  
  // Note: In side views, base parts might be marked as gotchi-wearable
  // We'll extract base parts first, then remove only actual wearable items
  // Don't remove elements that are base parts (body, mouth) even if they have wearable classes
  
  // Helper to extract and wrap element - supports multiple selectors for front/side views
  const extractPart = (selectors, partName) => {
    // selectors can be a string or array of strings
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors]
    
    console.log(`  [${viewName}] Trying to extract ${partName} with ${selectorArray.length} selector(s):`, selectorArray)
    
    for (const selector of selectorArray) {
      const element = doc.querySelector(selector)
      if (element) {
        console.log(`    ✓ Found ${partName} using selector: ${selector}`)
        const clone = element.cloneNode(true)
        const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        wrapper.setAttribute('viewBox', viewBox)
        wrapper.appendChild(clone)
        const serializer = new XMLSerializer()
        const result = serializer.serializeToString(wrapper)
        console.log(`    ✓ ${partName} extracted successfully (length: ${result.length})`)
        return result
      } else {
        console.log(`    ✗ ${partName} not found with selector: ${selector}`)
      }
    }
    console.log(`    ✗ ${partName} not found with any of the ${selectorArray.length} selector(s)`)
    return ''
  }
  
  // Extract Background
  console.log(`  [${viewName}] Extracting Background...`)
  const bgElement = doc.querySelector('g.gotchi-bg')
  if (bgElement) {
    console.log(`    ✓ Found Background using selector: g.gotchi-bg`)
    const clone = bgElement.cloneNode(true)
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    wrapper.setAttribute('viewBox', viewBox)
    wrapper.appendChild(clone)
    const serializer = new XMLSerializer()
    parts.Background = serializer.serializeToString(wrapper)
    console.log(`    ✓ Background extracted successfully (length: ${parts.Background.length})`)
  } else {
    console.log(`    ✗ Background not found with selector: g.gotchi-bg`)
  }
  
  // Extract Body - try multiple selectors for front and side views
  // In side views, body might be marked as gotchi-wearable, so also check for that
  console.log(`  [${viewName}] Extracting Body...`)
  const bodyGroup = doc.querySelector('g.gotchi-body, g[class*="gotchi-bodyLeft"], g[class*="gotchi-bodyRight"], g.gotchi-bodyLeft, g.gotchi-bodyRight')
  
  if (bodyGroup) {
    // Extract the entire body group including all paths (primary, secondary, and white fill)
    console.log(`    ✓ Found body group: ${bodyGroup.getAttribute('class')}`)
    const bodyPaths = Array.from(bodyGroup.querySelectorAll('path'))
    console.log(`    Found ${bodyPaths.length} path(s) inside body group`)
    
    // Verify all paths are included (primary, secondary, and white fill)
    bodyPaths.forEach((path, idx) => {
      const classes = path.getAttribute('class') || ''
      const fill = path.getAttribute('fill') || ''
      const pathData = path.getAttribute('d') || ''
      const hasPrimary = classes.includes('gotchi-primary')
      const hasSecondary = classes.includes('gotchi-secondary')
      const hasWhiteFill = fill === '#fff' || fill === '#ffffff'
      console.log(`      Path ${idx + 1}: classes="${classes}", fill="${fill}", hasPrimary=${hasPrimary}, hasSecondary=${hasSecondary}, hasWhiteFill=${hasWhiteFill}, length=${pathData.length}`)
    })
    
    // Reorder paths: primary -> secondary -> white fill (white fill on top)
    // Sort paths by type before cloning
    const sortedPaths = [...bodyPaths].sort((a, b) => {
      const aClasses = (a.getAttribute('class') || '').toLowerCase()
      const bClasses = (b.getAttribute('class') || '').toLowerCase()
      const aFill = a.getAttribute('fill') || ''
      const bFill = b.getAttribute('fill') || ''
      
      const aIsPrimary = aClasses.includes('gotchi-primary')
      const bIsPrimary = bClasses.includes('gotchi-primary')
      const aIsSecondary = aClasses.includes('gotchi-secondary')
      const bIsSecondary = bClasses.includes('gotchi-secondary')
      const aIsWhiteFill = aFill === '#fff' || aFill === '#ffffff'
      const bIsWhiteFill = bFill === '#fff' || bFill === '#ffffff'
      
      // Primary first (bottom layer)
      if (aIsPrimary && !bIsPrimary) return -1
      if (!aIsPrimary && bIsPrimary) return 1
      
      // Secondary second (middle layer)
      if (aIsSecondary && !bIsSecondary) return -1
      if (!aIsSecondary && bIsSecondary) return 1
      
      // White fill last (top layer)
      if (aIsWhiteFill && !bIsWhiteFill) return 1
      if (!aIsWhiteFill && bIsWhiteFill) return -1
      
      return 0
    })
    
    // Create new body group with sorted paths
    const newBodyGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    newBodyGroup.setAttribute('class', bodyGroup.getAttribute('class') || 'gotchi-body')
    
    // Ensure white fill paths use #ffffff format
    sortedPaths.forEach(path => {
      const clonedPath = path.cloneNode(true)
      const fill = clonedPath.getAttribute('fill')
      if (fill === '#fff' || fill === '#ffffff') {
        clonedPath.setAttribute('fill', '#ffffff')
        // Remove conflicting classes
        const classes = clonedPath.getAttribute('class') || ''
        if (classes.includes('gotchi-primary') || classes.includes('gotchi-secondary')) {
          const newClasses = classes.split(' ').filter(c => !c.includes('gotchi-primary') && !c.includes('gotchi-secondary')).join(' ')
          clonedPath.setAttribute('class', newClasses || 'gotchi-wearable')
        }
      }
      newBodyGroup.appendChild(clonedPath)
    })
    
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    wrapper.setAttribute('viewBox', viewBox)
    
    // Include style element if it exists
    const styleElement = doc.querySelector('style')
    if (styleElement) {
      const styleClone = styleElement.cloneNode(true)
      wrapper.appendChild(styleClone)
    }
    
    wrapper.appendChild(newBodyGroup)
    const serializer = new XMLSerializer()
    parts.Body = serializer.serializeToString(wrapper)
    
    // Verify white fill path is included in the extracted body
    const extractedDoc = new DOMParser().parseFromString(parts.Body, 'image/svg+xml')
    const whiteFillInExtracted = extractedDoc.querySelectorAll('path[fill="#fff"], path[fill="#ffffff"]')
    console.log(`    ✓ Body extracted successfully (length: ${parts.Body.length}, includes ${whiteFillInExtracted.length} white fill path(s))`)
    
    if (whiteFillInExtracted.length === 0 && bodyPaths.some(p => p.getAttribute('fill') === '#fff' || p.getAttribute('fill') === '#ffffff')) {
      console.warn(`    ⚠️  Warning: White fill path was in source but not found in extracted body!`)
    }
  } else {
    // Try using extractPart as fallback
    parts.Body = extractPart([
      'g.gotchi-body',
      'g[class*="gotchi-bodyLeft"]',
      'g[class*="gotchi-bodyRight"]',
      'g.gotchi-bodyLeft',
      'g.gotchi-bodyRight'
    ], 'Body')
  }
  
  // If body not found, check for gotchi-wearable paths that are actually the body (side views)
  // These are typically large paths that define the main body shape, not wearable items
  if (!parts.Body) {
    console.log(`    ⚠️  Body not found with standard selectors, trying alternative method...`)
    // Look for path elements with gotchi-wearable that have body-like path data (large, complex paths)
    const bodyPaths = []
    const processedBodyPaths = new Set()
    
    // Find all potential body paths (gotchi-wearable paths, including white fill ones)
    // Also check for white fill paths that might be part of the body
    const allPotentialBodyPaths = doc.querySelectorAll('path[class*="gotchi-wearable"]')
    // Also get white fill paths that might be body-related (they might be siblings of body paths)
    const whiteFillPaths = doc.querySelectorAll('path[fill="#fff"], path[fill="#ffffff"]')
    console.log(`    Found ${allPotentialBodyPaths.length} potential body paths (gotchi-wearable)`)
    console.log(`    Found ${whiteFillPaths.length} white fill paths`)
    
    // First, collect all body paths (primary, secondary, and white fill)
    // Process all gotchi-wearable paths and white fill paths together
    const allPathsToCheck = [...Array.from(allPotentialBodyPaths), ...Array.from(whiteFillPaths)]
    
    for (const path of allPathsToCheck) {
      if (processedBodyPaths.has(path)) continue
      
      const pathData = path.getAttribute('d') || ''
      const classes = (path.getAttribute('class') || '').toLowerCase()
      const fill = path.getAttribute('fill') || ''
      
      // Body paths are typically large and complex (contain "v41" or similar large movements)
      // OR have white fill and are part of the body shape
      const pathDataLower = pathData.toLowerCase()
      const isLargeBodyPath = pathDataLower.includes('v41') || pathDataLower.includes('v39') || pathData.length > 100
      const isWhiteFillBody = (fill === '#fff' || fill === '#ffffff') && 
                             pathData.length > 50 && 
                             (pathDataLower.includes('v41') || pathDataLower.includes('v39') || 
                              pathDataLower.includes('v14') || pathDataLower.includes('v51') ||
                              pathDataLower.includes('v15') || pathDataLower.includes('v50'))
      
      // Check if this is a primary or secondary body path (has gotchi-primary or gotchi-secondary)
      const isPrimarySecondary = classes.includes('gotchi-primary') || classes.includes('gotchi-secondary')
      
      // Check if this is a white fill body path (has white fill and gotchi-wearable, and spans body dimensions)
      // The white fill body path typically spans from y=14 to y=51 (or V14 to V51)
      // Path format: M42,51...V14...V51z or M42,51...V14...51z
      const hasV14 = pathData.includes('V14') || pathData.includes('v14')
      const hasV51 = pathData.includes('V51') || pathData.includes('v51') || 
                    pathData.endsWith('51z') || pathData.endsWith('V51z') ||
                    (pathData.startsWith('M') && pathData.includes(',51')) // M42,51 at start
      // Also check for 14 and 51 as standalone numbers (more lenient for paths that span body height)
      const has14 = pathData.includes('14') || hasV14
      const has51 = pathData.includes('51') || hasV51
      // Body paths span from y=14 to y=51, so they should have both
      const spansBodyHeight = (hasV14 && hasV51) || (has14 && has51 && pathData.length > 60)
      
      const isWhiteFillBodyPath = (fill === '#fff' || fill === '#ffffff') && 
                                 classes.includes('gotchi-wearable') &&
                                 pathData.length > 50 &&
                                 spansBodyHeight
      
      if (isLargeBodyPath || isWhiteFillBody || isPrimarySecondary || isWhiteFillBodyPath) {
        // Check if this looks like a body (not a hand or small wearable)
        // Exclude if it's explicitly a hand wearable (smaller paths in hand area)
        const isHandArea = pathData.includes('40') || pathData.includes('41') || 
                          pathData.includes('42') || pathData.includes('43') || 
                          pathData.includes('44') || pathData.includes('45')
        const isSmallHandPath = pathData.length < 60 && isHandArea && !isPrimarySecondary
        
        // For primary/secondary paths, verify they're actually body paths, not hand paths
        // Body paths start around y=14 and span to y=51, not just in hand area (y=40-45)
        let isActuallyBodyPath = true
        if (isPrimarySecondary) {
          // Body paths start at y=14 (or earlier) and span to y=51
          // Hand paths typically start at y=40-45 and don't span the full body height
          const startsAt14 = pathData.includes('14') || pathData.includes('V14') || pathData.includes('v14')
          const startsInHandArea = pathData.match(/M\d+[,\s]+(4[0-5])/) // Matches M25,44 or M25 44 (hand area)
          const spansTo51 = pathData.includes('51') || pathData.includes('V51') || pathData.includes('v51')
          
          // If it starts in hand area (y=40-45) and doesn't span to body bottom, it's likely a hand
          if (startsInHandArea && !spansTo51) {
            isActuallyBodyPath = false
            console.log(`    ✗ Excluding hand path from body: starts in hand area (y=40-45) but doesn't span to y=51`)
          }
          // If it's a primary/secondary path but doesn't start at y=14 and doesn't span to y=51, it might be a hand
          else if (!startsAt14 && !spansTo51 && isHandArea) {
            isActuallyBodyPath = false
            console.log(`    ✗ Excluding hand path from body: doesn't span body height (14-51)`)
          }
        }
        
        if (!classes.includes('wearable-hand') && 
            !classes.includes('wearable-pet') &&
            !classes.includes('wearable-face') &&
            !classes.includes('wearable-eyes') &&
            !isSmallHandPath &&
            isActuallyBodyPath) {
          console.log(`    Adding body path: length=${pathData.length}, fill="${fill}", classes="${classes}", isPrimarySecondary=${isPrimarySecondary}, isWhiteFillBodyPath=${isWhiteFillBodyPath}`)
          bodyPaths.push(path)
          processedBodyPaths.add(path)
        } else if (!isActuallyBodyPath) {
          console.log(`    ✗ Skipped: looks like a hand path, not a body path`)
        }
      }
    }
    
    // After collecting body paths, ensure we have all related white fill paths
    // Check all white fill paths that span body height and are part of the body (not hands)
    for (const whitePath of whiteFillPaths) {
      if (processedBodyPaths.has(whitePath)) continue
      
      const whiteData = whitePath.getAttribute('d') || ''
      const whiteClasses = (whitePath.getAttribute('class') || '').toLowerCase()
      const whiteFill = whitePath.getAttribute('fill') || ''
      
      // Check if this white fill path is a body path
      // Must have: gotchi-wearable class, spans body height (14-51), reasonable size, not a hand
      // White fill body paths typically span from y=14 to y=51 (or start at y=51 and have V14)
      // The path format is like: M42,51...V14...V51z or M42,51...V14...51z
      const whiteHasV14 = whiteData.includes('V14') || whiteData.includes('v14')
      // Check for V51 at end, or ,51 at start, or 51z at end, or V51 in the middle
      const whiteHasV51 = whiteData.includes('V51') || whiteData.includes('v51') || 
                         whiteData.startsWith('M') && whiteData.includes(',51') || // M42,51 at start
                         whiteData.endsWith('51z') || whiteData.endsWith('V51z') ||
                         whiteData.match(/[,\s]51[^0-9]/) || whiteData.match(/51z/)
      // Also check if path contains both 14 and 51 as standalone numbers (more lenient)
      const has14 = whiteData.includes('14') || whiteData.includes('V14') || whiteData.includes('v14')
      const has51 = whiteData.includes('51') || whiteData.includes('V51') || whiteData.includes('v51')
      const spansBodyHeight = (whiteHasV14 && whiteHasV51) || (has14 && has51 && whiteData.length > 60)
      
      console.log(`    Checking white fill path: length=${whiteData.length}, hasV14=${whiteHasV14}, hasV51=${whiteHasV51}, has14=${has14}, has51=${has51}, spansBodyHeight=${spansBodyHeight}, classes="${whiteClasses}"`)
      
      // Check if it's in hand area (smaller white fill paths in hand area are NOT body)
      // Body white fill paths are typically 70+ characters and span the full height
      const isHandArea = (whiteData.includes('40') || whiteData.includes('41') || 
                         whiteData.includes('42') || whiteData.includes('43') || 
                         whiteData.includes('44') || whiteData.includes('45')) &&
                        !whiteData.includes('14') // Body paths span from 14-51, not just 40-45
      const isSmallHandPath = whiteData.length < 60 && isHandArea
      
      // White fill body paths are typically 70+ chars and span the full body height
      const isLargeBodyFill = whiteData.length >= 70 && spansBodyHeight
      
      const isBodyWhiteFill = (whiteFill === '#fff' || whiteFill === '#ffffff') &&
                             whiteClasses.includes('gotchi-wearable') &&
                             ((whiteData.length > 50 && spansBodyHeight) || isLargeBodyFill) &&
                             !whiteClasses.includes('wearable-hand') &&
                             !whiteClasses.includes('wearable-face') &&
                             !isSmallHandPath
      
      if (isBodyWhiteFill) {
        console.log(`    Adding white fill body path (length: ${whiteData.length}, spans body height: ${spansBodyHeight})`)
        bodyPaths.push(whitePath)
        processedBodyPaths.add(whitePath)
      }
    }
    
    // Also check for standalone white fill body paths (in case they don't have gotchi-wearable class)
    // Also check for white fill paths that are siblings of body paths (they might be in the same group)
    if (bodyPaths.length > 0) {
      // If we found body paths, also look for white fill paths that are siblings or in the same parent group
      for (const bodyPath of bodyPaths) {
        const parentGroup = bodyPath.parentElement
        if (parentGroup && parentGroup.tagName === 'g') {
          // Check all paths in the same group
          const siblingPaths = parentGroup.querySelectorAll('path[fill="#fff"], path[fill="#ffffff"]')
          siblingPaths.forEach(sibling => {
            if (!processedBodyPaths.has(sibling)) {
              const siblingData = sibling.getAttribute('d') || ''
              // Include white fill paths that are reasonable size (likely body parts, not tiny details)
              if (siblingData.length > 30) {
                console.log(`    Found white fill sibling path in body group (length: ${siblingData.length})`)
                bodyPaths.push(sibling)
                processedBodyPaths.add(sibling)
              }
            }
          })
        }
      }
    } else {
      // No body paths found yet, check standalone white fill paths
      for (const path of whiteFillPaths) {
        if (processedBodyPaths.has(path)) continue
        
        const pathData = path.getAttribute('d') || ''
        const pathDataLower = pathData.toLowerCase()
        const fill = path.getAttribute('fill') || ''
        const classes = (path.getAttribute('class') || '').toLowerCase()
        
        // Check if this is a white fill body path
        // Include paths that:
        // 1. Have white fill and gotchi-wearable class (likely body fill)
        // 2. Are reasonably sized (not tiny details)
        // 3. Span vertical distance typical of body (y coordinates around 14-51)
        const hasBodyVerticalRange = pathData.match(/v\d+|V\d+/) && (pathData.includes('51') || pathData.includes('14') || pathData.includes('41'))
        const isWearableBody = classes.includes('gotchi-wearable') && !classes.includes('wearable-hand') && !classes.includes('wearable-face')
        
        if ((fill === '#fff' || fill === '#ffffff') && 
            pathData.length > 30 &&
            (pathDataLower.includes('v14') || pathDataLower.includes('v51') ||
             pathDataLower.includes('v41') || pathDataLower.includes('v39') ||
             hasBodyVerticalRange) &&
            isWearableBody) {
          console.log(`    Found standalone white fill body path (length: ${pathData.length}, classes: ${classes})`)
          bodyPaths.push(path)
          processedBodyPaths.add(path)
        }
      }
    }
    
    // If we found body paths, combine them into a single body element
    // Sort paths in correct z-order: primary first, then secondary, then white fill (white fill on top)
    if (bodyPaths.length > 0) {
      console.log(`    ✓ Found ${bodyPaths.length} body path(s) using alternative method`)
      
      // Sort paths by type: primary -> secondary -> white fill (white fill on top)
      const sortedBodyPaths = [...bodyPaths].sort((a, b) => {
        const aClasses = (a.getAttribute('class') || '').toLowerCase()
        const bClasses = (b.getAttribute('class') || '').toLowerCase()
        const aFill = a.getAttribute('fill') || ''
        const bFill = b.getAttribute('fill') || ''
        
        const aIsPrimary = aClasses.includes('gotchi-primary')
        const bIsPrimary = bClasses.includes('gotchi-primary')
        const aIsSecondary = aClasses.includes('gotchi-secondary')
        const bIsSecondary = bClasses.includes('gotchi-secondary')
        const aIsWhiteFill = aFill === '#fff' || aFill === '#ffffff'
        const bIsWhiteFill = bFill === '#fff' || bFill === '#ffffff'
        
        // Primary first (bottom layer)
        if (aIsPrimary && !bIsPrimary) return -1
        if (!aIsPrimary && bIsPrimary) return 1
        
        // Secondary second (middle layer)
        if (aIsSecondary && !bIsSecondary) return -1
        if (!aIsSecondary && bIsSecondary) return 1
        
        // White fill last (top layer)
        if (aIsWhiteFill && !bIsWhiteFill) return 1
        if (!aIsWhiteFill && bIsWhiteFill) return -1
        
        return 0
      })
      
      // Log the order for debugging
      sortedBodyPaths.forEach((path, idx) => {
        const classes = path.getAttribute('class') || ''
        const fill = path.getAttribute('fill') || ''
        const isPrimary = classes.includes('gotchi-primary')
        const isSecondary = classes.includes('gotchi-secondary')
        const isWhiteFill = fill === '#fff' || fill === '#ffffff'
        console.log(`      Body path ${idx + 1}: ${isPrimary ? 'PRIMARY' : isSecondary ? 'SECONDARY' : isWhiteFill ? 'WHITE FILL' : 'OTHER'} (length: ${(path.getAttribute('d') || '').length})`)
      })
      
      const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      wrapper.setAttribute('viewBox', viewBox)
      
      // Include style element if it exists (needed for colors)
      const styleElement = doc.querySelector('style')
      if (styleElement) {
        const styleClone = styleElement.cloneNode(true)
        wrapper.appendChild(styleClone)
        console.log(`    Included style element in body SVG`)
      }
      
      const bodyGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      bodyGroup.setAttribute('class', 'gotchi-body')
      sortedBodyPaths.forEach((path, idx) => {
        const clonedPath = path.cloneNode(true)
        // Verify white fill is preserved and explicitly set to 6-digit hex
        const fill = clonedPath.getAttribute('fill')
        if (fill === '#fff' || fill === '#ffffff' || fill === 'white') {
          // Ensure fill is explicitly set to 6-digit hex format (not relying on CSS)
          clonedPath.setAttribute('fill', '#ffffff')
          // Remove any class that might override fill
          const classes = clonedPath.getAttribute('class') || ''
          if (classes.includes('gotchi-primary') || classes.includes('gotchi-secondary')) {
            // White fill paths shouldn't have primary/secondary classes that override fill
            const newClasses = classes.split(' ').filter(c => !c.includes('gotchi-primary') && !c.includes('gotchi-secondary')).join(' ')
            clonedPath.setAttribute('class', newClasses || 'gotchi-wearable')
          }
          console.log(`    Adding white fill path ${idx + 1} to body group: fill="#ffffff", classes="${clonedPath.getAttribute('class')}", d="${(clonedPath.getAttribute('d') || '').substring(0, 50)}..."`)
        }
        bodyGroup.appendChild(clonedPath)
      })
      wrapper.appendChild(bodyGroup)
      const serializer = new XMLSerializer()
      parts.Body = serializer.serializeToString(wrapper)
      
      // Log the actual body SVG content to verify white fill
      console.log(`    Body SVG content (first 500 chars):`, parts.Body.substring(0, 500))
      const whiteFillMatch = parts.Body.match(/fill="#fff"/g)
      console.log(`    White fill occurrences in body SVG: ${whiteFillMatch ? whiteFillMatch.length : 0}`)
      
      // Log the full body SVG for debugging
      console.log(`    Full body SVG:`, parts.Body)
      
      // Verify white fill is included
      const extractedDoc = new DOMParser().parseFromString(parts.Body, 'image/svg+xml')
      const whiteFillInExtracted = extractedDoc.querySelectorAll('path[fill="#fff"], path[fill="#ffffff"]')
      console.log(`    ✓ Body extracted using alternative method (length: ${parts.Body.length}, includes ${whiteFillInExtracted.length} white fill path(s))`)

      // Ensure all white fill paths use 6-digit hex format (#ffffff instead of #fff)
      let whiteFillConverted = false
      whiteFillInExtracted.forEach((path, idx) => {
        const pathData = path.getAttribute('d') || ''
        let fillAttr = path.getAttribute('fill') || ''
        const classes = path.getAttribute('class') || ''
        console.log(`      White fill path ${idx + 1}: fill="${fillAttr}", classes="${classes}", length=${pathData.length}, d="${pathData.substring(0, 60)}..."`)
        
        // Convert #fff to #ffffff for better compatibility
        if (fillAttr === '#fff') {
          path.setAttribute('fill', '#ffffff')
          fillAttr = '#ffffff'
          whiteFillConverted = true
          console.log(`      → Converted fill from #fff to #ffffff`)
        }
        
        // Verify fill attribute is explicitly set
        if (!fillAttr || (fillAttr !== '#fff' && fillAttr !== '#ffffff')) {
          console.warn(`      ⚠️  White fill path ${idx + 1} missing fill attribute!`)
        }
      })

      // Re-serialize if we converted any fills
      if (whiteFillConverted) {
        // Re-serialize from the updated document
        parts.Body = serializer.serializeToString(extractedDoc.documentElement)
        console.log(`    → Re-serialized body SVG with converted white fill`)
      }

      if (whiteFillInExtracted.length === 0) {
        const whiteFillCount = bodyPaths.filter(p => {
          const fill = p.getAttribute('fill') || ''
          return fill === '#fff' || fill === '#ffffff'
        }).length
        if (whiteFillCount > 0) {
          console.warn(`    ⚠️  Warning: ${whiteFillCount} white fill path(s) were in source but not found in extracted body!`)
        } else {
          console.warn(`    ⚠️  No white fill paths found in body SVG!`)
        }
      } else {
        // Double-check by searching the serialized string
        const hasWhiteFillInString = parts.Body.includes('fill="#fff"') || parts.Body.includes('fill="#ffffff"')
        console.log(`    ✓ White fill verified in serialized string: ${hasWhiteFillInString}`)
        
        // Ensure we're using #ffffff format
        if (parts.Body.includes('fill="#fff"') && !parts.Body.includes('fill="#ffffff"')) {
          console.warn(`    ⚠️  Warning: Body SVG uses #fff shorthand, consider converting to #ffffff`)
        }
      }
    } else {
      console.log(`    ✗ Body not found using alternative method either`)
    }
  }
  
  // Extract Mouth - try multiple selectors for front and side views
  console.log(`  [${viewName}] Extracting Mouth...`)
  parts.Mouth = extractPart([
    'g.gotchi-primary-mouth',
    'g.gotchi-mouth',
    'g[class*="gotchi-mouthLeft"]',
    'g[class*="gotchi-mouthRight"]',
    'g.gotchi-mouthLeft',
    'g.gotchi-mouthRight'
  ], 'Mouth')
  
  // Extract Cheeks (gotchi-cheek) - may be separate elements
  console.log(`  [${viewName}] Extracting Cheeks...`)
  const cheekElements = doc.querySelectorAll('path.gotchi-cheek, .gotchi-cheek')
  if (cheekElements.length > 0) {
    console.log(`    ✓ Found ${cheekElements.length} cheek element(s)`)
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    wrapper.setAttribute('viewBox', viewBox)
    cheekElements.forEach(el => {
      wrapper.appendChild(el.cloneNode(true))
    })
    const serializer = new XMLSerializer()
    parts.Cheeks = serializer.serializeToString(wrapper)
    console.log(`    ✓ Cheeks extracted successfully (length: ${parts.Cheeks.length})`)
  } else {
    console.log(`    ✗ Cheeks not found`)
  }
  
  // Extract Eyes (gotchi-eyeColor)
  console.log(`  [${viewName}] Extracting Eyes...`)
  parts.Eyes = extractPart('g.gotchi-eyeColor', 'Eyes')
  
  // Extract Collateral
  console.log(`  [${viewName}] Extracting Collateral...`)
  parts.Collateral = extractPart('g.gotchi-collateral', 'Collateral')
  
  // Extract Hands (all variants: gotchi-handsDownClosed, gotchi-handsDownOpen, gotchi-handsUp)
  // EXCLUDE sleeves - they're not hands!
  // Also include side-view variants: gotchi-handLeft, gotchi-handRight, gotchi-handsLeft, gotchi-handsRight
  console.log(`  [${viewName}] Extracting Hands...`)
  const handsElements = []
  
  // Find all hand groups (excluding sleeves)
  const allGroups = doc.querySelectorAll('g[class*="gotchi-hand"]')
  allGroups.forEach(group => {
    const classes = (group.getAttribute('class') || '').toLowerCase()
    // Only include actual hand groups, exclude sleeves
    if ((classes.includes('gotchi-handsdownclosed') ||
         classes.includes('gotchi-handsdownopen') ||
         classes.includes('gotchi-handsup') ||
         classes.includes('gotchi-handleft') ||
         classes.includes('gotchi-handright') ||
         classes.includes('gotchi-handsleft') ||
         classes.includes('gotchi-handsright') ||
         classes.includes('gotchi-hand')) &&
        !classes.includes('sleeve')) {
      handsElements.push(group)
    }
  })
  
  // Also check for specific hand group selectors (including side views)
  const specificHandGroups = [
    doc.querySelector('g.gotchi-handsDownClosed'),
    doc.querySelector('g.gotchi-handsDownOpen'),
    doc.querySelector('g.gotchi-handsUp'),
    doc.querySelector('g[class*="gotchi-handLeft"]'),
    doc.querySelector('g[class*="gotchi-handRight"]'),
    doc.querySelector('g[class*="gotchi-handsLeft"]'),
    doc.querySelector('g[class*="gotchi-handsRight"]')
  ].filter(el => {
    if (!el) return false
    const classes = (el.getAttribute('class') || '').toLowerCase()
    return !classes.includes('sleeve')
  })
  
  // Combine and deduplicate
  let allHands = [...new Set([...handsElements, ...specificHandGroups])]
  
  // If no hands found via standard selectors, check for gotchi-wearable paths that are actually hands (side views)
  // In side views, hands are marked as gotchi-wearable instead of gotchi-handsDownClosed, etc.
  if (allHands.length === 0) {
    console.log(`[${viewName}] No standard hand groups found, checking gotchi-wearable paths for hands...`)
    // Find all paths that might be hands - including those in wearable groups
    // Only include white fill paths that have gotchi-wearable class (not all white fill paths)
    const wearablePaths = Array.from(doc.querySelectorAll('path[class*="gotchi-wearable"]'))
    console.log(`[${viewName}] Found ${wearablePaths.length} gotchi-wearable paths to check`)
    // Also check paths inside wearable groups
    const wearableGroups = doc.querySelectorAll('g[class*="gotchi-wearable"]')
    wearableGroups.forEach(group => {
      const groupPaths = group.querySelectorAll('path')
      groupPaths.forEach(path => {
        if (!wearablePaths.includes(path)) {
          wearablePaths.push(path)
        }
      })
    })
    const handPaths = []
    const processedPaths = new Set()
    
    for (const path of wearablePaths) {
      if (processedPaths.has(path)) continue
      
      const pathData = path.getAttribute('d') || ''
      let classes = (path.getAttribute('class') || '').toLowerCase()
      
      // Also check parent group classes (paths might be inside wearable groups)
      const parentGroup = path.closest('g[class*="gotchi-wearable"]')
      if (parentGroup) {
        const parentClasses = (parentGroup.getAttribute('class') || '').toLowerCase()
        classes += ' ' + parentClasses
      }
      
      // Exclude sleeves and body parts
      if (classes.includes('sleeve')) continue
      
      // Check if this is a white fill body path (should be excluded from hands)
      // Body paths typically have large vertical movements (v41, v39, v51) or span from top to bottom (v14 to v51)
      const fill = path.getAttribute('fill') || ''
      const pathDataLower = pathData.toLowerCase()
      const hasLargeVerticalMovement = pathDataLower.includes('v41') || 
                                      pathDataLower.includes('v39') || 
                                      pathDataLower.includes('v51')
      const spansTopToBottom = pathDataLower.includes('v14') && pathDataLower.includes('v51')
      const isWhiteFillBody = (fill === '#fff' || fill === '#ffffff') && 
                             pathData.length > 50 && 
                             (hasLargeVerticalMovement || spansTopToBottom ||
                              pathDataLower.includes('v15') || pathDataLower.includes('v50'))
      
      // Body paths are large (contain v41/v39 or very long paths) OR are white fill body paths
      if (pathDataLower.includes('v41') || pathDataLower.includes('v39') || pathData.length > 100 || isWhiteFillBody) {
        if (pathData.length >= 20 && pathData.length <= 100) {
          console.log(`[${viewName}] ✗ Skipped as body path:`, {
            pathLength: pathData.length,
            hasV41: pathDataLower.includes('v41'),
            hasV39: pathDataLower.includes('v39'),
            isWhiteFillBody,
            pathData: pathData.substring(0, 50) + '...'
          })
        }
        continue // Skip body paths
      }
      
      // Hand paths are typically:
      // - Medium size (20-100 chars)
      // - Contain hand-like movements (v-4, v-1, h-1, etc.)
      // - Positioned around y=40-44 area (hands are typically in this vertical range)
      // - White fill paths in hand area are also hands (bottom layer)
      const isWhiteFillHand = (fill === '#fff' || fill === '#ffffff') && 
                             pathData.length >= 20 && pathData.length <= 100 &&
                             (pathData.includes('40') || pathData.includes('41') ||
                              pathData.includes('42') || pathData.includes('43') ||
                              pathData.includes('44') || pathData.includes('45'))
      
      if (pathData.length >= 20 && pathData.length <= 100) {
        // Check if it looks like a hand
        // Hands are typically positioned around y=40-45 and have small movements
        const hasHandPosition = pathData.includes('44') || pathData.includes('40') || 
                               pathData.includes('43') || pathData.includes('45') ||
                               pathData.includes('42') || pathData.includes('41')
        const hasHandMovements = pathData.includes('v-4') || pathData.includes('v-1') || 
                                pathData.includes('h-1') || pathData.includes('h-2') ||
                                pathData.includes('v1') || pathData.includes('v2') ||
                                pathData.includes('h1') || pathData.includes('h2')
        
        // Debug logging for potential hand paths
        if (hasHandPosition || hasHandMovements || isWhiteFillHand) {
          console.log(`[${viewName}] Evaluating potential hand path:`, {
            pathLength: pathData.length,
            hasHandPosition,
            hasHandMovements,
            isWhiteFillHand,
            pathData: pathData.substring(0, 50) + '...',
            classes
          })
        }
        
        // If it has hand positioning AND hand movements, it's likely a hand
        // OR if it has hand movements and is in the right size range
        // OR if it's a white fill path in the hand area (bottom layer)
        if ((hasHandPosition && hasHandMovements) || 
            (hasHandMovements && pathData.length >= 30 && pathData.length <= 80) ||
            isWhiteFillHand) {
          console.log(`[${viewName}] ✓ Identified as hand path!`)
          
          // Create a group for this hand
          const handGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
          handGroup.setAttribute('class', 'gotchi-hand-wearable')
          handGroup.appendChild(path.cloneNode(true))
          processedPaths.add(path)
          
          // White fill paths should be in separate groups - don't search for related paths
          if (isWhiteFillHand) {
            handPaths.push(handGroup)
            console.log(`[${viewName}] Created white fill hand group (separate group)`)
            continue
          }
          
          // For non-white-fill paths, find related paths (secondary groups, etc.)
          // Extract starting coordinates to find related paths (same hand, different layers)
          const startMatch = pathData.match(/M\s*(\d+)\s*(\d+)/)
          if (startMatch) {
            const startX = parseInt(startMatch[1])
            const startY = parseInt(startMatch[2])
            
            // Look for related paths AND secondary groups (same starting position, within proximity)
            // First, find all secondary groups that might be part of this hand
            const secondaryGroups = doc.querySelectorAll('g[class*="gotchi-wearable"][class*="gotchi-secondary"], g[class*="gotchi-secondary"]')
            const processedGroups = new Set()
            
            for (const relatedPath of wearablePaths) {
              if (processedPaths.has(relatedPath)) continue
              const relatedData = relatedPath.getAttribute('d') || ''
              const relatedMatch = relatedData.match(/M\s*(\d+)\s*(\d+)/)
              if (relatedMatch) {
                const relatedX = parseInt(relatedMatch[1])
                const relatedY = parseInt(relatedMatch[2])
                
                // Check if this related path is actually a body path (should be excluded)
                const relatedFill = relatedPath.getAttribute('fill') || ''
                const relatedDataLower = relatedData.toLowerCase()
                const relatedClasses = (relatedPath.getAttribute('class') || '').toLowerCase()
                const relatedParentGroup = relatedPath.closest('g[class*="gotchi-wearable"], g[class*="gotchi-secondary"]')
                let relatedAllClasses = relatedClasses
                if (relatedParentGroup) {
                  relatedAllClasses += ' ' + (relatedParentGroup.getAttribute('class') || '').toLowerCase()
                }
                
                const isRelatedBodyPath = relatedDataLower.includes('v41') || 
                                        relatedDataLower.includes('v39') || 
                                        relatedData.length > 100 ||
                                        ((relatedFill === '#fff' || relatedFill === '#ffffff') && 
                                         relatedData.length > 50 && 
                                         (relatedDataLower.includes('v14') || relatedDataLower.includes('v51') ||
                                          relatedDataLower.includes('v41') || relatedDataLower.includes('v39')))
                
                // Check if this is a secondary color path (inside gotchi-secondary group)
                const isSecondaryPath = relatedAllClasses.includes('gotchi-secondary') || 
                                       relatedParentGroup?.getAttribute('class')?.toLowerCase().includes('gotchi-secondary')
                
                // Calculate distance
                const distanceX = Math.abs(relatedX - startX)
                const distanceY = Math.abs(relatedY - startY)
                const maxDistance = isSecondaryPath ? 12 : 5 // Allow larger distance for secondary paths
                
                // If paths start near each other (within maxDistance), they're likely the same hand
                // BUT exclude body paths
                // IMPORTANT: Don't add white fill paths to primary groups - they should be in separate groups
                const isWhiteFillHand = (relatedFill === '#fff' || relatedFill === '#ffffff') && 
                                       relatedData.length >= 20 && relatedData.length <= 100 &&
                                       (relatedData.includes('40') || relatedData.includes('41') ||
                                        relatedData.includes('42') || relatedData.includes('43') ||
                                        relatedData.includes('44') || relatedData.includes('45'))
                
                // Skip white fill paths - they'll be found separately and create their own groups
                if (isWhiteFillHand) {
                  console.log(`[${viewName}] Skipping white fill path - will be in separate group:`, { distanceX, distanceY, startX, startY, relatedX, relatedY })
                  continue
                }
                
                if (distanceX <= maxDistance && distanceY <= maxDistance && !isRelatedBodyPath) {
                  // Also verify it's hand-like (size and characteristics)
                  // For secondary paths, be more lenient - they're usually small detail paths
                  const isHandLike = isSecondaryPath ? 
                    (relatedData.length >= 10 && relatedData.length <= 100 &&
                     (relatedData.includes('40') || relatedData.includes('41') || 
                      relatedData.includes('42') || relatedData.includes('43') || 
                      relatedData.includes('44') || relatedData.includes('45'))) :
                    (relatedData.length >= 15 && relatedData.length <= 100 &&
                     (relatedData.includes('v-4') || relatedData.includes('v-1') || 
                      relatedData.includes('h-1') || relatedData.includes('h-2') ||
                      relatedData.includes('v1') || relatedData.includes('v2') ||
                      relatedData.includes('h1') || relatedData.includes('h2') ||
                      relatedData.includes('44') || relatedData.includes('40') ||
                      relatedData.includes('43') || relatedData.includes('45')))
                  
                  if (isHandLike) {
                    // If this path is inside a secondary group, include the whole group
                    if (relatedParentGroup && relatedParentGroup.getAttribute('class')?.toLowerCase().includes('gotchi-secondary') && !processedGroups.has(relatedParentGroup)) {
                      // Check if any path in this group is near the hand
                      const groupPaths = relatedParentGroup.querySelectorAll('path')
                      let groupHasHandPath = false
                      for (const groupPath of groupPaths) {
                        const groupPathData = groupPath.getAttribute('d') || ''
                        const groupMatch = groupPathData.match(/M\s*(\d+)\s*(\d+)/)
                        if (groupMatch) {
                          const groupX = parseInt(groupMatch[1])
                          const groupY = parseInt(groupMatch[2])
                          if (Math.abs(groupX - startX) <= 12 && Math.abs(groupY - startY) <= 12) {
                            groupHasHandPath = true
                            break
                          }
                        }
                      }
                      
                      if (groupHasHandPath) {
                        // Include the entire secondary group, but ensure paths have the gotchi-secondary class
                        const clonedGroup = relatedParentGroup.cloneNode(true)
                        // Get secondary color from style element
                        const styleElement = doc.querySelector('style')
                        let secondaryColor = '#FFC3DF' // default
                        if (styleElement) {
                          const styleText = styleElement.textContent || styleElement.innerHTML
                          const secondaryMatch = styleText.match(/\.gotchi-secondary\s*\{[^}]*fill:\s*([^;]+)/)
                          if (secondaryMatch) {
                            secondaryColor = secondaryMatch[1].trim()
                          }
                        }
                        // Apply gotchi-secondary class and fill color to all paths inside the group
                        const clonedPaths = clonedGroup.querySelectorAll('path')
                        clonedPaths.forEach(p => {
                          const existingClass = p.getAttribute('class') || ''
                          if (!existingClass.includes('gotchi-secondary')) {
                            p.setAttribute('class', existingClass ? `${existingClass} gotchi-secondary` : 'gotchi-secondary')
                          }
                          // Apply fill color directly if path doesn't have one
                          if (!p.getAttribute('fill') || p.getAttribute('fill') === 'currentColor') {
                            p.setAttribute('fill', secondaryColor)
                          }
                        })
                        handGroup.appendChild(clonedGroup)
                        processedGroups.add(relatedParentGroup)
                        // Mark all paths in this group as processed
                        groupPaths.forEach(p => processedPaths.add(p))
                        console.log(`[${viewName}] Added entire secondary group to hand`)
                        continue
                      }
                    }
                    
                    // Otherwise, just add the individual path
                    const clonedPath = relatedPath.cloneNode(true)
                    // If it's a white fill hand path, preserve it
                    if (isWhiteFillHand) {
                      console.log(`[${viewName}] Adding white fill hand path`)
                    }
                    // If it's a secondary path, ensure it has the gotchi-secondary class and fill color
                    if (isSecondaryPath) {
                      const existingClass = clonedPath.getAttribute('class') || ''
                      if (!existingClass.includes('gotchi-secondary')) {
                        clonedPath.setAttribute('class', existingClass ? `${existingClass} gotchi-secondary` : 'gotchi-secondary')
                      }
                      // Get secondary color from style element and apply directly
                      const styleElement = doc.querySelector('style')
                      let secondaryColor = '#FFC3DF' // default
                      if (styleElement) {
                        const styleText = styleElement.textContent || styleElement.innerHTML
                        const secondaryMatch = styleText.match(/\.gotchi-secondary\s*\{[^}]*fill:\s*([^;]+)/)
                        if (secondaryMatch) {
                          secondaryColor = secondaryMatch[1].trim()
                        }
                      }
                      // Apply fill color directly if path doesn't have one
                      if (!clonedPath.getAttribute('fill') || clonedPath.getAttribute('fill') === 'currentColor') {
                        clonedPath.setAttribute('fill', secondaryColor)
                      }
                    }
                    handGroup.appendChild(clonedPath)
                    processedPaths.add(relatedPath)
                    console.log(`[${viewName}] Added related hand path to group (${isSecondaryPath ? 'secondary' : 'primary'})`)
                  } else {
                    console.log(`[${viewName}] Skipped related path - not hand-like:`, {
                      pathLength: relatedData.length,
                      isSecondary: isSecondaryPath,
                      pathData: relatedData.substring(0, 40) + '...'
                    })
                  }
                } else if (distanceX <= maxDistance && distanceY <= maxDistance && isRelatedBodyPath) {
                  console.log(`[${viewName}] Skipped related path - is body path:`, {
                    pathData: relatedData.substring(0, 40) + '...'
                  })
                }
              }
            }
            
            handPaths.push(handGroup)
          } else {
            // Fallback: just add the path
            const handGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
            handGroup.setAttribute('class', 'gotchi-hand-wearable')
            handGroup.appendChild(path.cloneNode(true))
            handPaths.push(handGroup)
            processedPaths.add(path)
          }
        }
      }
    }
    
    if (handPaths.length > 0) {
      // Keep all hand groups separate (matching target structure)
      // White fill groups will be sorted to render first (bottom layer)
      allHands = handPaths
      console.log(`[${viewName}] Found hands as gotchi-wearable paths in side view:`, allHands.length)
    }
  }
  
  if (allHands.length > 0) {
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    wrapper.setAttribute('viewBox', viewBox)
    
    // Include style element if it exists (needed for gotchi-secondary colors)
    const styleElement = doc.querySelector('style')
    if (styleElement) {
      const styleClone = styleElement.cloneNode(true)
      wrapper.appendChild(styleClone)
    }
    
    const serializer = new XMLSerializer()
    
    // Debug: Log each hand group's SVG
    allHands.forEach((el, index) => {
      const handWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      handWrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      handWrapper.setAttribute('viewBox', viewBox)
      // Include style element in debug output too
      if (styleElement) {
        const styleClone = styleElement.cloneNode(true)
        handWrapper.appendChild(styleClone)
      }
      handWrapper.appendChild(el.cloneNode(true))
      const handSvg = serializer.serializeToString(handWrapper)
      console.log(`[${viewName} - Hand ${index + 1}/${allHands.length}] SVG:`, handSvg)
      console.log(`[${viewName} - Hand ${index + 1}/${allHands.length}] Classes:`, el.getAttribute('class') || 'no class')
    })
    
    // Reorder hand groups so layers render correctly:
    // 1. Primary groups (bottom layer)
    // 2. Secondary groups (middle layer)
    // 3. White fill-only groups (top layer - render last)
    const sortedHands = [...allHands].sort((a, b) => {
      const aHasWhiteFill = a.querySelector('path[fill="#fff"], path[fill="#ffffff"]')
      const bHasWhiteFill = b.querySelector('path[fill="#fff"], path[fill="#ffffff"]')
      const aHasSecondary = a.querySelector('.gotchi-secondary, path[class*="gotchi-secondary"], g[class*="gotchi-secondary"]')
      const bHasSecondary = b.querySelector('.gotchi-secondary, path[class*="gotchi-secondary"], g[class*="gotchi-secondary"]')
      const aHasPrimary = a.querySelector('.gotchi-primary, path[class*="gotchi-primary"]')
      const bHasPrimary = b.querySelector('.gotchi-primary, path[class*="gotchi-primary"]')
      
      // Check if groups are white-fill-only (no primary, no secondary)
      const aIsWhiteFillOnly = aHasWhiteFill && !aHasPrimary && !aHasSecondary
      const bIsWhiteFillOnly = bHasWhiteFill && !bHasPrimary && !bHasSecondary
      
      // Primary groups first (bottom layer)
      if (aHasPrimary && !aHasSecondary && !bHasPrimary) return -1
      if (!aHasPrimary && bHasPrimary && !bHasSecondary) return 1
      
      // Then secondary groups
      if (aHasSecondary && !bHasSecondary) return -1
      if (!aHasSecondary && bHasSecondary) return 1
      
      // White-fill-only groups last (top layer - render last)
      if (aIsWhiteFillOnly && !bIsWhiteFillOnly) return 1
      if (!aIsWhiteFillOnly && bIsWhiteFillOnly) return -1
      
      // Then groups with white fill (but also have primary/secondary) - render last
      if (aHasWhiteFill && !aIsWhiteFillOnly && !bHasWhiteFill) return 1
      if (!aHasWhiteFill && bHasWhiteFill && !bIsWhiteFillOnly) return -1
      
      return 0
    })
    
    // Also reorder paths within each hand group
    // BUT preserve nested structures (paths inside groups stay inside groups)
    // Skip reordering for white-fill-only groups - they're already correct
    const reorderedHands = sortedHands.map(handGroup => {
      const clonedGroup = handGroup.cloneNode(true)
      
      // Check if this is a white-fill-only group (no primary or secondary paths)
      const hasWhiteFill = clonedGroup.querySelector('path[fill="#fff"], path[fill="#ffffff"]')
      const hasPrimary = clonedGroup.querySelector('.gotchi-primary, path[class*="gotchi-primary"]')
      const hasSecondary = clonedGroup.querySelector('.gotchi-secondary, path[class*="gotchi-secondary"], g[class*="gotchi-secondary"]')
      const isWhiteFillOnly = hasWhiteFill && !hasPrimary && !hasSecondary
      
      // Skip reordering for white-fill-only groups - they're already in the correct structure
      if (isWhiteFillOnly) {
        console.log(`[${viewName}] Skipping reorder for white-fill-only group`)
        return clonedGroup
      }
      
      // Only get top-level paths and groups (not nested inside other groups)
      const topLevelElements = Array.from(clonedGroup.children)
      const topLevelPaths = topLevelElements.filter(el => el.tagName === 'path')
      const topLevelGroups = topLevelElements.filter(el => el.tagName === 'g')
      
      // Remove all top-level elements
      topLevelElements.forEach(el => el.remove())
      
      // Separate by type (only top-level, not nested)
      const whiteFillPaths = topLevelPaths.filter(p => {
        const fill = p.getAttribute('fill') || ''
        return fill === '#fff' || fill === '#ffffff'
      })
      const primaryGroups = topLevelGroups.filter(g => {
        const classes = (g.getAttribute('class') || '').toLowerCase()
        return classes.includes('gotchi-primary') && !classes.includes('gotchi-secondary')
      })
      const primaryPaths = topLevelPaths.filter(p => {
        const classes = (p.getAttribute('class') || '').toLowerCase()
        return classes.includes('gotchi-primary') && !classes.includes('gotchi-secondary')
      })
      const secondaryGroups = topLevelGroups.filter(g => {
        const classes = (g.getAttribute('class') || '').toLowerCase()
        return classes.includes('gotchi-secondary')
      })
      // Only include secondary paths that are NOT inside a group (orphaned secondary paths)
      const orphanedSecondaryPaths = topLevelPaths.filter(p => {
        const classes = (p.getAttribute('class') || '').toLowerCase()
        return classes.includes('gotchi-secondary')
      })
      
      // Re-add in correct z-order: primary groups first (bottom), then primary paths, then secondary groups, then orphaned secondary paths, then white fill last (top - render last)
      primaryGroups.forEach(g => clonedGroup.appendChild(g)) // Primary groups keep their nested paths
      primaryPaths.forEach(p => clonedGroup.appendChild(p))
      secondaryGroups.forEach(g => clonedGroup.appendChild(g)) // Groups keep their nested paths
      orphanedSecondaryPaths.forEach(p => clonedGroup.appendChild(p))
      whiteFillPaths.forEach(p => clonedGroup.appendChild(p)) // White fill paths render last (on top)
      
      return clonedGroup
    })
    
    // Debug: Log the order of groups before adding to wrapper
    console.log(`[${viewName}] Final hand groups order:`, reorderedHands.map((el, idx) => {
      const hasWhiteFill = el.querySelector('path[fill="#fff"], path[fill="#ffffff"]')
      const hasPrimary = el.querySelector('.gotchi-primary, path[class*="gotchi-primary"]')
      const hasSecondary = el.querySelector('.gotchi-secondary, path[class*="gotchi-secondary"], g[class*="gotchi-secondary"]')
      return {
        index: idx,
        hasWhiteFill: !!hasWhiteFill,
        hasPrimary: !!hasPrimary,
        hasSecondary: !!hasSecondary,
        type: hasWhiteFill && !hasPrimary && !hasSecondary ? 'white-fill-only' : 
              hasPrimary ? 'primary' : 'other'
      }
    }))
    
    reorderedHands.forEach(el => {
      wrapper.appendChild(el)
    })
    parts.Hands = serializer.serializeToString(wrapper)
    console.log(`[${viewName}] Extracted hands (excluded sleeves):`, allHands.length, 'hand groups')
  } else {
    console.warn(`[${viewName}] No hand elements found in clean SVG (sleeves excluded)`)
  }
  
  // Extract Shadow
  console.log(`  [${viewName}] Extracting Shadow...`)
  parts.Shadow = extractPart('g.gotchi-shadow', 'Shadow')
  
  // Extract style element (for colors)
  console.log(`  [${viewName}] Extracting Style...`)
  const styleElement = doc.querySelector('style')
  if (styleElement) {
    parts.Style = styleElement.textContent || styleElement.innerHTML
    console.log(`    ✓ Style extracted successfully (length: ${parts.Style.length})`)
  } else {
    console.log(`    ✗ Style not found`)
  }
  
  // Summary of extraction
  const extractedParts = Object.keys(parts).filter(k => parts[k])
  const missingParts = ['Background', 'Body', 'Mouth', 'Eyes', 'Collateral', 'Hands', 'Shadow'].filter(p => !parts[p])
  
  console.log(`\n  [${viewName}] Extraction summary:`)
  console.log(`    ✓ Extracted: ${extractedParts.length} part(s) -`, extractedParts.join(', '))
  if (missingParts.length > 0) {
    console.log(`    ✗ Missing: ${missingParts.length} part(s) -`, missingParts.join(', '))
  }
  console.log(`  [${viewName}] Extracted base Gotchi parts:`, {
    parts: Object.keys(parts),
    hasBackground: !!parts.Background,
    hasBody: !!parts.Body,
    hasMouth: !!parts.Mouth,
    hasCheeks: !!parts.Cheeks,
    hasEyes: !!parts.Eyes,
    hasCollateral: !!parts.Collateral,
    hasHands: !!parts.Hands,
    hasShadow: !!parts.Shadow,
    hasStyle: !!parts.Style
  })
  
  return parts
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
function parsePartsAndWearables(svgString, equippedWearables, viewName = 'Unknown') {
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
  // Note: gotchi-primary and gotchi-secondary are handled in special checks, not in the array
  // to avoid matching gotchi-primary-mouth incorrectly
  const partsCategories = {
    'Background': ['gotchi-bg'],
    'Mouth': ['gotchi-primary-mouth', 'gotchi-mouth', 'gotchi-mouthLeft', 'gotchi-mouthRight'],  // Check Mouth before Body
    'Body': ['gotchi-body', 'gotchi-body-', 'gotchi-bodyLeft', 'gotchi-bodyRight', 'gotchi-bodyLeft-', 'gotchi-bodyRight-'],
    'Collateral': ['gotchi-collateral'],
    'Eyes': ['gotchi-eyeColor', 'gotchi-eyes', 'gotchi-eye', 'gotchi-cheek', 'gotchi-cheeks'],
    'Hands': ['gotchi-handsDownClosed', 'gotchi-handsDownOpen', 'gotchi-handsUp', 'gotchi-hands', 'gotchi-hand', 'gotchi-handLeft', 'gotchi-handRight', 'gotchi-handsLeft', 'gotchi-handsRight', 'gotchi-sleeves-up'],
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
  function extractElements(element, parentTransform = '', parentClasses = [], parentHasBody = false, parentHasHands = false, parentCategorized = false) {
    const tagName = element.tagName?.toLowerCase()
    if (!tagName) return
    
    const transform = element.getAttribute('transform') || ''
    const combinedTransform = parentTransform ? `${parentTransform} ${transform}`.trim() : transform
    const classes = element.getAttribute('class') || ''
    const classList = classes.split(' ').filter(c => c.trim())
    
    // Only use direct classes for categorization - don't inherit from parent
    // This ensures we only categorize top-level parts, not nested children
    const directClasses = classList
    
    // Combine with parent classes for context tracking (but not for categorization)
    const allClasses = [...classList, ...parentClasses]
    
    // Check if current element has body/hands classes directly (not from parent)
    const elementHasBody = directClasses.some(c => {
      const lower = c.toLowerCase()
      return lower.includes('gotchi-body') || lower.includes('bodyleft') || lower.includes('bodyright') ||
             (lower.includes('body') && lower.includes('gotchi')) ||
             lower === 'gotchi-primary' || lower === 'gotchi-secondary' ||
             lower.includes('gotchi-primary') || lower.includes('gotchi-secondary')
    }) || parentHasBody
    
    const elementHasHands = directClasses.some(c => {
      const lower = c.toLowerCase()
      return lower.includes('gotchi-hand') || lower.includes('gotchi-hands') || 
             lower.includes('handleft') || lower.includes('handright') ||
             lower.includes('handsleft') || lower.includes('handsright') ||
             (lower.includes('hand') && lower.includes('gotchi'))
    }) || parentHasHands
    
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
    // Only categorize if this element has the class directly (not inherited from parent)
    // This ensures we only get top-level parts, not nested children
    let categorized = false
    
    // Skip categorization if parent was already categorized (to avoid duplicate nested parts)
    if (!parentCategorized) {
      for (const [categoryName, categoryClasses] of Object.entries(partsCategories)) {
        // Check if any DIRECT class matches exactly or starts with the category class
        // Only use directClasses, not parent classes
        if (categoryClasses.some(cls => {
          return directClasses.some(classItem => {
            // Normalize class names for comparison
            const normalizedClass = classItem.toLowerCase().trim()
            const normalizedMatch = cls.toLowerCase().trim()
            
            // Exact match
            if (normalizedClass === normalizedMatch) return true
            
            // Starts with match (for classes like gotchi-body-something, gotchi-bodyColor, etc.)
            // For classes ending with '-', match if the normalized class starts with it
            // For other classes, only match if followed by '-' or end of string
            if (normalizedClass.startsWith(normalizedMatch)) {
              if (normalizedMatch.endsWith('-')) {
                // If match ends with '-', it's a prefix pattern - always match
                return true
              } else {
                // Otherwise, only match if followed by '-' or end of string
                const nextChar = normalizedClass[normalizedMatch.length]
                if (!nextChar || nextChar === '-') {
                  return true
                }
              }
            }
            
            // For body: check if class contains 'gotchi-body' (case-insensitive)
            // Also check for side-view variants like gotchi-bodyLeft, gotchi-bodyRight, etc.
            if (normalizedMatch === 'gotchi-body' && normalizedClass.includes('gotchi-body')) return true
            if (normalizedMatch === 'gotchi-body-' && normalizedClass.includes('gotchi-body')) return true
            
            // For hands: check if class contains 'gotchi-hand' or 'gotchi-hands' (case-insensitive)
            // Also check for side-view variants
            if (normalizedMatch.includes('hand') && (normalizedClass.includes('gotchi-hand') || normalizedClass.includes('gotchi-hands'))) return true
            
            // Additional checks for hands variations (more permissive for side views)
            if (categoryName === 'Hands') {
              // Check for main hand groups: gotchi-handsDownClosed, gotchi-handsDownOpen, gotchi-handsUp
              if (normalizedClass === 'gotchi-handsdownclosed' || 
                  normalizedClass === 'gotchi-handsdownopen' || 
                  normalizedClass === 'gotchi-handsup' ||
                  normalizedClass === 'gotchi-sleeves-up') {
                return true
              }
              if (normalizedClass.includes('hand') && normalizedClass.includes('gotchi')) return true
              // Also check for handLeft, handRight, handsLeft, handsRight, etc.
              // All hand variants go to the same Hands category
              if ((normalizedClass.includes('handleft') || normalizedClass.includes('handright') || 
                   normalizedClass.includes('handsleft') || normalizedClass.includes('handsright')) && 
                  normalizedClass.includes('gotchi')) {
                return true
              }
            }
            
            // Additional checks for body variations (more permissive for side views)
            if (categoryName === 'Body') {
              // Exclude mouth and hand parts from body category (check these first)
              if (normalizedClass.includes('mouth') && normalizedClass.includes('gotchi')) return false
              if (normalizedClass.includes('hand') && normalizedClass.includes('gotchi')) return false
              
              // Exclude elements with wearable- classes (they should go to wearables, not body)
              if (directClasses.some(c => c.toLowerCase().startsWith('wearable-'))) return false
              
              if (normalizedClass.includes('body') && normalizedClass.includes('gotchi')) return true
              // Also check for bodyLeft, bodyRight, etc. - be more permissive
              // Check if it contains bodyleft/bodyright (these are always body parts in gotchi context)
              if (normalizedClass.includes('bodyleft') || normalizedClass.includes('bodyright')) {
                // If it contains bodyleft/bodyright, it's definitely a body part
                // Only exclude if it's explicitly a wearable
                if (!normalizedClass.includes('wearable')) return true
              }
              // gotchi-primary and gotchi-secondary are body parts (primary/secondary body colors)
              // But exclude if it's gotchi-primary-mouth (that should go to Mouth category)
              if (normalizedClass === 'gotchi-primary' || normalizedClass === 'gotchi-secondary') {
                return true
              }
              // Check for gotchi-primary or gotchi-secondary but exclude mouth variants
              if ((normalizedClass.includes('gotchi-primary') || normalizedClass.includes('gotchi-secondary')) &&
                  !normalizedClass.includes('mouth')) {
                return true
              }
            }
            
            // Additional checks for mouth variations
            if (categoryName === 'Mouth') {
              if (normalizedClass.includes('mouth') && normalizedClass.includes('gotchi')) return true
              // gotchi-primary-mouth should go to Mouth, not Body
              if (normalizedClass.includes('gotchi-primary-mouth')) return true
              // Side view mouth variants
              if (normalizedClass.includes('mouthleft') || normalizedClass.includes('mouthright')) return true
            }
            
            // Exclude body parts from hands category
            if (categoryName === 'Hands') {
              if (normalizedClass.includes('body') && normalizedClass.includes('gotchi')) return false
              if (normalizedClass === 'gotchi-primary' || normalizedClass === 'gotchi-secondary') return false
            }
            
            // Additional checks for eyes variations
            if (categoryName === 'Eyes') {
              if ((normalizedClass.includes('eye') || normalizedClass.includes('eyes')) && normalizedClass.includes('gotchi')) return true
              // Cheeks are part of the eye/face area
              if ((normalizedClass.includes('cheek') || normalizedClass.includes('cheeks')) && normalizedClass.includes('gotchi')) return true
            }
            
            return false
          })
        })) {
        parts[categoryName].elements.push(elementData)
        categorized = true
        break
      }
    }
    }
    
    // Check if it's a wearable (before adding to Other)
    let isWearable = false
    for (const wearable of wearables) {
      const wearableClasses = wearable.className.split(' ')
      if (wearableClasses.some(cls => allClasses.includes(cls))) {
        wearable.elements.push(elementData)
        isWearable = true
        break
      }
    }
    
    // Also check for any wearable- classes that might not match standard slots
    if (!isWearable && allClasses.some(c => c.startsWith('wearable-'))) {
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
      elementData.wearableClasses = allClasses.filter(c => c.startsWith('wearable-'))
      categorized = true // Don't add to Other if it's a wearable
    }
    
    // Before adding to Other, do a final check for Body and Hands variations
    // Only check if not already categorized and not a child of a categorized parent
    // Use DIRECT classes only (not parent classes) to avoid categorizing nested elements
    if (!categorized && !parentCategorized && directClasses.some(c => c.startsWith('gotchi-'))) {
      const directClassesLower = directClasses.map(c => c.toLowerCase())
      
      // Check for Body variations (including left/right variants)
      // Also check for gotchi-primary and gotchi-secondary which are body parts
      // Exclude hand and mouth parts
      const hasHandInDirectClasses = directClassesLower.some(c => 
        (c.includes('hand') && c.includes('gotchi')) ||
        c.includes('gotchi-hand') ||
        c.includes('handleft') ||
        c.includes('handright') ||
        c.includes('handsleft') ||
        c.includes('handsright')
      )
      
      const hasMouthInDirectClasses = directClassesLower.some(c => 
        (c.includes('mouth') && c.includes('gotchi')) ||
        c.includes('gotchi-mouth') ||
        c.includes('gotchi-primary-mouth')
      )
      
      // Check if gotchi-wearable is actually a body part (common in side views)
      // gotchi-wearable can be a body fill even without primary/secondary if it's in body context
      const hasGotchiWearable = directClassesLower.some(c => c === 'gotchi-wearable')
      const hasPrimarySecondary = directClassesLower.some(c => 
        c === 'gotchi-primary' || c === 'gotchi-secondary' ||
        c.includes('gotchi-primary') || c.includes('gotchi-secondary')
      )
      
      // Check if element has white fill (common for body fills)
      const hasWhiteFill = elementData.primaryFill === '#fff' || 
                          elementData.primaryFill === '#ffffff' ||
                          elementData.primaryFill === 'white' ||
                          (elementData.attributes && elementData.attributes.fill === '#fff') ||
                          (elementData.attributes && elementData.attributes.fill === '#ffffff') ||
                          (elementData.attributes && elementData.attributes.fill === 'white')
      
      // Check if parent context indicates body (for gotchi-wearable elements)
      const hasBodyContext = parentHasBody || allClasses.some(c => {
        const lower = c.toLowerCase()
        return lower.includes('gotchi-body') || lower.includes('bodyleft') || lower.includes('bodyright')
      })
      
      // Only categorize as body if it's explicitly a body part
      // gotchi-wearable alone is NOT a body part - it needs body context, primary/secondary, or white fill
      // Exclude elements with wearable- classes (they should go to wearables)
      const hasWearableClass = directClassesLower.some(c => c.startsWith('wearable-'))
      const isExplicitBodyPart = !hasWearableClass && directClassesLower.some(c => 
        (c.includes('body') && c.includes('gotchi')) ||
        c.includes('gotchi-body') ||
        c.includes('bodyleft') ||
        c.includes('bodyright') ||
        (c.includes('body') && !c.includes('wearable') && c.includes('gotchi')) ||
        c === 'gotchi-primary' ||
        c === 'gotchi-secondary' ||
        (c.includes('gotchi-primary') && !c.includes('mouth')) ||
        (c.includes('gotchi-secondary') && !c.includes('mouth'))
      )
      
      // gotchi-wearable is only body if it has primary/secondary OR white fill with body context
      const isWearableBodyPart = hasGotchiWearable && (
        hasPrimarySecondary ||
        (hasWhiteFill && hasBodyContext)
      )
      
      if (!hasHandInDirectClasses && !hasMouthInDirectClasses && (isExplicitBodyPart || isWearableBodyPart)) {
        parts['Body'].elements.push(elementData)
        categorized = true
      }
      // Check for Hands variations (including left/right variants)
      // Exclude body parts AND sleeves (sleeves are NOT hands, they're clothing/wearables)
      // All hand variants (including left/right) go to the same Hands category
      // Hands can be: gotchi-hand (body parts) or wearable-hand (wearable parts)
      // Main hand groups: gotchi-handsDownClosed, gotchi-handsDownOpen, gotchi-handsUp
      // EXCLUDE: gotchi-sleeves (these are clothing, not hands)
      else if (!directClassesLower.some(c => 
        (c.includes('body') && c.includes('gotchi')) ||
        c.includes('gotchi-body') ||
        (c === 'gotchi-primary' && !c.includes('hand')) ||
        (c === 'gotchi-secondary' && !c.includes('hand'))
      ) && !directClassesLower.some(c => 
        c.includes('sleeves') || c.includes('sleeve') // EXCLUDE sleeves - they're not hands!
      ) && directClassesLower.some(c => 
        c === 'gotchi-handsdownclosed' ||
        c === 'gotchi-handsdownopen' ||
        c === 'gotchi-handsup' ||
        (c.includes('hand') && c.includes('gotchi') && !c.includes('sleeve')) ||
        (c.includes('gotchi-hand') && !c.includes('sleeve')) ||
        c.includes('wearable-hand') ||
        c.includes('handleft') ||
        c.includes('handright') ||
        c.includes('handsleft') ||
        c.includes('handsright') ||
        (c.includes('hand') && (!c.includes('wearable-') || c === 'wearable-hand') && !c.includes('sleeve'))
      )) {
        parts['Hands'].elements.push(elementData)
        categorized = true
      }
      // Check for Mouth (including side view variants)
      else if (directClassesLower.some(c => 
        (c.includes('mouth') && c.includes('gotchi')) ||
        c.includes('gotchi-primary-mouth') ||
        c.includes('gotchi-mouth') ||
        c.includes('mouthleft') ||
        c.includes('mouthright')
      )) {
        parts['Mouth'].elements.push(elementData)
        categorized = true
      }
      // Check for Eyes (including cheeks)
      else if (directClassesLower.some(c => 
        ((c.includes('eye') || c.includes('eyes')) && c.includes('gotchi')) ||
        ((c.includes('cheek') || c.includes('cheeks')) && c.includes('gotchi'))
      )) {
        parts['Eyes'].elements.push(elementData)
        categorized = true
      }
      // If still not categorized, add to Other
      else {
        parts['Other'].elements.push(elementData)
        categorized = true
      }
    } else if (!categorized) {
      // If not categorized and parent was categorized, skip this element (it's a nested child)
      // Don't add to Other
    }
    
    // Pass current element's classes to children for context
    const childParentClasses = [...classList]
    
    // Recursively process children
    // For hands: Always extract them even if parent was categorized (hands should be separate)
    // For other elements: Skip categorization if parent was categorized (prevents nested duplicates)
    Array.from(element.children || []).forEach(child => {
      const childClasses = (child.getAttribute('class') || '').toLowerCase()
      const childHasHand = childClasses.includes('gotchi-hand') || 
                          childClasses.includes('hand') ||
                          childClasses.includes('hands')
      
      // Always extract hands even if parent was categorized
      // This ensures nested hand elements are extracted and categorized
      if (childHasHand) {
        extractElements(child, combinedTransform, childParentClasses, elementHasBody, elementHasHands, false)
      } else {
        // For non-hand elements, skip categorization if parent was categorized
        extractElements(child, combinedTransform, childParentClasses, elementHasBody, elementHasHands, categorized)
      }
    })
  }
  
  // Start extraction from root
  Array.from(svgElement.children || []).forEach(child => {
    extractElements(child, '', [], false, false, false)
  })
  
  // Debug: Log initial categorization results for side views
  if (viewName === 'Left' || viewName === 'Right') {
    // Check if any elements have hand-related classes
    const allHandElements = []
    Object.entries(parts).forEach(([catName, category]) => {
      category.elements.forEach(el => {
        const classes = ((el.attributes && el.attributes.class) || '').toLowerCase()
        const svgCode = (el.svgCode || '').toLowerCase()
        const hasHand = classes.includes('hand') || svgCode.includes('hand') || 
                        classes.includes('gotchi-hand') || svgCode.includes('gotchi-hand')
        if (hasHand) {
          allHandElements.push({
            category: catName,
            classes: classes,
            svgCodeSample: svgCode.substring(0, 200),
            tag: el.tag,
            hasHand: true
          })
        }
      })
    })
    
    console.log(`[${viewName}] Initial categorization results:`, {
      hands: parts['Hands']?.elements.length || 0,
      body: parts['Body']?.elements.length || 0,
      other: parts['Other']?.elements.length || 0,
      allCategories: Object.keys(parts).map(k => ({ name: k, count: parts[k].elements.length })),
      handElementsFound: allHandElements.length,
      handElementsDetails: allHandElements
    })
    
    // If hands are found but not in Hands category, log more details
    if (allHandElements.length > 0 && parts['Hands']?.elements.length === 0) {
      console.warn(`[${viewName}] ⚠️ Found ${allHandElements.length} hand element(s) but they're not in Hands category!`, allHandElements)
      // Log full details of where each hand is
      allHandElements.forEach((hand, idx) => {
        console.log(`[${viewName}] Hand element ${idx + 1}:`, {
          category: hand.category,
          classes: hand.classes,
          tag: hand.tag,
          svgSample: hand.svgCodeSample
        })
      })
    }
  }
  
  // Post-process: Move any Body or Hands elements that ended up in "Other" to their proper categories
  // Also check the SVG code itself for body/hands indicators (parent groups, etc.)
  if (parts['Other'] && parts['Other'].elements.length > 0) {
    const otherElements = parts['Other'].elements
    const remainingOtherElements = []
    
    for (const element of otherElements) {
      const elementClasses = (element.attributes.class || '').toLowerCase()
      const allElementClasses = elementClasses.split(' ').filter(c => c.trim())
      
      // Check SVG code for body/hands indicators (parent groups, etc.)
      const svgCode = (element.svgCode || '').toLowerCase()
      const hasBodyInSvg = svgCode.includes('gotchi-body') || 
                           svgCode.includes('bodyleft') || 
                           svgCode.includes('bodyright') ||
                           svgCode.includes('class="gotchi-body') ||
                           svgCode.includes("class='gotchi-body")
      const hasHandsInSvg = svgCode.includes('gotchi-hand') || 
                            svgCode.includes('gotchi-hands') ||
                            svgCode.includes('handleft') || 
                            svgCode.includes('handright') ||
                            svgCode.includes('handsleft') ||
                            svgCode.includes('handsright') ||
                            svgCode.includes('class="gotchi-hand') ||
                            svgCode.includes("class='gotchi-hand")
      
      // Check if this element should be in Body category
      // Only check direct classes (not inherited from SVG parent structure)
      // Exclude hand parts
      const hasHandInClasses = allElementClasses.some(c => 
        (c.includes('hand') && c.includes('gotchi')) ||
        c.includes('gotchi-hand') ||
        c.includes('handleft') ||
        c.includes('handright') ||
        c.includes('handsleft') ||
        c.includes('handsright')
      )
      
      const hasBodyInSvgExtended = hasBodyInSvg || 
                                    svgCode.includes('gotchi-primary') ||
                                    svgCode.includes('gotchi-secondary') ||
                                    svgCode.includes('class="gotchi-primary') ||
                                    svgCode.includes("class='gotchi-primary") ||
                                    svgCode.includes('class="gotchi-secondary') ||
                                    svgCode.includes("class='gotchi-secondary")
      
      const hasMouthInClasses = allElementClasses.some(c => 
        (c.includes('mouth') && c.includes('gotchi')) ||
        c.includes('gotchi-mouth') ||
        c.includes('gotchi-primary-mouth') ||
        c.includes('mouthleft') ||
        c.includes('mouthright')
      )
      
      // Check if gotchi-wearable is actually a body part (common in side views)
      const hasGotchiWearable = allElementClasses.some(c => c === 'gotchi-wearable')
      const hasPrimarySecondaryInClasses = allElementClasses.some(c => 
        c === 'gotchi-primary' || c === 'gotchi-secondary' ||
        c.includes('gotchi-primary') || c.includes('gotchi-secondary')
      )
      
      // Check if element has white fill (common for body fills) - check multiple ways
      const hasWhiteFill = element.primaryFill === '#fff' || 
                          element.primaryFill === '#ffffff' ||
                          element.primaryFill === 'white' ||
                          (element.attributes && element.attributes.fill === '#fff') ||
                          (element.attributes && element.attributes.fill === '#ffffff') ||
                          (element.attributes && element.attributes.fill === 'white') ||
                          svgCode.includes('fill="#fff"') ||
                          svgCode.includes("fill='#fff'") ||
                          svgCode.includes('fill="#ffffff"') ||
                          svgCode.includes("fill='#ffffff'") ||
                          svgCode.includes('fill="white"') ||
                          svgCode.includes("fill='white'")
      
      // Exclude elements with wearable- classes (they should go to wearables, not body)
      const hasWearableClass = allElementClasses.some(c => c.startsWith('wearable-'))
      
      // Explicit body parts
      const isExplicitBodyPart = !hasWearableClass && (
        allElementClasses.some(c => 
          (c.includes('body') && c.includes('gotchi')) ||
          c.includes('gotchi-body') ||
          c.includes('bodyleft') ||
          c.includes('bodyright') ||
          c === 'body' ||
          (c.includes('body') && !c.includes('wearable')) ||
          c === 'gotchi-primary' ||
          c === 'gotchi-secondary' ||
          (c.includes('gotchi-primary') && !c.includes('mouth')) ||
          (c.includes('gotchi-secondary') && !c.includes('mouth'))
        ) || hasBodyInSvgExtended
      )
      
      // gotchi-wearable is only body if it has primary/secondary OR white fill with body context
      const isWearableBodyPart = hasGotchiWearable && (
        hasPrimarySecondaryInClasses ||
        (hasWhiteFill && hasBodyInSvg)
      )
      
      const isBody = !hasHandInClasses && !hasMouthInClasses && (isExplicitBodyPart || isWearableBodyPart)
      
      // Check if this element should be in Hands category
      // Exclude body parts
      const hasBodyInClasses = allElementClasses.some(c => 
        (c.includes('body') && c.includes('gotchi')) ||
        c.includes('gotchi-body') ||
        c === 'gotchi-primary' ||
        c === 'gotchi-secondary'
      )
      
      const isHands = !isBody && !hasBodyInClasses && (
        allElementClasses.some(c => 
          (c.includes('hand') && c.includes('gotchi')) ||
          c.includes('gotchi-hand') ||
          c.includes('handleft') ||
          c.includes('handright') ||
          c.includes('handsleft') ||
          c.includes('handsright') ||
          c === 'hand' ||
          c === 'hands' ||
          (c.includes('hand') && !c.includes('wearable'))
        ) || hasHandsInSvg
      )
      
      // Check if this element should be in Mouth category (including side view variants)
      const isMouth = allElementClasses.some(c => 
        (c.includes('mouth') && c.includes('gotchi')) ||
        c.includes('gotchi-primary-mouth') ||
        c.includes('gotchi-mouth') ||
        c.includes('mouthleft') ||
        c.includes('mouthright')
      ) || svgCode.includes('gotchi-mouth') || 
          svgCode.includes('gotchi-primary-mouth') ||
          svgCode.includes('mouthleft') ||
          svgCode.includes('mouthright')
      
      // Check if this element should be in Eyes category (including cheeks)
      const isEyes = allElementClasses.some(c => 
        ((c.includes('eye') || c.includes('eyes')) && c.includes('gotchi')) ||
        ((c.includes('cheek') || c.includes('cheeks')) && c.includes('gotchi')) ||
        c.includes('gotchi-eye') ||
        c.includes('gotchi-cheek')
      ) || svgCode.includes('gotchi-eye') || svgCode.includes('gotchi-cheek')
      
      if (isBody) {
        parts['Body'].elements.push(element)
      } else if (isHands) {
        parts['Hands'].elements.push(element)
      } else if (isMouth) {
        parts['Mouth'].elements.push(element)
      } else if (isEyes) {
        parts['Eyes'].elements.push(element)
      } else {
        remainingOtherElements.push(element)
      }
    }
    
    // Update Other with only the elements that don't belong to Body or Hands
    parts['Other'].elements = remainingOtherElements
  }
  
  // Additional pass: Move any gotchi-wearable white fill elements from Other to Body
  // This catches white fills that might have been missed in the initial categorization
  if (parts['Other'] && parts['Other'].elements.length > 0) {
    const whiteFillElements = []
    const remainingOther = []
    
    for (const element of parts['Other'].elements) {
      const elementClasses = ((element.attributes && element.attributes.class) || '').toLowerCase()
      const allElementClasses = elementClasses.split(' ').filter(c => c.trim())
      const hasGotchiWearable = allElementClasses.some(c => c === 'gotchi-wearable')
      
      const svgCode = (element.svgCode || '').toLowerCase()
      const hasWhiteFill = element.primaryFill === '#fff' || 
                          element.primaryFill === '#ffffff' ||
                          element.primaryFill === 'white' ||
                          (element.attributes && element.attributes.fill === '#fff') ||
                          (element.attributes && element.attributes.fill === '#ffffff') ||
                          (element.attributes && element.attributes.fill === 'white') ||
                          svgCode.includes('fill="#fff"') ||
                          svgCode.includes("fill='#fff'") ||
                          svgCode.includes('fill="#ffffff"') ||
                          svgCode.includes("fill='#ffffff'")
      
      const hasHand = allElementClasses.some(c => 
        (c.includes('hand') && c.includes('gotchi')) ||
        c.includes('gotchi-hand')
      ) || svgCode.includes('gotchi-hand') || svgCode.includes('gotchi-hands')
      
      const hasMouth = allElementClasses.some(c => 
        (c.includes('mouth') && c.includes('gotchi')) ||
        c.includes('gotchi-mouth') ||
        c.includes('mouthleft') ||
        c.includes('mouthright')
      ) || svgCode.includes('gotchi-mouth') ||
          svgCode.includes('mouthleft') ||
          svgCode.includes('mouthright')
      
      // gotchi-wearable with white fill is a body part (unless it's a hand or mouth)
      if (hasGotchiWearable && hasWhiteFill && !hasHand && !hasMouth) {
        whiteFillElements.push(element)
      } else {
        remainingOther.push(element)
      }
    }
    
    if (whiteFillElements.length > 0) {
      if (!parts['Body']) parts['Body'] = { elements: [] }
      parts['Body'].elements.push(...whiteFillElements)
      parts['Other'].elements = remainingOther
    }
  }
  
  // For side views (Left, Right), combine Body parts into a single composite element
  // This matches the behavior of the front view where body is composed as one part
  // Also combine for Back view to match Front view behavior
  if ((viewName === 'Left' || viewName === 'Right' || viewName === 'Back') && parts['Body'] && parts['Body'].elements.length > 0) {
    // First, check if there are white fill elements in "Other" that should be body parts
    // Move them to Body before combining
    if (parts['Other'] && parts['Other'].elements.length > 0) {
      const bodyRelatedInOther = []
      const remainingOther = []
      
      for (const element of parts['Other'].elements) {
        const elementClasses = ((element.attributes && element.attributes.class) || '').toLowerCase()
        const allElementClasses = elementClasses.split(' ').filter(c => c.trim())
        const hasGotchiWearable = allElementClasses.some(c => c === 'gotchi-wearable')
        
        // Check if it's a white fill body part - check multiple ways
        const svgCode = (element.svgCode || '').toLowerCase()
        const hasWhiteFill = element.primaryFill === '#fff' || 
                            element.primaryFill === '#ffffff' ||
                            element.primaryFill === 'white' ||
                            (element.attributes && element.attributes.fill === '#fff') ||
                            (element.attributes && element.attributes.fill === '#ffffff') ||
                            (element.attributes && element.attributes.fill === 'white') ||
                            svgCode.includes('fill="#fff"') ||
                            svgCode.includes("fill='#fff'") ||
                            svgCode.includes('fill="#ffffff"') ||
                            svgCode.includes("fill='#ffffff'") ||
                            svgCode.includes('fill="white"') ||
                            svgCode.includes("fill='white'")
        
        // Check SVG code for body context
        const hasBodyInSvg = svgCode.includes('gotchi-body') || 
                             svgCode.includes('bodyleft') || 
                             svgCode.includes('bodyright')
        
        // Check if it's a hand part
        const hasHand = allElementClasses.some(c => 
          (c.includes('hand') && c.includes('gotchi')) ||
          c.includes('gotchi-hand')
        ) || svgCode.includes('gotchi-hand') || svgCode.includes('gotchi-hands')
        
        // Check if it's a mouth part
        const hasMouth = allElementClasses.some(c => 
          (c.includes('mouth') && c.includes('gotchi')) ||
          c.includes('gotchi-mouth')
        ) || svgCode.includes('gotchi-mouth')
        
        // Check if it has wearable- classes (these are wearables, not body parts)
        const hasWearableClass = allElementClasses.some(c => c.startsWith('wearable-')) ||
                                 svgCode.includes('wearable-body') ||
                                 svgCode.includes('wearable-hand') ||
                                 svgCode.includes('wearable-face') ||
                                 svgCode.includes('wearable-eyes') ||
                                 svgCode.includes('wearable-head') ||
                                 svgCode.includes('wearable-pet') ||
                                 svgCode.includes('wearable-bg') ||
                                 svgCode.includes('class="wearable-') ||
                                 svgCode.includes("class='wearable-")
        
        // If gotchi-wearable with white fill and not a hand/mouth, it's a body part
        // BUT exclude if it has wearable- classes (those are wearables)
        // White fills are body parts regardless of explicit body context
        if (!hasWearableClass && hasGotchiWearable && hasWhiteFill && !hasHand && !hasMouth) {
          bodyRelatedInOther.push(element)
        } else if (!hasWearableClass && hasGotchiWearable && hasBodyInSvg && !hasHand && !hasMouth) {
          // Also catch gotchi-wearable in body context (but not if it's a wearable)
          bodyRelatedInOther.push(element)
        } else {
          remainingOther.push(element)
        }
      }
      
      // Move body-related elements from Other to Body
      if (bodyRelatedInOther.length > 0) {
        parts['Body'].elements.push(...bodyRelatedInOther)
        parts['Other'].elements = remainingOther
      }
    }
    
    // Filter out any hand parts, wearables, and plain gotchi-wearable elements that aren't body parts
    const bodyElements = parts['Body'].elements.filter(el => {
      const elementClasses = ((el.attributes && el.attributes.class) || '').toLowerCase()
      const allElementClasses = elementClasses.split(' ').filter(c => c.trim())
      const svgCode = (el.svgCode || '').toLowerCase()
      
      // FIRST: Exclude any element with wearable- classes (these are wearables, not body parts)
      // Check both element classes and SVG content for wearable- classes
      if (allElementClasses.some(c => c.startsWith('wearable-')) ||
          svgCode.includes('wearable-body') ||
          svgCode.includes('wearable-hand') ||
          svgCode.includes('wearable-face') ||
          svgCode.includes('wearable-eyes') ||
          svgCode.includes('wearable-head') ||
          svgCode.includes('wearable-pet') ||
          svgCode.includes('wearable-bg') ||
          svgCode.includes('class="wearable-') ||
          svgCode.includes("class='wearable-")) {
        return false
      }
      
      // Check if it's a hand part (including side view variants)
      const isHand = allElementClasses.some(c => 
        (c.includes('hand') && c.includes('gotchi')) ||
        c.includes('gotchi-hand') ||
        c.includes('handleft') ||
        c.includes('handright') ||
        c.includes('handsleft') ||
        c.includes('handsright')
      ) || svgCode.includes('gotchi-hand') || 
          svgCode.includes('gotchi-hands') ||
          svgCode.includes('handleft') ||
          svgCode.includes('handright') ||
          svgCode.includes('handsleft') ||
          svgCode.includes('handsright')
      
      if (isHand) return false
      
      // Check if it's just a plain gotchi-wearable without body indicators
      const hasGotchiWearable = allElementClasses.some(c => c === 'gotchi-wearable')
      if (hasGotchiWearable) {
        // Only keep if it has primary/secondary, white fill, or body context
        // But exclude if it has wearable- classes (already checked above, but be safe)
        const hasPrimarySecondary = allElementClasses.some(c => 
          c === 'gotchi-primary' || c === 'gotchi-secondary' ||
          c.includes('gotchi-primary') || c.includes('gotchi-secondary')
        )
        
        const hasWhiteFill = el.primaryFill === '#fff' || 
                            el.primaryFill === '#ffffff' ||
                            el.primaryFill === 'white' ||
                            (el.attributes && el.attributes.fill === '#fff') ||
                            (el.attributes && el.attributes.fill === '#ffffff') ||
                            (el.attributes && el.attributes.fill === 'white') ||
                            svgCode.includes('fill="#fff"') ||
                            svgCode.includes("fill='#fff'")
        
        const hasBodyContext = svgCode.includes('gotchi-body') || 
                               svgCode.includes('bodyleft') || 
                               svgCode.includes('bodyright') ||
                               allElementClasses.some(c => 
                                 c.includes('gotchi-body') ||
                                 c.includes('bodyleft') ||
                                 c.includes('bodyright')
                               )
        
        // Only keep if it has body indicators
        if (!hasPrimarySecondary && !hasWhiteFill && !hasBodyContext) {
          return false // This is just a plain wearable, not a body part
        }
      }
      
      return true
    })
    
    // Collect hand parts and wearables that were filtered out from body
    // EXCLUDE sleeves - they're not hands!
    const handElements = parts['Body'].elements.filter(el => {
      const elementClasses = ((el.attributes && el.attributes.class) || '').toLowerCase()
      const allElementClasses = elementClasses.split(' ').filter(c => c.trim())
      const svgCode = (el.svgCode || '').toLowerCase()
      
      // EXCLUDE sleeves
      if (allElementClasses.some(c => c.includes('sleeves') || c.includes('sleeve')) ||
          svgCode.includes('sleeves') || svgCode.includes('sleeve')) {
        return false
      }
      
      return allElementClasses.some(c => 
        (c.includes('hand') && c.includes('gotchi') && !c.includes('sleeve')) ||
        (c.includes('gotchi-hand') && !c.includes('sleeve')) ||
        (c.includes('handleft') && !c.includes('sleeve')) ||
        (c.includes('handright') && !c.includes('sleeve')) ||
        (c.includes('handsleft') && !c.includes('sleeve')) ||
        (c.includes('handsright') && !c.includes('sleeve'))
      ) || (svgCode.includes('gotchi-hand') && !svgCode.includes('sleeve')) || 
          (svgCode.includes('gotchi-hands') && !svgCode.includes('sleeve')) ||
          (svgCode.includes('handleft') && !svgCode.includes('sleeve')) ||
          (svgCode.includes('handright') && !svgCode.includes('sleeve')) ||
          (svgCode.includes('handsleft') && !svgCode.includes('sleeve')) ||
          (svgCode.includes('handsright') && !svgCode.includes('sleeve'))
    })
    
    // Separate wearables into their proper slots
    const wearableElements = parts['Body'].elements.filter(el => {
      const elementClasses = ((el.attributes && el.attributes.class) || '').toLowerCase()
      const allElementClasses = elementClasses.split(' ').filter(c => c.trim())
      
      // Check if it has any wearable- classes (wearable-body, wearable-hand, etc.)
      return allElementClasses.some(c => c.startsWith('wearable-'))
    })
    
    const plainWearables = parts['Body'].elements.filter(el => {
      const elementClasses = ((el.attributes && el.attributes.class) || '').toLowerCase()
      const allElementClasses = elementClasses.split(' ').filter(c => c.trim())
      const svgCode = (el.svgCode || '').toLowerCase()
      
      // Skip if it's a hand or has wearable- classes (those are handled separately)
      const isHand = allElementClasses.some(c => 
        (c.includes('hand') && c.includes('gotchi')) ||
        c.includes('gotchi-hand') ||
        c.includes('handleft') ||
        c.includes('handright') ||
        c.includes('handsleft') ||
        c.includes('handsright')
      ) || svgCode.includes('gotchi-hand') ||
          svgCode.includes('gotchi-hands') ||
          svgCode.includes('handleft') ||
          svgCode.includes('handright') ||
          svgCode.includes('handsleft') ||
          svgCode.includes('handsright')
      if (isHand) return false
      
      if (allElementClasses.some(c => c.startsWith('wearable-'))) return false
      
      const hasGotchiWearable = allElementClasses.some(c => c === 'gotchi-wearable')
      if (!hasGotchiWearable) return false
      
      // Check if it has body indicators
      const hasPrimarySecondary = allElementClasses.some(c => 
        c === 'gotchi-primary' || c === 'gotchi-secondary' ||
        c.includes('gotchi-primary') || c.includes('gotchi-secondary')
      )
      
      const hasWhiteFill = el.primaryFill === '#fff' || 
                          el.primaryFill === '#ffffff' ||
                          (el.attributes && el.attributes.fill === '#fff') ||
                          svgCode.includes('fill="#fff"')
      
      const hasBodyContext = svgCode.includes('gotchi-body') || 
                             svgCode.includes('bodyleft') || 
                             svgCode.includes('bodyright') ||
                             allElementClasses.some(c => 
                               c.includes('gotchi-body') ||
                               c.includes('bodyleft') ||
                               c.includes('bodyright')
                             )
      
      // It's a plain wearable if it doesn't have body indicators
      return !hasPrimarySecondary && !hasWhiteFill && !hasBodyContext
    })
    
    // Check if hands are already in Hands category (from initial categorization)
    // Preserve them - they're already correctly categorized
    const existingHandsCount = parts['Hands'] ? parts['Hands'].elements.length : 0
    
    // Also check Other category for any missed hands and move them to Hands
    // Note: Hands can be either gotchi-hand (body parts) or wearable-hand (wearable parts)
    let handsInOther = []
    if (parts['Other'] && parts['Other'].elements.length > 0) {
      handsInOther = parts['Other'].elements.filter(el => {
        const elementClasses = ((el.attributes && el.attributes.class) || '').toLowerCase()
        const allElementClasses = elementClasses.split(' ').filter(c => c.trim())
        const svgCode = (el.svgCode || '').toLowerCase()
        return allElementClasses.some(c => 
          (c.includes('hand') && c.includes('gotchi')) ||
          c.includes('gotchi-hand') ||
          c.includes('wearable-hand') ||
          c.includes('handleft') ||
          c.includes('handright') ||
          c.includes('handsleft') ||
          c.includes('handsright')
        ) || svgCode.includes('gotchi-hand') || 
            svgCode.includes('gotchi-hands') ||
            svgCode.includes('wearable-hand') ||
            svgCode.includes('handleft') ||
            svgCode.includes('handright') ||
            svgCode.includes('handsleft') ||
            svgCode.includes('handsright')
      })
      
      if (handsInOther.length > 0) {
        if (!parts['Hands']) parts['Hands'] = { elements: [] }
        parts['Hands'].elements.push(...handsInOther)
        // Remove from Other
        parts['Other'].elements = parts['Other'].elements.filter(el => !handsInOther.includes(el))
        console.log(`[${viewName}] Moved ${handsInOther.length} hand element(s) from Other to Hands`)
      }
    }
    
    // Route hand elements to Hands category (same for all views)
    // This handles hands that were mis-categorized as Body
    if (handElements.length > 0) {
      if (!parts['Hands']) parts['Hands'] = { elements: [] }
      parts['Hands'].elements.push(...handElements)
      console.log(`[${viewName}] Moved ${handElements.length} hand element(s) from Body to Hands`)
    }
    
    // Debug logging for hands detection
    if (viewName === 'Left' || viewName === 'Right') {
      const finalHandsCount = parts['Hands'] ? parts['Hands'].elements.length : 0
      const handsInOtherAfter = parts['Other'] ? parts['Other'].elements.filter(el => {
        const svgCode = (el.svgCode || '').toLowerCase()
        const classes = ((el.attributes && el.attributes.class) || '').toLowerCase()
        return svgCode.includes('hand') || svgCode.includes('gotchi-hand') ||
               classes.includes('hand') || classes.includes('gotchi-hand')
      }) : []
      
      console.log(`[${viewName}] Hands detection summary:`, {
        existingHands: existingHandsCount,
        handsFromBody: handElements.length,
        handsFromOtherBefore: handsInOtherAfter.length + (handsInOther.length || 0),
        handsInOtherAfter: handsInOtherAfter.length,
        finalHandsCount: finalHandsCount,
        bodyElementsCount: parts['Body'] ? parts['Body'].elements.length : 0,
        otherElementsCount: parts['Other'] ? parts['Other'].elements.length : 0
      })
      
      // If hands are still in Other after processing, log them
      if (handsInOtherAfter.length > 0) {
        console.warn(`[${viewName}] ⚠️ Still ${handsInOtherAfter.length} hand element(s) in Other category!`, 
          handsInOtherAfter.map(el => ({
            classes: el.attributes?.class,
            svgSample: el.svgCode?.substring(0, 300)
          }))
        )
      }
    }
    
    // Route wearable elements to their proper wearable slots
    if (wearableElements.length > 0) {
      for (const element of wearableElements) {
        const elementClasses = ((element.attributes && element.attributes.class) || '').toLowerCase()
        const allElementClasses = elementClasses.split(' ').filter(c => c.trim())
        
        // Find matching wearable slot
        let routed = false
        for (const wearable of wearables) {
          const wearableClasses = wearable.className.split(' ').map(c => c.toLowerCase())
          if (wearableClasses.some(cls => allElementClasses.includes(cls))) {
            wearable.elements.push(element)
            routed = true
            break
          }
        }
        
        // If no match found, add to unidentified wearables
        if (!routed) {
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
          unidentifiedWearable.elements.push(element)
        }
      }
    }
    
    // Move plain gotchi-wearable elements (without wearable- classes) to Other (they're not body parts)
    if (plainWearables.length > 0) {
      if (!parts['Other']) parts['Other'] = { elements: [] }
      parts['Other'].elements.push(...plainWearables)
    }
    
    // Now combine body elements (excluding hands)
    if (bodyElements.length > 1 || (bodyElements.length === 1 && viewName !== 'Front')) {
      // Store original elements before combining
      const originalBodyElements = [...bodyElements]
      
      // Combine all body elements into a single composite element
      const combinedBodySvg = originalBodyElements.map(el => {
        // Extract just the inner content from each element's SVG (remove wrapper)
        const svgMatch = el.svgCode.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)
        return svgMatch ? svgMatch[1] : el.svgCode
      }).join('\n')
      
      // Create a wrapper SVG for the combined body
      const viewBox = '0 0 64 64'
      const combinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n${combinedBodySvg}\n</svg>`
      
      // Calculate combined dimensions and offset
      const minX = Math.min(...originalBodyElements.map(el => el.x))
      const minY = Math.min(...originalBodyElements.map(el => el.y))
      const maxX = Math.max(...originalBodyElements.map(el => el.x + el.width))
      const maxY = Math.max(...originalBodyElements.map(el => el.y + el.height))
    
      // Replace body elements with single combined element
      parts['Body'].elements = [{
        tag: 'g',
        id: 'gotchi-body-combined',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        offset: { x: minX, y: minY },
        dimension: { width: maxX - minX, height: maxY - minY },
        primaryFill: originalBodyElements[0]?.primaryFill || null,
        secondaryFill: originalBodyElements[0]?.secondaryFill || null,
        transform: null,
        svgCode: combinedSvg,
        attributes: {
          class: 'gotchi-body-combined',
          fill: originalBodyElements[0]?.attributes?.fill || '',
          stroke: originalBodyElements[0]?.attributes?.stroke || '',
          opacity: originalBodyElements[0]?.attributes?.opacity || null
        }
      }]
    } else if (bodyElements.length === 1) {
      // If only one body element, just use it as-is (but make sure hands are filtered)
      parts['Body'].elements = bodyElements
    } else {
      // No body elements (shouldn't happen, but handle gracefully)
      parts['Body'].elements = []
    }
  }
  
  // Final check: Ensure Hands category exists and has elements if any were found
  // This is important for side views where hands might be categorized differently
  if (viewName === 'Left' || viewName === 'Right') {
    const finalHandsCount = parts['Hands'] ? parts['Hands'].elements.length : 0
    console.log(`[${viewName}] Final hands count before filtering:`, finalHandsCount)
    
    // Double-check: scan all parts one more time for any missed hands
    // This is more aggressive - check SVG content for hand-related patterns
    let missedHands = []
    Object.entries(parts).forEach(([catName, catData]) => {
      if (catName !== 'Hands') {
        catData.elements.forEach(el => {
          const classes = ((el.attributes && el.attributes.class) || '').toLowerCase()
          const svgCode = (el.svgCode || '').toLowerCase()
          
          // More aggressive detection - check for hand patterns in SVG code
          // Hands can be gotchi-hand (body parts) or wearable-hand (wearable parts)
          const isHand = classes.includes('gotchi-hand') ||
                        classes.includes('wearable-hand') ||
                        classes.includes('handleft') ||
                        classes.includes('handright') ||
                        classes.includes('handsleft') ||
                        classes.includes('handsright') ||
                        svgCode.includes('gotchi-hand') || 
                        svgCode.includes('gotchi-hands') ||
                        svgCode.includes('wearable-hand') ||
                        svgCode.includes('class="gotchi-hand') ||
                        svgCode.includes("class='gotchi-hand") ||
                        svgCode.includes('class="wearable-hand') ||
                        svgCode.includes("class='wearable-hand") ||
                        svgCode.includes('gotchi-handsdownclosed') ||
                        svgCode.includes('gotchi-handsdownopen') ||
                        svgCode.includes('gotchi-handsup') ||
                        (svgCode.includes('hand') && (svgCode.includes('gotchi') || svgCode.includes('wearable')))
          
          // Allow wearable-hand but exclude other wearables
          const isHandWearable = classes.includes('wearable-hand')
          const isOtherWearable = classes.includes('wearable') && !isHandWearable
          
          if (isHand && !isOtherWearable) {
            missedHands.push({ 
              category: catName, 
              element: el,
              reason: classes.includes('hand') ? 'classes' : 'svg-content',
              classes: classes,
              svgSample: svgCode.substring(0, 200)
            })
          }
        })
      }
    })
    
    if (missedHands.length > 0) {
      console.warn(`[${viewName}] Found ${missedHands.length} hand element(s) in wrong categories:`, missedHands.map(h => ({ category: h.category, reason: h.reason })))
      if (!parts['Hands']) parts['Hands'] = { elements: [] }
      parts['Hands'].elements.push(...missedHands.map(h => h.element))
      // Remove from their original categories
      missedHands.forEach(({ category, element }) => {
        const catIndex = parts[category].elements.indexOf(element)
        if (catIndex > -1) {
          parts[category].elements.splice(catIndex, 1)
        }
      })
      console.log(`[${viewName}] ✅ Moved ${missedHands.length} hand element(s) to Hands category`)
    } else {
      // If no missed hands found but SVG contains hands, log what we're checking
      const svgLower = svgString.toLowerCase()
      if (svgLower.includes('gotchi-hand') || svgLower.includes('hand')) {
        console.warn(`[${viewName}] ⚠️ SVG contains hand content but final check found 0 missed hands. Checking all categories...`)
        Object.entries(parts).forEach(([catName, catData]) => {
          if (catName !== 'Hands' && catData.elements.length > 0) {
            const potentialHands = catData.elements.filter(el => {
              const svgCode = (el.svgCode || '').toLowerCase()
              const classes = ((el.attributes && el.attributes.class) || '').toLowerCase()
              return svgCode.includes('gotchi-hand') || classes.includes('gotchi-hand') ||
                     svgCode.includes('hand') || classes.includes('hand')
            })
            if (potentialHands.length > 0) {
              console.warn(`[${viewName}] Found ${potentialHands.length} potential hand(s) in ${catName} category that weren't caught:`, 
                potentialHands.map(el => ({
                  classes: el.attributes?.class,
                  svgSample: (el.svgCode || '').substring(0, 200)
                }))
              )
            }
          }
        })
      }
    }
  }
  
  // Keep all important categories, even if empty (so Body, Hands, Mouth, Eyes always show)
  // But filter out truly empty ones if they're not important categories
  const filteredParts = {}
  Object.entries(parts).forEach(([name, data]) => {
    // Always include important categories even if empty, or if they have elements
    if (alwaysShowCategories.includes(name) || data.elements.length > 0) {
      filteredParts[name] = data
    }
  })
  
  // Final debug log for side views
  if (viewName === 'Left' || viewName === 'Right') {
    console.log(`[${viewName}] Final breakdown:`, {
      hands: filteredParts['Hands']?.elements.length || 0,
      body: filteredParts['Body']?.elements.length || 0,
      other: filteredParts['Other']?.elements.length || 0,
      allCategories: Object.keys(filteredParts).map(k => ({ name: k, count: filteredParts[k].elements.length }))
    })
  }
  
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
  
  // If we've reached the end and there are no more items, don't do anything
  if (hasReachedEnd.value && !hasMoreWearables.value) {
    return
  }
  
  // If we're currently loading more items, prevent additional calls
  if (isCurrentlyLoadingMore.value) {
    return
  }
  
  // Throttle scroll events to avoid excessive calls
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  
  scrollTimeout = setTimeout(() => {
    // Check if we're near the bottom (within 200px of bottom)
    const scrollThreshold = 200
    const scrollDistance = element.scrollHeight - element.scrollTop - element.clientHeight
    const isNearBottom = scrollDistance < scrollThreshold
    
    // Check if we're actually at the bottom (within 10px)
    const isAtBottom = scrollDistance < 10
    
    if (isNearBottom && hasMoreWearables.value && !isLoadingMoreWearables.value && !isLoadingWearables.value && !hasReachedEnd.value && !isCurrentlyLoadingMore.value) {
      // Set the loading flag immediately to prevent multiple calls
      isCurrentlyLoadingMore.value = true
      
      // Save current scroll position and scroll height before loading
      savedScrollPosition.value = element.scrollTop
      previousScrollHeight.value = element.scrollHeight
      
      isLoadingMoreWearables.value = true
      loadMoreWearables()
      
      // Reset loading state after queries have had time to start
      // The scroll position will be restored when filteredWearables updates
      setTimeout(() => {
        isLoadingMoreWearables.value = false
        isCurrentlyLoadingMore.value = false // Reset the flag to allow future loads
        // Check if we're still at bottom and no more items are available
        const currentScrollDistance = element.scrollHeight - element.scrollTop - element.clientHeight
        if (currentScrollDistance < 10 && !hasMoreWearables.value) {
          hasReachedEnd.value = true
        }
      }, 500)
    } else if (isAtBottom && !hasMoreWearables.value) {
      // We're at the bottom and there are no more items to load
      hasReachedEnd.value = true
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

/* Reduce padding for gotchi parts category items only */
.breakdown-category:first-of-type .category-item {
  @apply p-2;
}

.breakdown-category:first-of-type .category-summary {
  @apply px-2 py-2;
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

