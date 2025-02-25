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
  reorderItems,
  onListItemsChange,
  deleteCompletedItems
} from '@/services/firebase-service'
import { updateItemCorrelations } from '@/services/suggestions-service'
import type { GroceryItem, GroceryList, User } from '@/types/firebase'
import draggable from 'vuedraggable'
import ItemSuggestions from '@/components/ItemSuggestions.vue'

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
const error = ref('')
const members = ref<User[]>([])
const isLoadingMembers = ref(false)
const showMembersMenu = ref(false)
const filterBy = ref('all')
const sortBy = ref('order')

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

const handleAddItem = async (itemName: string = newItemName.value.trim()) => {
  if (!itemName) return

  try {
    await addItemToList(listId, itemName, newItemQuantity.value, {
      unit: newItemUnit.value,
      category: newItemCategory.value,
      storeAisle: newItemAisle.value || undefined,
      estimatedPrice: newItemPrice.value || undefined
    })
    await updateItemCorrelations(itemName, listId)
    newItemName.value = ''
    newItemQuantity.value = 1
    newItemUnit.value = ''
    newItemCategory.value = ''
    newItemAisle.value = null
    newItemPrice.value = null
  } catch (e: any) {
    error.value = e.message
  }
}

const handleSuggestionSelect = async (suggestion: string) => {
  // Use the suggestion as the item name but preserve other form values
  // so users can set quantity, category, etc. before selecting a suggestion
  newItemName.value = suggestion
  await handleAddItem(suggestion)
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
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header with back button -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center space-x-4">
        <button @click="handleBack"
          class="text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <div class="flex items-center gap-2">
            <svg class="h-6 w-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h1 class="text-2xl font-bold text-gray-900">{{ list?.name || 'Loading...' }}</h1>
          </div>
          <div class="flex items-center gap-3 mt-1">
            <p class="text-sm text-gray-500 flex items-center gap-1">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2M7 7h10" />
              </svg>
              {{ items.length }} items
            </p>
            <div v-if="isListOwner()" class="flex items-center -space-x-2">
              <template v-for="member in members.slice(0, 3)" :key="member.uid">
                <div
                  class="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600"
                  :title="member.email">
                  {{ member.email?.[0].toUpperCase() }}
                </div>
              </template>
              <div v-if="members.length > 3"
                class="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                +{{ members.length - 3 }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Members Menu Button -->
      <div class="relative" v-if="isListOwner() && members.length > 0">
        <button @click="showMembersMenu = !showMembersMenu"
          class="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </button>

        <!-- Members Dropdown -->
        <div v-if="showMembersMenu" class="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-10 py-1 border">
          <div class="px-4 py-2 border-b flex items-center justify-between">
            <h3 class="text-sm font-medium text-gray-900">List Members</h3>
            <div v-if="isListOwner()" class="text-xs text-pink-600">Owner</div>
          </div>
          <div class="max-h-64 overflow-y-auto">
            <div v-for="member in members" :key="member.uid"
              class="px-4 py-2 hover:bg-gray-50 flex items-center justify-between group">
              <div class="flex items-center gap-2">
                <div
                  class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                  {{ member.email?.[0].toUpperCase() }}
                </div>
                <div>
                  <div class="text-sm font-medium text-gray-900">
                    {{ member.email }}
                  </div>
                  <div v-if="member.uid === list?.createdBy" class="text-xs text-pink-600">
                    Owner
                  </div>
                </div>
              </div>
              <button v-if="isListOwner() && member.uid !== list?.createdBy" @click="handleRemoveMember(member.uid)"
                class="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                <span class="sr-only">Remove member</span>
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {{ error }}
    </div>

    <!-- Add Item Form -->
    <div class="bg-white shadow-sm rounded-lg p-4 mb-6">
      <form @submit.prevent="handleAddItem()" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div class="col-span-1 sm:col-span-2">
            <label for="itemName" class="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
            <input id="itemName" v-model="newItemName" type="text" required placeholder="Add new item"
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500" />
          </div>
          <div>
            <label for="quantity" class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input id="quantity" v-model.number="newItemQuantity" type="number" min="1" required
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500" />
          </div>
          <div>
            <label for="unit" class="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select id="unit" v-model="newItemUnit"
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500">
              <option value="">items</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="lbs">lbs</option>
              <option value="oz">oz</option>
              <option value="l">liters</option>
              <option value="ml">ml</option>
              <option value="pkg">package</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label for="category" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select id="category" v-model="newItemCategory"
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500">
              <option value="">None</option>
              <option value="Produce">Produce</option>
              <option value="Dairy">Dairy</option>
              <option value="Meat">Meat</option>
              <option value="Bakery">Bakery</option>
              <option value="Frozen">Frozen</option>
              <option value="Pantry">Pantry</option>
              <option value="Beverages">Beverages</option>
              <option value="Household">Household</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label for="aisle" class="block text-sm font-medium text-gray-700 mb-1">Aisle Number</label>
            <input id="aisle" v-model.number="newItemAisle" type="number" min="0"
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500" />
          </div>
          <div>
            <label for="price" class="block text-sm font-medium text-gray-700 mb-1">Estimated Price</label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">$</span>
              </div>
              <input type="number" id="price" v-model.number="newItemPrice" min="0" step="0.01"
                class="focus:ring-pink-500 focus:border-pink-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="0.00" />
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <button type="submit"
            class="bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 flex items-center justify-center gap-2">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Add to List
          </button>
        </div>
      </form>

      <!-- Add ItemSuggestions component -->
      <ItemSuggestions :list-id="listId" @select="handleSuggestionSelect" />
    </div>

    <!-- Filter and Sort Options -->
    <div class="bg-white shadow-sm rounded-lg p-3 mb-4 flex flex-col sm:flex-row justify-between gap-3 text-sm">
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

    <!-- Items List -->
    <div class="bg-white shadow-sm rounded-lg divide-y">
      <draggable v-model="items" @end="handleReorder" item-key="id" handle=".drag-handle" :animation="200"
        ghost-class="bg-pink-50" :move="({ relatedContext, draggedContext }: MoveEvent) => {
          return draggedContext.element.completed === relatedContext.element?.completed
        }" :disabled="sortBy !== 'order'">
        <template #item="{ element: item }">
          <div v-if="(filterBy === 'all' ||
            (filterBy === 'uncompleted' && !item.completed) ||
            (filterBy === 'completed' && item.completed) ||
            (item.category === filterBy))"
            class="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group"
            :class="{ 'bg-gray-50': item.completed }">
            <div class="flex items-center space-x-3 flex-1">
              <div class="flex items-center gap-2">
                <button
                  class="drag-handle p-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-move touch-manipulation flex items-center justify-center"
                  :class="{ 'opacity-0 cursor-default': sortBy !== 'order' }">
                  <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                  </svg>
                  <span class="sr-only">Drag to reorder</span>
                </button>
                <div class="flex items-center h-5">
                  <input :id="item.id" type="checkbox" :checked="item.completed"
                    @change="handleToggleComplete(item.id, !item.completed)"
                    class="h-5 w-5 text-pink-600 focus:ring-pink-500 border-gray-300 rounded cursor-pointer" />
                </div>
              </div>
              <div class="flex flex-col sm:flex-row sm:items-center sm:gap-3 flex-1">
                <div class="flex items-center gap-2 flex-1">
                  <label :for="item.id" class="text-gray-900 cursor-pointer select-none flex-1">
                    {{ item.name }}
                    <span v-if="item.category"
                      class="inline-flex items-center ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                      {{ item.category }}
                    </span>
                  </label>
                  <div class="flex items-center gap-1 text-gray-500">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                    <span class="inline-flex items-center px-2 py-0.5 text-sm font-medium">
                      × {{ item.quantity }} {{ item.unit ? item.unit : '' }}
                    </span>
                    <span v-if="item.estimatedPrice"
                      class="inline-flex items-center px-2 py-0.5 text-sm font-medium text-green-800">
                      ${{ item.estimatedPrice.toFixed(2) }}
                    </span>
                  </div>
                </div>
                <div v-if="item.storeAisle" class="text-sm text-gray-500">
                  <span class="inline-flex items-center gap-1">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Aisle {{ item.storeAisle }}
                  </span>
                </div>
              </div>
            </div>
            <button @click="handleDeleteItem(item.id)"
              class="ml-4 text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 focus:outline-none">
              <span class="sr-only">Delete item</span>
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </template>
      </draggable>

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

    <!-- Completed Items Summary -->
    <div v-if="items.length > 0" class="mt-4 text-sm text-gray-500 flex items-center gap-2">
      <svg class="h-5 w-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      {{items.filter(item => item.completed).length}} of {{ items.length }} items completed
    </div>
  </div>
</template>
