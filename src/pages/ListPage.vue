<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { addItemToList, getListItems, toggleItemComplete, deleteItem, getList } from '@/services/firebase-service'
import type { GroceryItem, GroceryList } from '@/types/firebase'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const items = ref<GroceryItem[]>([])
const list = ref<GroceryList | null>(null)
const newItemName = ref('')
const newItemQuantity = ref(1)
const error = ref('')

const listId = route.params.id as string

onMounted(async () => {
  await loadList()
  await loadItems()
})

const loadList = async () => {
  try {
    list.value = await getList(listId)
  } catch (e: any) {
    error.value = e.message
  }
}

const loadItems = async () => {
  try {
    items.value = await getListItems(listId)
  } catch (e: any) {
    error.value = e.message
  }
}

const handleAddItem = async () => {
  if (!newItemName.value.trim()) return

  try {
    await addItemToList(listId, newItemName.value.trim(), newItemQuantity.value)
    newItemName.value = ''
    newItemQuantity.value = 1
    await loadItems()
  } catch (e: any) {
    error.value = e.message
  }
}

const handleToggleComplete = async (itemId: string, completed: boolean) => {
  try {
    await toggleItemComplete(itemId, completed)
    await loadItems()
  } catch (e: any) {
    error.value = e.message
  }
}

const handleDeleteItem = async (itemId: string) => {
  try {
    await deleteItem(itemId)
    await loadItems()
  } catch (e: any) {
    error.value = e.message
  }
}

const handleBack = () => {
  router.push('/')
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header with back button -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center space-x-4">
        <button @click="handleBack"
          class="text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <div class="flex items-center gap-2">
            <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h1 class="text-2xl font-bold text-gray-900">{{ list?.name || 'Loading...' }}</h1>
          </div>
          <p class="text-sm text-gray-500 mt-1 flex items-center gap-1">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {{ items.length }} items
          </p>
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
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500" />
        </div>
        <div class="w-full sm:w-24">
          <label for="quantity" class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input id="quantity" v-model.number="newItemQuantity" type="number" min="1" required
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500" />
        </div>
        <div class="sm:self-end">
          <button type="submit"
            class="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center justify-center gap-2">
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
      <div v-for="item in items" :key="item.id"
        class="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        :class="{ 'bg-gray-50': item.completed }">
        <div class="flex items-center space-x-3 flex-1">
          <div class="flex items-center h-5">
            <input :id="item.id" type="checkbox" :checked="item.completed"
              @change="handleToggleComplete(item.id, !item.completed)"
              class="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer" />
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center sm:gap-3 flex-1">
            <div class="flex items-center gap-2 flex-1">
              <label :for="item.id" class="text-gray-900 cursor-pointer select-none flex-1"
                :class="{ 'line-through text-gray-500': item.completed }">
                {{ item.name }}
              </label>
              <div class="flex items-center gap-1 text-gray-500">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                <span class="inline-flex items-center px-2 py-0.5 text-sm font-medium"
                  :class="item.completed ? 'text-gray-500' : 'text-gray-900'">
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
      <svg class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      {{ items.filter(item => item.completed).length }} of {{ items.length }} items completed
    </div>
  </div>
</template>
