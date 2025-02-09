<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { addItemToList, getListItems, toggleItemComplete, deleteItem, getList, getUserById, removeMemberFromList, reorderItems, onListItemsChange } from '@/services/firebase-service'
import type { GroceryItem, GroceryList, User } from '@/types/firebase'
import draggable from 'vuedraggable'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const items = ref<GroceryItem[]>([])
const list = ref<GroceryList | null>(null)
const newItemName = ref('')
const newItemQuantity = ref(1)
const error = ref('')
const members = ref<User[]>([])
const isLoadingMembers = ref(false)
const showMembersMenu = ref(false)

const listId = route.params.id as string

// Add these computed properties after the existing refs
const completedItems = computed(() => {
  return items.value.filter(item => item.completed)
})

const uncompletedItems = computed(() => {
  return items.value.filter(item => !item.completed)
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

const handleAddItem = async () => {
  if (!newItemName.value.trim()) return

  try {
    await addItemToList(listId, newItemName.value.trim(), newItemQuantity.value)
    newItemName.value = ''
    newItemQuantity.value = 1
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {{ items.length }} items
            </p>
            <div v-if="isListOwner()" class="flex items-center -space-x-2">
              <template v-for="member in members.slice(0, 3)" :key="member.uid">
                <div class="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600"
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
        <div v-if="showMembersMenu"
          class="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-10 py-1 border">
          <div class="px-4 py-2 border-b flex items-center justify-between">
            <h3 class="text-sm font-medium text-gray-900">List Members</h3>
            <div v-if="isListOwner()" class="text-xs text-pink-600">Owner</div>
          </div>
          <div class="max-h-64 overflow-y-auto">
            <div v-for="member in members" :key="member.uid"
              class="px-4 py-2 hover:bg-gray-50 flex items-center justify-between group">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
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
              <button v-if="isListOwner() && member.uid !== list?.createdBy"
                @click="handleRemoveMember(member.uid)"
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
      <form @submit.prevent="handleAddItem" class="flex flex-col sm:flex-row gap-4">
        <div class="flex-1">
          <label for="itemName" class="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
          <input id="itemName" v-model="newItemName" type="text" required placeholder="Add new item"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500" />
        </div>
        <div class="w-full sm:w-24">
          <label for="quantity" class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input id="quantity" v-model.number="newItemQuantity" type="number" min="1" required
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500" />
        </div>
        <div class="sm:self-end">
          <button type="submit"
            class="w-full bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 flex items-center justify-center gap-2">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Add to List
          </button>
        </div>
      </form>
    </div>

    <!-- Items List -->
    <div class="bg-white shadow-sm rounded-lg divide-y">
      <!-- Uncompleted Items -->
      <draggable
        v-model="items"
        @end="handleReorder"
        item-key="id"
        handle=".drag-handle"
        :animation="200"
        ghost-class="bg-pink-50"
        :move="({ relatedContext, draggedContext }: MoveEvent) => {
          return draggedContext.element.completed === relatedContext.element?.completed
        }"
      >
        <template #item="{ element: item }">
          <div
            v-if="!item.completed"
            class="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group"
            :class="{ 'bg-gray-50': item.completed }"
          >
            <div class="flex items-center space-x-3 flex-1">
              <div class="flex items-center gap-2">
                <button class="drag-handle p-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-move touch-manipulation flex items-center justify-center">
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
                  </label>
                  <div class="flex items-center gap-1 text-gray-500">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                    <span class="inline-flex items-center px-2 py-0.5 text-sm font-medium">
                      × {{ item.quantity }}
                    </span>
                  </div>
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

      <!-- Completed Items Section -->
      <div v-if="completedItems.length > 0" class="border-t border-gray-100">
        <div class="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-500 flex items-center gap-2">
          <svg class="h-5 w-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Completed Items
        </div>
        <draggable
          v-model="items"
          @end="handleReorder"
          item-key="id"
          handle=".drag-handle"
          :animation="200"
          ghost-class="bg-pink-50"
          :move="({ relatedContext, draggedContext }: MoveEvent) => {
            return draggedContext.element.completed === relatedContext.element?.completed
          }"
        >
          <template #item="{ element: item }">
            <div
              v-if="item.completed"
              class="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group bg-gray-50"
            >
              <div class="flex items-center space-x-3 flex-1">
                <div class="flex items-center gap-2">
                  <button class="drag-handle p-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-move touch-manipulation flex items-center justify-center">
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
                    <label :for="item.id" class="text-gray-500 cursor-pointer select-none flex-1 line-through">
                      {{ item.name }}
                    </label>
                    <div class="flex items-center gap-1 text-gray-400">
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                      <span class="inline-flex items-center px-2 py-0.5 text-sm font-medium text-gray-400">
                        × {{ item.quantity }}
                      </span>
                    </div>
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
      </div>

      <!-- Empty State -->
      <div v-if="items.length === 0" class="p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No Items Yet</h3>
        <p class="text-gray-500">Add some items to your grocery list!</p>
      </div>
    </div>

    <!-- Completed Items Summary -->
    <div v-if="items.length > 0" class="mt-4 text-sm text-gray-500 flex items-center gap-2">
      <svg class="h-5 w-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      {{ items.filter(item => item.completed).length }} of {{ items.length }} items completed
    </div>
  </div>
</template>
