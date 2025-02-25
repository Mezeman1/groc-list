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
  deleteCompletedItems,
  updateListBudget
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
const newItemNote = ref('')
const error = ref('')
const members = ref<User[]>([])
const isLoadingMembers = ref(false)
const showMembersMenu = ref(false)
const filterBy = ref('all')
const sortBy = ref('order')
const searchQuery = ref('')
const isShoppingMode = ref(false)
const showBudgetModal = ref(false)
const listBudget = ref<number | null>(null)
const showBudgetWarning = ref(false)
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

// Calculate budget progress percentage
const budgetPercentage = computed(() => {
  if (!list.value?.budget || list.value.budget <= 0) return 0

  const percentage = (totalEstimatedCost.value / list.value.budget) * 100
  return Math.min(100, Math.round(percentage))
})

// Check if we're over budget
const isOverBudget = computed(() => {
  if (!list.value?.budget) return false
  return totalEstimatedCost.value > list.value.budget
})

// Budget status class
const budgetStatusClass = computed(() => {
  if (isOverBudget.value) return 'text-red-600'
  if (budgetPercentage.value > 90) return 'text-orange-600'
  return 'text-green-600'
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

  // Store input values in local variables
  const inputName = itemName
  const quantity = newItemQuantity.value
  const unit = newItemUnit.value
  const category = newItemCategory.value
  const aisle = newItemAisle.value
  const price = newItemPrice.value
  const note = newItemNote.value

  // Clear form immediately
  newItemName.value = ''
  newItemQuantity.value = 1
  newItemUnit.value = ''
  newItemCategory.value = ''
  newItemAisle.value = null
  newItemPrice.value = null
  newItemNote.value = ''

  try {
    // Use stored values for database operations
    await addItemToList(listId, inputName, quantity, {
      unit,
      category,
      storeAisle: aisle || undefined,
      estimatedPrice: price || undefined,
      note: note || undefined
    })
    await updateItemCorrelations(inputName, listId)
  } catch (e: any) {
    error.value = e.message
  }
}

const handleSuggestionSelect = async (suggestion: string) => {
  // Set the suggestion as the item name
  newItemName.value = suggestion

  // Then call handleAddItem which will handle clearing the form
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

const handlePrintList = () => {
  // Create a nicely formatted version of the list to print
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Please allow popups to print the list')
    return
  }

  const currentDate = new Date().toLocaleDateString()
  const items = filteredSortedItems.value

  // Organize by category if there are categories
  const categories: Record<string, GroceryItem[]> = {}
  let hasCategories = false

  items.forEach(item => {
    const category = item.category || 'Uncategorized'
    hasCategories = hasCategories || !!item.category

    if (!categories[category]) {
      categories[category] = []
    }
    categories[category].push(item)
  })

  // Generate HTML for printing
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${list.value?.name || 'Grocery List'} - ${currentDate}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #975A5C; }
        h2 { color: #975A5C; margin-top: 20px; border-bottom: 1px solid #EED3D4; padding-bottom: 5px; }
        .item { padding: 8px 0; display: flex; align-items: center; }
        .checkbox { width: 20px; height: 20px; margin-right: 10px; border: 1px solid #ccc; display: inline-block; }
        .completed { text-decoration: line-through; color: #888; }
        .quantity { color: #666; margin-left: 10px; font-size: 0.9em; }
        .price { color: #4B5563; margin-left: 10px; font-size: 0.9em; }
        .aisle { color: #4B5563; margin-left: 10px; font-size: 0.9em; }
        .footer { margin-top: 40px; font-size: 0.8em; color: #888; text-align: center; }
        @media print {
          body { font-size: 14px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align: right; margin-bottom: 20px;">
        <button onclick="window.print()">Print</button>
      </div>
      <h1>${list.value?.name || 'Grocery List'}</h1>
      <div>${currentDate}</div>
  `

  if (hasCategories) {
    // Output grouped by category
    Object.keys(categories).sort().forEach(category => {
      html += `<h2>${category}</h2>`
      categories[category].forEach(item => {
        html += `
          <div class="item ${item.completed ? 'completed' : ''}">
            <div class="checkbox"></div>
            <div>
              ${item.name}
              <span class="quantity">× ${item.quantity}${item.unit ? ' ' + item.unit : ''}</span>
              ${item.estimatedPrice ? `<span class="price">$${item.estimatedPrice.toFixed(2)}</span>` : ''}
              ${item.storeAisle ? `<span class="aisle">Aisle ${item.storeAisle}</span>` : ''}
            </div>
          </div>
        `
      })
    })
  } else {
    // Simple list without categories
    items.forEach(item => {
      html += `
        <div class="item ${item.completed ? 'completed' : ''}">
          <div class="checkbox"></div>
          <div>
            ${item.name}
            <span class="quantity">× ${item.quantity}${item.unit ? ' ' + item.unit : ''}</span>
            ${item.estimatedPrice ? `<span class="price">$${item.estimatedPrice.toFixed(2)}</span>` : ''}
            ${item.storeAisle ? `<span class="aisle">Aisle ${item.storeAisle}</span>` : ''}
          </div>
        </div>
      `
    })
  }

  html += `
      <div class="footer">
        Generated from Groc List on ${currentDate}
      </div>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}

const handleSetBudget = async () => {
  if (!list.value) return

  try {
    await updateListBudget(listId, listBudget.value)
    // Update local list
    if (list.value) {
      list.value.budget = listBudget.value === null ? undefined : listBudget.value
    }
    showBudgetModal.value = false
  } catch (e: any) {
    error.value = e.message
  }
}

const openBudgetModal = () => {
  // Initialize the budget input with the current budget
  listBudget.value = list.value?.budget || null
  showBudgetModal.value = true
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

      <!-- Print button -->
      <button @click="handlePrintList"
        class="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500"
        title="Print or Export List">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
      </button>

      <!-- Shopping Mode toggle -->
      <button @click="isShoppingMode = !isShoppingMode"
        class="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500"
        :class="{ 'bg-pink-100 text-pink-800': isShoppingMode }" title="Toggle Shopping Mode">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </button>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {{ error }}
    </div>

    <!-- Add Item Form -->
    <div v-if="!isShoppingMode" class="bg-white shadow-sm rounded-lg p-4 mb-6">
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

        <!-- Notes Field -->
        <div>
          <label for="note" class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea id="note" v-model="newItemNote" rows="2" placeholder="Add any special instructions or notes..."
            class="shadow-sm focus:ring-pink-500 focus:border-pink-500 block w-full sm:text-sm border-gray-300 rounded-md"></textarea>
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

    <!-- Budget Summary -->
    <div v-if="items.some(item => item.estimatedPrice)" class="bg-white shadow-sm rounded-lg p-3 mb-4">
      <div class="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 text-sm font-medium mb-1">
            <svg class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Estimated Total:</span>
            <span :class="budgetStatusClass" class="font-bold">${{ totalEstimatedCost.toFixed(2) }}</span>
            <span v-if="list?.budget" class="text-gray-500">of ${{ list.budget.toFixed(2) }} budget</span>
          </div>

          <!-- Budget Progress Bar -->
          <div v-if="list?.budget" class="w-full bg-gray-200 rounded-full h-2.5 mb-1">
            <div class="h-2.5 rounded-full" :style="{ width: `${budgetPercentage}%` }" :class="[
              isOverBudget ? 'bg-red-600' :
                budgetPercentage > 90 ? 'bg-orange-500' : 'bg-green-500'
            ]">
            </div>
          </div>
          <div v-if="list?.budget" class="text-xs text-gray-500">
            {{ isOverBudget ? 'Over budget!' : `${(100 - budgetPercentage)}% remaining` }}
          </div>
        </div>

        <button @click="openBudgetModal"
          class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500">
          {{ list?.budget ? 'Update Budget' : 'Set Budget' }}
        </button>
      </div>
    </div>

    <!-- Shopping Mode Banner -->
    <div v-if="isShoppingMode" class="bg-pink-50 border border-pink-200 rounded-lg p-3 mb-4 text-pink-800">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2 text-sm font-medium">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Shopping Mode Active</span>
        </div>
        <button @click="isShoppingMode = false" class="text-pink-700 px-2 py-1 rounded hover:bg-pink-100 text-xs">
          Exit
        </button>
      </div>

      <!-- Quick Add -->
      <form @submit.prevent="handleQuickAdd" class="flex items-center gap-2">
        <div class="flex-1 relative rounded-md shadow-sm">
          <input type="text" v-model="quickAddItem" placeholder="Quickly add a missed item..."
            class="block w-full rounded-md border-pink-300 bg-white focus:border-pink-500 focus:ring-pink-500 pl-3 pr-3 py-2 text-sm" />
        </div>
        <button type="submit"
          class="inline-flex items-center p-2 border border-transparent rounded-md shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span class="sr-only">Add</span>
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
          <div v-if="filteredSortedItems.includes(item)"
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
                    <!-- Notes indicator if present -->
                    <span v-if="item.note" class="ml-1 text-gray-500 text-xs" title="Has notes">
                      <svg class="inline-block h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
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
                <!-- Item notes if present -->
                <div v-if="item.note" class="text-sm text-gray-500 flex items-start gap-1 ml-5 mt-1 italic">
                  <span>{{ item.note }}</span>
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

          <!-- Shopping Mode Item -->
          <div @click="handleToggleComplete(item.id, !item.completed)"
            class="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
            :class="{ 'bg-green-50': item.completed }">
            <div class="flex items-center space-x-3 flex-1">
              <div class="flex-shrink-0">
                <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                  :class="item.completed ? 'border-green-500 bg-green-500' : 'border-gray-300'">
                  <svg v-if="item.completed" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span :class="{ 'line-through text-gray-500': item.completed }">
                    {{ item.name }}
                  </span>
                  <span class="text-sm text-gray-500">
                    × {{ item.quantity }} {{ item.unit || '' }}
                  </span>
                </div>

                <!-- Item notes in shopping mode -->
                <div v-if="item.note" class="text-xs text-gray-500 italic mb-1">
                  {{ item.note }}
                </div>

                <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span v-if="item.estimatedPrice" class="flex items-center gap-1">
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ${{ item.estimatedPrice.toFixed(2) }}
                  </span>

                  <span v-if="item.storeAisle" class="flex items-center gap-1">
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Aisle {{ item.storeAisle }}
                  </span>
                </div>
              </div>
            </div>
          </div>
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

    <!-- Budget Modal -->
    <div v-if="showBudgetModal"
      class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6" @click.stop>
        <h3 class="text-lg font-medium text-gray-900 mb-4">
          {{ list?.budget ? 'Update Budget' : 'Set Budget' }}
        </h3>

        <div class="space-y-4">
          <div>
            <label for="budget" class="block text-sm font-medium text-gray-700 mb-1">Budget Amount</label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">$</span>
              </div>
              <input type="number" id="budget" v-model.number="listBudget" min="0" step="0.01"
                class="focus:ring-pink-500 focus:border-pink-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="0.00" />
            </div>
          </div>

          <div class="text-sm text-gray-500" v-if="totalEstimatedCost > 0">
            <p>Estimated total cost: <span class="font-medium">${{ totalEstimatedCost.toFixed(2) }}</span></p>
            <p v-if="listBudget !== null && listBudget > 0 && listBudget < totalEstimatedCost"
              class="text-red-600 mt-1">
              Warning: This budget is less than your current estimated total.
            </p>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <button @click="showBudgetModal = false" type="button"
              class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500">
              Cancel
            </button>
            <button @click="handleSetBudget" type="button"
              class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500">
              {{ listBudget === null ? 'Remove Budget' : 'Save Budget' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
