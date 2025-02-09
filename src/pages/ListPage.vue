<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { addItemToList, getListItems, toggleItemComplete, deleteItem } from '@/services/firebase-service'
import type { GroceryItem } from '@/types/firebase'

const route = useRoute()
const auth = useAuthStore()
const items = ref<GroceryItem[]>([])
const newItemName = ref('')
const newItemQuantity = ref(1)
const error = ref('')

const listId = route.params.id as string

onMounted(async () => {
  await loadItems()
})

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
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Error Message -->
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {{ error }}
    </div>

    <!-- Add Item Form -->
    <div class="bg-white shadow-sm rounded-lg p-4 mb-6">
      <form @submit.prevent="handleAddItem" class="flex space-x-4">
        <div class="flex-1">
          <label for="itemName" class="sr-only">Item Name</label>
          <input
            id="itemName"
            v-model="newItemName"
            type="text"
            required
            placeholder="Add new item"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div class="w-24">
          <label for="quantity" class="sr-only">Quantity</label>
          <input
            id="quantity"
            v-model.number="newItemQuantity"
            type="number"
            min="1"
            required
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Add Item
        </button>
      </form>
    </div>

    <!-- Items List -->
    <div class="bg-white shadow-sm rounded-lg divide-y">
      <div
        v-for="item in items"
        :key="item.id"
        class="p-4 flex items-center justify-between hover:bg-gray-50"
        :class="{ 'bg-gray-50': item.completed }"
      >
        <div class="flex items-center space-x-3">
          <input
            :id="item.id"
            type="checkbox"
            :checked="item.completed"
            @change="handleToggleComplete(item.id, !item.completed)"
            class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label :for="item.id" class="flex items-center space-x-3">
            <span
              class="text-gray-900"
              :class="{ 'line-through text-gray-500': item.completed }"
            >
              {{ item.name }}
            </span>
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="item.completed ? 'bg-gray-100 text-gray-800' : 'bg-indigo-100 text-indigo-800'"
            >
              {{ item.quantity }}
            </span>
          </label>
        </div>
        <button
          @click="handleDeleteItem(item.id)"
          class="text-red-600 hover:text-red-900 focus:outline-none"
        >
          <span class="sr-only">Delete item</span>
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      <!-- Empty State -->
      <div v-if="items.length === 0" class="p-4 text-center text-gray-500">
        No items in this list yet. Add some items to get started!
      </div>
    </div>
  </div>
</template>
