<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  addItemToList,
  getListItems,
  toggleItemComplete,
  deleteItem,
  getList,
  getUserById,
  removeMemberFromList,
  reorderItems,
  onListItemsChange,
  deleteCompletedItems,
} from '@/services/firebase-service'
import { updateItemCorrelations } from '@/services/suggestions-service'
import type { GroceryItem, GroceryList, User } from '@/types/firebase'
import draggable from 'vuedraggable'
import ItemSuggestions from '@/components/ItemSuggestions.vue'
import ListHeader from '@/components/ListHeader.vue'
import AddItemForm from '@/components/AddItemForm.vue'
import GroceryListItem from '@/components/GroceryListItem.vue'
import ShoppingModeItem from '@/components/ShoppingModeItem.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const items = ref<GroceryItem[]>([])
const list = ref<GroceryList | null>(null)
const newItemName = ref('')
const newItemQuantity = ref(1)
const newItemUnit = ref('')
const newItemCategory = ref('')
const newItemAisle = ref<number | null>(null)
const newItemPrice = ref<number | null>(null)
const newItemNote = ref('')
const error = ref('')
const members = ref<User[]>([])
const isLoadingMembers = ref(false)
const showMembersMenu = ref(false)
const filterBy = ref('all')
const sortBy = ref('order')
const searchQuery = ref('')
const isShoppingMode = ref(false)
const quickAddItem = ref('')

const listId = route.params.id as string

// Add these computed properties after the existing refs
const completedItems = computed(() => {
  return items.value.filter(item => item.completed)
})

const uncompletedItems = computed(() => {
  return items.value.filter(item => !item.completed)
})

const uniqueCategories = computed(() => {
  const categories = items.value
    .map(item => item.category)
    .filter(category => category) // Remove undefined/empty categories

  // Return unique categories
  return [...new Set(categories)]
})

const filteredSortedItems = computed(() => {
  // First, filter the items
  let result = [...items.value]

  // Apply search query filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter(item =>
      item.name.toLowerCase().includes(query) ||
      (item.category && item.category.toLowerCase().includes(query))
    )
  }

  // Apply category/status filters
  if (filterBy.value === 'completed') {
    result = result.filter(item => item.completed)
  } else if (filterBy.value === 'uncompleted') {
    result = result.filter(item => !item.completed)
  } else if (uniqueCategories.value.includes(filterBy.value)) {
    // Filter by specific category
    result = result.filter(item => item.category === filterBy.value)
  }

  // Then, sort the items
  if (sortBy.value === 'name') {
    result.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortBy.value === 'category') {
    result.sort((a, b) => {
      // Handle undefined categories
      const catA = a.category || ''
      const catB = b.category || ''
      return catA.localeCompare(catB)
    })
  } else if (sortBy.value === 'price') {
    result.sort((a, b) => {
      const priceA = a.estimatedPrice || 0
      const priceB = b.estimatedPrice || 0
      return priceA - priceB
    })
  } else if (sortBy.value === 'aisle') {
    result.sort((a, b) => {
      const aisleA = a.storeAisle || Number.MAX_SAFE_INTEGER
      const aisleB = b.storeAisle || Number.MAX_SAFE_INTEGER
      return aisleA - aisleB
    })
  } else if (sortBy.value === 'recent') {
    // Most recently added first
    result.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)
      return dateB.getTime() - dateA.getTime()
    })
  }
  // If sortBy.value === 'order', we keep the original order

  return result
})

// Items for shopping mode - uncompleted first, then sorted by aisle if available
const shoppingModeItems = computed(() => {
  const uncompleted = items.value.filter(item => !item.completed)
  const completed = items.value.filter(item => item.completed)

  // Sort uncompleted items by aisle when available
  if (uncompleted.some(item => item.storeAisle !== undefined && item.storeAisle !== null)) {
    uncompleted.sort((a, b) => {
      const aisleA = a.storeAisle !== undefined && a.storeAisle !== null ? a.storeAisle : Number.MAX_SAFE_INTEGER
      const aisleB = b.storeAisle !== undefined && b.storeAisle !== null ? b.storeAisle : Number.MAX_SAFE_INTEGER
      return aisleA - aisleB
    })
  }

  // Sort by category as secondary sort
  const uncompletedByCategory: Record<string, GroceryItem[]> = {}
  let result: GroceryItem[] = []

  // Group by category
  uncompleted.forEach(item => {
    const category = item.category || 'Uncategorized'
    if (!uncompletedByCategory[category]) {
      uncompletedByCategory[category] = []
    }
    uncompletedByCategory[category].push(item)
  })

  // Add items by category
  Object.keys(uncompletedByCategory).sort().forEach(category => {
    result = result.concat(uncompletedByCategory[category])
  })

  // If no categories or aisles, just use uncompleted items as is
  if (result.length === 0) {
    result = uncompleted
  }

  // Add completed items at the end
  return [...result, ...completed]
})

// Calculate total estimated cost
const totalEstimatedCost = computed(() => {
  return items.value.reduce((sum, item) => {
    const itemCost = item.estimatedPrice
      ? item.estimatedPrice * item.quantity
      : 0
    return sum + itemCost
  }, 0)
})

// Add these types at the top of the script section
interface DragContext {
  element: GroceryItem;
  index: number;
}

interface MoveEvent {
  relatedContext: { element?: GroceryItem };
  draggedContext: DragContext;
}

const unsubscribeItems = ref<(() => void) | null>(null)

onMounted(async () => {
  await loadList()
  setupRealtimeItems()
  await loadMembers()

  // Shopping mode onboarding
  const hasSeenBefore = localStorage.getItem(`shopping-mode-tooltip-seen-${listId}`)

  if (!hasSeenBefore && items.value.length > 2) {
    // Wait a second before showing the tooltip to let the page load
    setTimeout(() => {
      showShoppingModeTooltip.value = true
    }, 1000)
  }
})

onUnmounted(() => {
  if (unsubscribeItems.value) {
    unsubscribeItems.value()
  }
})

const setupRealtimeItems = () => {
  try {
    unsubscribeItems.value = onListItemsChange(listId, (newItems) => {
      items.value = newItems
    })
  } catch (e: any) {
    error.value = e.message
  }
}

const loadList = async () => {
  try {
    list.value = await getList(listId)
  } catch (e: any) {
    error.value = e.message
  }
}

const loadMembers = async () => {
  if (!list.value || !isListOwner()) return

  try {
    isLoadingMembers.value = true
    const memberPromises = list.value.members.map(userId => getUserById(userId))
    members.value = await Promise.all(memberPromises)
  } catch (e: any) {
    error.value = e.message
  } finally {
    isLoadingMembers.value = false
  }
}

const handleAddItem = async (itemName: string, quantity: number, options: any) => {
  try {
    await addItemToList(listId, itemName, quantity, options)
    await updateItemCorrelations(itemName, listId)
  } catch (e: any) {
    error.value = e.message
  }
}

const handleSuggestionSelect = async (suggestion: string) => {
  try {
    await addItemToList(listId, suggestion, 1)
    await updateItemCorrelations(suggestion, listId)
  } catch (e: any) {
    error.value = e.message
  }
}

const handleToggleComplete = async (itemId: string, completed: boolean) => {
  try {
    await toggleItemComplete(itemId, completed)
  } catch (e: any) {
    error.value = e.message
  }
}

const handleDeleteItem = async (itemId: string) => {
  try {
    await deleteItem(itemId)
  } catch (e: any) {
    error.value = e.message
  }
}

const handleBack = () => {
  router.push('/')
}

const isListOwner = () => {
  return auth.user?.uid === list.value?.createdBy
}

const handleRemoveMember = async (userId: string) => {
  if (!confirm('Are you sure you want to remove this member from the list?')) {
    return
  }

  try {
    await removeMemberFromList(listId, userId)
    await loadList()
    await loadMembers()
  } catch (e: any) {
    error.value = e.message
  }
}

const handleReorder = async () => {
  try {
    // Combine both arrays with uncompleted first, then completed
    const orderedItems = [...uncompletedItems.value, ...completedItems.value]
    const updatedItems = orderedItems.map((item, index) => ({
      id: item.id,
      order: index
    }))
    await reorderItems(listId, updatedItems)
  } catch (e: any) {
    error.value = e.message
  }
}

const handleDeleteCompleted = async () => {
  if (!completedItems.value.length) return

  if (!confirm(`Are you sure you want to delete all ${completedItems.value.length} completed items?`)) {
    return
  }

  try {
    await deleteCompletedItems(listId)
  } catch (e: any) {
    error.value = e.message
  }
}

const handleQuickAdd = async () => {
  if (!quickAddItem.value.trim()) return

  const itemName = quickAddItem.value.trim()
  quickAddItem.value = ''

  try {
    await addItemToList(listId, itemName, 1)
    await updateItemCorrelations(itemName, listId)
  } catch (e: any) {
    error.value = e.message
  }
}

const toggleShoppingMode = () => {
  isShoppingMode.value = !isShoppingMode.value
}

// Shopping mode onboarding
const showShoppingModeTooltip = ref(false)
const hasSeenShoppingModeTooltip = ref(false)

const dismissShoppingModeTooltip = () => {
  showShoppingModeTooltip.value = false
  hasSeenShoppingModeTooltip.value = true
  localStorage.setItem(`shopping-mode-tooltip-seen-${listId}`, 'true')
}

// Hide tooltip when shopping mode is activated
watch(isShoppingMode, (newValue) => {
  if (newValue) {
    showShoppingModeTooltip.value = false
    hasSeenShoppingModeTooltip.value = true
    localStorage.setItem(`shopping-mode-tooltip-seen-${listId}`, 'true')
  }
})
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header with back button -->
    <ListHeader :list="list" :item-count="items.length" :is-owner="isListOwner()" :members="members"
      :is-shopping-mode="isShoppingMode" @toggle-shopping-mode="toggleShoppingMode"
      @remove-member="handleRemoveMember" />

    <!-- Shopping Mode Onboarding Tooltip -->
    <div v-if="showShoppingModeTooltip && items.length > 2"
      class="fixed bottom-4 right-4 w-80 bg-white rounded-lg shadow-xl border border-pink-200 p-4 z-50 animate-bounce-once">
      <div class="absolute -top-2 -right-2">
        <button @click="dismissShoppingModeTooltip"
          class="bg-pink-100 rounded-full p-1 text-pink-700 hover:bg-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-500">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex items-start mb-3">
        <div class="bg-pink-100 rounded-full p-2 mr-3">
          <svg class="h-6 w-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <h3 class="font-semibold text-gray-900">Ready to go shopping?</h3>
          <p class="text-sm text-gray-600 mt-1">
            Try Shopping Mode to view your items by category and aisle for an easier in-store experience!
          </p>
        </div>
      </div>

      <button @click="toggleShoppingMode"
        class="w-full bg-pink-600 text-white p-2 rounded-md font-medium hover:bg-pink-700 transition-colors">
        Try Shopping Mode
      </button>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {{ error }}
    </div>

    <!-- Add Item Form -->
    <AddItemForm v-if="!isShoppingMode" :list-id="listId" @add-item="handleAddItem"
      @suggestion-select="handleSuggestionSelect" />

    <!-- Filter and Sort Options -->
    <div v-if="!isShoppingMode" class="bg-white shadow-sm rounded-lg p-3 mb-4 flex flex-col gap-3 text-sm">
      <!-- Search Bar -->
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input type="text" v-model="searchQuery" placeholder="Search items..."
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm" />
      </div>

      <div class="flex flex-col sm:flex-row justify-between gap-3">
        <div class="flex items-center gap-2">
          <label for="filterBy" class="font-medium text-gray-700">Filter:</label>
          <select id="filterBy" v-model="filterBy"
            class="rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-sm">
            <option value="all">All Items</option>
            <option value="uncompleted">Uncompleted Only</option>
            <option value="completed">Completed Only</option>
            <option v-for="category in uniqueCategories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label for="sortBy" class="font-medium text-gray-700">Sort By:</label>
          <select id="sortBy" v-model="sortBy"
            class="rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-sm">
            <option value="order">Custom Order</option>
            <option value="name">Name A-Z</option>
            <option value="category">Category</option>
            <option value="price">Price</option>
            <option value="aisle">Aisle</option>
            <option value="recent">Recently Added</option>
          </select>
        </div>
      </div>
    </div>


    <!-- Shopping Mode Banner -->
    <div v-if="isShoppingMode"
      class="bg-gradient-to-r from-pink-600 to-pink-500 text-white rounded-lg p-3 mb-4 shadow-md relative overflow-hidden">
      <!-- Visual indicator for shopping mode -->
      <div class="absolute top-0 right-0 w-16 h-16 transform translate-x-6 -translate-y-6">
        <div class="absolute top-0 right-0 w-full h-full bg-pink-400 opacity-30 rounded-full"></div>
      </div>

      <div class="flex items-center justify-between relative z-10">
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5 flex-shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <div class="flex-grow">
            <div class="font-bold text-sm sm:text-base">Shopping Mode</div>
            <div class="text-xs text-pink-100">Items grouped by category & aisle</div>
          </div>
        </div>
        <button @click="isShoppingMode = false"
          class="bg-white text-pink-600 hover:bg-pink-50 px-3 py-1 rounded text-xs font-medium">
          Exit
        </button>
      </div>

      <!-- Quick Add -->
      <form @submit.prevent="handleQuickAdd" class="mt-2 flex items-center gap-2 relative z-10">
        <div class="flex-1 relative rounded-md shadow-sm">
          <div class="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <svg class="h-4 w-4 text-pink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <input type="text" v-model="quickAddItem" placeholder="Add a missed item..."
            class="block w-full rounded-md border-0 ring-1 ring-inset ring-pink-300 bg-white/90 text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-white pl-7 pr-2 py-1.5 text-sm" />
        </div>
        <button type="submit"
          class="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-pink-600 bg-white hover:bg-pink-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500">
          Add
        </button>
      </form>
    </div>

    <!-- Items List -->
    <div class="bg-white shadow-sm rounded-lg divide-y">
      <draggable v-if="!isShoppingMode" v-model="items" @end="handleReorder" item-key="id" handle=".drag-handle"
        :animation="200" ghost-class="bg-pink-50" :move="({ relatedContext, draggedContext }: MoveEvent) => {
          return draggedContext.element.completed === relatedContext.element?.completed
        }" :disabled="sortBy !== 'order'">
        <template #item="{ element: item }">
          <GroceryListItem v-if="filteredSortedItems.includes(item)" :item="item" :is-draggable="sortBy === 'order'"
            @toggle-complete="handleToggleComplete" @delete-item="handleDeleteItem" />
        </template>
      </draggable>

      <!-- Shopping Mode Item Display -->
      <div v-if="isShoppingMode">
        <!-- Category Headers -->
        <template v-for="(item, index) in shoppingModeItems" :key="item.id">
          <!-- Category header -->
          <div v-if="index === 0 || item.category !== shoppingModeItems[index - 1].category"
            class="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
            {{ item.category || 'Uncategorized' }}
            <span v-if="item.storeAisle" class="ml-2 text-gray-500">
              (Aisle {{ item.storeAisle }})
            </span>
          </div>

          <!-- Shopping Mode Item Component -->
          <ShoppingModeItem :item="item" @toggle-complete="handleToggleComplete" />
        </template>
      </div>

      <!-- Empty State - Show when no items match the filter -->
      <div v-if="filteredSortedItems.length === 0" class="p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No Items Found</h3>
        <p class="text-gray-500" v-if="items.length > 0">Try changing your filter or sort options.</p>
        <p class="text-gray-500" v-else>Add some items to your grocery list!</p>
      </div>
    </div>

    <!-- Completed Items Summary with Clear Completed button -->
    <div v-if="items.length > 0" class="mt-4 flex justify-between items-center">
      <div class="text-sm text-gray-500 flex items-center gap-2">
        <svg class="h-5 w-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        {{items.filter(item => item.completed).length}} of {{ items.length }} items completed
      </div>

      <button v-if="completedItems.length > 0" @click="handleDeleteCompleted"
        class="flex items-center gap-1 text-sm text-red-600 hover:text-red-800 py-1 px-2 rounded-md hover:bg-red-50 transition-colors">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Clear {{ completedItems.length }} Completed
      </button>
    </div>
  </div>
</template>

<style>
@keyframes bounce-once {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }
}

.animate-bounce-once {
  animation: bounce-once 2s ease-in-out 3;
}
</style>
