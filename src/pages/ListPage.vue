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
  onListItemsChange,
  onListChange,
  deleteCompletedItems,
  updateListCategories,
} from '@/services/firebase-service'
import { updateItemCorrelations } from '@/services/suggestions-service'
import type { GroceryItem, GroceryList, User } from '@/types/firebase'
import ItemSuggestions from '@/components/ItemSuggestions.vue'
import ListHeader from '@/components/ListHeader.vue'
import AddItemForm from '@/components/AddItemForm.vue'
import GroceryListItem from '@/components/GroceryListItem.vue'
import ShoppingModeItem from '@/components/ShoppingModeItem.vue'

// Default categories used when none are customized
const DEFAULT_CATEGORIES = [
  'Produce', 'Dairy', 'Meat', 'Bakery', 'Frozen',
  'Pantry', 'Beverages', 'Household', 'Other'
]

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const items = ref<GroceryItem[]>([])
const list = ref<GroceryList | null>(null)
const error = ref('')
const members = ref<User[]>([])
const isLoadingMembers = ref(false)
const searchQuery = ref('')
const isShoppingMode = ref(false)
const quickAddItem = ref('')
const showCategoryManager = ref(false)
const newCategory = ref('')

const listId = route.params.id as string

// Add these computed properties after the existing refs
const completedItems = computed(() => {
  return items.value.filter(item => item.completed)
})

const uncompletedItems = computed(() => {
  return items.value.filter(item => !item.completed)
})

// Filtered items based on search query
const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) {
    return items.value
  }

  const query = searchQuery.value.toLowerCase().trim()
  return items.value.filter(item =>
    item.name.toLowerCase().includes(query) ||
    (item.category && item.category.toLowerCase().includes(query))
  )
})

// Items for shopping mode - grouped by category
const shoppingModeItems = computed(() => {
  // Separate completed and uncompleted items
  const uncompleted = items.value.filter(item => !item.completed)
  const completed = items.value.filter(item => item.completed)

  // Group uncompleted items by category
  const groupedItems: Record<string, GroceryItem[]> = {}

  uncompleted.forEach(item => {
    const category = item.category || 'Uncategorized'
    if (!groupedItems[category]) {
      groupedItems[category] = []
    }
    groupedItems[category].push(item)
  })

  // Return the structure needed for rendering
  return {
    categories: Object.keys(groupedItems).sort(),
    groupedItems,
    completed
  }
})

// Shopping progress
const shoppingProgress = computed(() => {
  const total = items.value.length
  const completed = items.value.filter(item => item.completed).length

  if (total === 0) return 0
  return Math.round((completed / total) * 100)
})

// Available categories for this list
const availableCategories = computed(() => {
  return list.value?.categories || [...DEFAULT_CATEGORIES]
})

const unsubscribeItems = ref<(() => void) | null>(null)
const unsubscribeList = ref<(() => void) | null>(null)

onMounted(async () => {
  setupRealtimeList()
  setupRealtimeItems()
  await loadMembers()
})

onUnmounted(() => {
  if (unsubscribeItems.value) {
    unsubscribeItems.value()
  }
  if (unsubscribeList.value) {
    unsubscribeList.value()
  }
})

const setupRealtimeList = () => {
  try {
    unsubscribeList.value = onListChange(listId, (updatedList) => {
      list.value = updatedList
    })
  } catch (e: any) {
    error.value = e.message
  }
}

const setupRealtimeItems = () => {
  try {
    unsubscribeItems.value = onListItemsChange(listId, (newItems) => {
      items.value = newItems
    })
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

// Add a watch for list changes to update members
watch(() => list.value, async (newList) => {
  if (newList && isListOwner()) {
    await loadMembers()
  }
}, { deep: true })

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
    await loadMembers()
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

const toggleShoppingMode = () => {
  isShoppingMode.value = !isShoppingMode.value
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

const addCategory = async () => {
  if (!newCategory.value.trim() || !isListOwner()) return

  const category = newCategory.value.trim()
  newCategory.value = ''

  try {
    // If no custom categories yet, use defaults
    const currentCategories = list.value?.categories || [...DEFAULT_CATEGORIES]

    // Only add if it doesn't already exist
    if (!currentCategories.includes(category)) {
      const updatedCategories = [...currentCategories, category]
      await updateListCategories(listId, updatedCategories)
      // List will be updated via the realtime listener
    }
  } catch (e: any) {
    error.value = e.message
  }
}

const removeCategory = async (category: string) => {
  if (!isListOwner()) return

  try {
    // If no custom categories yet, use defaults
    const currentCategories = list.value?.categories || [...DEFAULT_CATEGORIES]

    // Filter out the category to remove
    const updatedCategories = currentCategories.filter(c => c !== category)

    // Update the list with the new categories
    await updateListCategories(listId, updatedCategories)
  } catch (e: any) {
    error.value = e.message
  }
}

// Function to determine if an item was recently added (within the last 5 minutes)
const isRecentlyAdded = (item: GroceryItem) => {
  if (!item.createdAt) return false

  const itemDate = item.createdAt instanceof Date
    ? item.createdAt
    : new Date(item.createdAt)

  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

  return itemDate > fiveMinutesAgo
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header with back button -->
    <ListHeader :list="list" :item-count="items.length" :is-owner="isListOwner()" :members="members"
      :is-shopping-mode="isShoppingMode" @toggle-shopping-mode="toggleShoppingMode"
      @remove-member="handleRemoveMember" />

    <!-- Error Message -->
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {{ error }}
    </div>

    <!-- Clear Completed Button at Top - Show when there are completed items -->
    <div v-if="completedItems.length > 0" class="mb-4 flex justify-end">
      <button @click="handleDeleteCompleted"
        class="flex items-center gap-1 text-sm bg-white text-red-600 hover:text-red-800 py-2 px-3 rounded-md border border-gray-300 hover:bg-red-50 transition-colors shadow-sm">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Clear {{ completedItems.length }} Completed Items
      </button>
    </div>

    <!-- Add Item Form - Hide in shopping mode -->
    <AddItemForm v-if="!isShoppingMode" :list-id="listId" :available-categories="availableCategories"
      @add-item="handleAddItem" @suggestion-select="handleSuggestionSelect" />

    <!-- Category Manager Button for list owners - Make it more prominent -->
    <div v-if="isListOwner() && !isShoppingMode" class="mb-6 mt-1">
      <button @click="showCategoryManager = !showCategoryManager"
        class="w-full flex justify-center items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 px-4 rounded-md shadow-sm transition-colors">
        <svg class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <span v-if="showCategoryManager">Hide</span><span v-else>Manage</span> Categories
      </button>
    </div>

    <!-- Category Manager -->
    <div v-if="showCategoryManager && isListOwner() && !isShoppingMode" class="bg-white shadow-sm rounded-lg p-4 mb-6">
      <h3 class="text-sm font-medium text-gray-700 mb-2">Customize Categories</h3>

      <div class="flex flex-wrap gap-2 mb-3">
        <div v-for="category in availableCategories" :key="category"
          class="bg-gray-100 px-2 py-1 rounded-md text-sm flex items-center">
          {{ category }}
          <button @click="removeCategory(category)" class="ml-1 text-gray-500 hover:text-red-500">
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <form @submit.prevent="addCategory" class="flex gap-2">
        <input type="text" v-model="newCategory" placeholder="New category"
          class="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-sm" />
        <button type="submit"
          class="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500">
          Add
        </button>
      </form>
    </div>

    <!-- Search Bar - Hide in shopping mode -->
    <div v-if="!isShoppingMode" class="bg-white shadow-sm rounded-lg p-3 mb-4">
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
    </div>

    <!-- Quick Add Form for Shopping Mode -->
    <div v-if="isShoppingMode" class="bg-white shadow-sm rounded-lg p-3 mb-4">
      <form @submit.prevent="handleQuickAdd" class="flex items-center gap-2">
        <div class="flex-1 relative rounded-md shadow-sm">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <input type="text" v-model="quickAddItem" placeholder="Quickly add an item..."
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm" />
        </div>
        <button type="submit"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500">
          Add
        </button>
      </form>
    </div>

    <!-- Shopping Progress Bar - Only in shopping mode -->
    <div v-if="isShoppingMode" class="bg-white shadow-sm rounded-lg p-3 mb-4">
      <div class="flex items-center justify-between mb-1">
        <div class="text-sm font-medium text-gray-700">Shopping Progress</div>
        <div class="text-sm text-gray-500">{{items.filter(item => item.completed).length}} / {{ items.length }} items
        </div>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2.5">
        <div class="bg-green-500 h-2.5 rounded-full transition-all duration-500"
          :style="{ width: `${shoppingProgress}%` }"></div>
      </div>
    </div>

    <!-- Normal Mode Items List -->
    <div v-if="!isShoppingMode" class="bg-white shadow-sm rounded-lg divide-y">
      <div v-for="item in filteredItems" :key="item.id" :class="{ 'bg-yellow-50': isRecentlyAdded(item) }">
        <GroceryListItem :item="item" :is-draggable="false" @toggle-complete="handleToggleComplete"
          @delete-item="handleDeleteItem" />
        <div v-if="isRecentlyAdded(item)" class="px-4 py-1 text-xs text-yellow-600 bg-yellow-50 flex items-center">
          <svg class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Recently Added
        </div>
      </div>

      <!-- Empty State - Show when no items match the filter -->
      <div v-if="filteredItems.length === 0" class="p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No Items Found</h3>
        <p class="text-gray-500" v-if="items.length > 0">Try a different search query.</p>
        <p class="text-gray-500" v-else>Add some items to your grocery list!</p>
      </div>
    </div>

    <!-- Shopping Mode Items Display -->
    <div v-if="isShoppingMode" class="bg-white shadow-sm rounded-lg divide-y">
      <!-- Uncompleted items by category -->
      <div v-for="category in shoppingModeItems.categories" :key="category">
        <!-- Category header -->
        <div class="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
          {{ category }}
        </div>

        <!-- Items in this category -->
        <div v-for="item in shoppingModeItems.groupedItems[category]" :key="item.id"
          :class="{ 'bg-yellow-50': isRecentlyAdded(item) }">
          <ShoppingModeItem :item="item" @toggle-complete="handleToggleComplete" />
          <div v-if="isRecentlyAdded(item)" class="px-4 py-1 text-xs text-yellow-600 bg-yellow-50 flex items-center">
            <svg class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recently Added
          </div>
        </div>
      </div>

      <!-- Completed items section -->
      <div v-if="shoppingModeItems.completed.length > 0">
        <div class="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
          Completed Items
        </div>
        <div v-for="item in shoppingModeItems.completed" :key="item.id"
          :class="{ 'bg-yellow-50': isRecentlyAdded(item) }">
          <ShoppingModeItem :item="item" @toggle-complete="handleToggleComplete" />
          <div v-if="isRecentlyAdded(item)" class="px-4 py-1 text-xs text-yellow-600 bg-yellow-50 flex items-center">
            <svg class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recently Added
          </div>
        </div>
      </div>

      <!-- Empty state for shopping mode -->
      <div v-if="items.length === 0" class="p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">Your Shopping List is Empty</h3>
        <p class="text-gray-500">Add some items to start shopping!</p>
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
/* Add a subtle transition for shopping mode */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}
</style>
