<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
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
  deleteCompletedItems,
} from '@/services/firebase-service'
import { updateItemCorrelations } from '@/services/suggestions-service'
import type { GroceryItem, GroceryList, User } from '@/types/firebase'
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
const error = ref('')
const members = ref<User[]>([])
const isLoadingMembers = ref(false)
const searchQuery = ref('')
const isShoppingMode = ref(false)

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

const unsubscribeItems = ref<(() => void) | null>(null)

onMounted(async () => {
  await loadList()
  setupRealtimeItems()
  await loadMembers()
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
    <AddItemForm v-if="!isShoppingMode" :list-id="listId" @add-item="handleAddItem"
      @suggestion-select="handleSuggestionSelect" />

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
      <div v-for="item in filteredItems" :key="item.id">
        <GroceryListItem :item="item" :is-draggable="false" @toggle-complete="handleToggleComplete"
          @delete-item="handleDeleteItem" />
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
        <div v-for="item in shoppingModeItems.groupedItems[category]" :key="item.id">
          <ShoppingModeItem :item="item" @toggle-complete="handleToggleComplete" />
        </div>
      </div>

      <!-- Completed items section -->
      <div v-if="shoppingModeItems.completed.length > 0">
        <div class="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
          Completed Items
        </div>
        <div v-for="item in shoppingModeItems.completed" :key="item.id">
          <ShoppingModeItem :item="item" @toggle-complete="handleToggleComplete" />
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
