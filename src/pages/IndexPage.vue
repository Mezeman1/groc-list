<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { createList, getUserLists, addMemberToList } from '@/services/firebase-service'
import type { GroceryList } from '@/types/firebase'

const auth = useAuthStore()
const lists = ref<GroceryList[]>([])
const newListName = ref('')
const showNewListForm = ref(false)
const newMemberEmail = ref('')
const selectedList = ref<string | null>(null)
const error = ref('')

onMounted(async () => {
  await loadLists()
})

const loadLists = async () => {
  try {
    lists.value = await getUserLists()
  } catch (e: any) {
    error.value = e.message
  }
}

const handleCreateList = async () => {
  if (!newListName.value.trim()) return

  try {
    await createList(newListName.value.trim())
    newListName.value = ''
    showNewListForm.value = false
    await loadLists()
  } catch (e: any) {
    error.value = e.message
  }
}

const handleAddMember = async () => {
  if (!selectedList.value || !newMemberEmail.value.trim()) return

  try {
    await addMemberToList(selectedList.value, newMemberEmail.value.trim())
    newMemberEmail.value = ''
    await loadLists()
  } catch (e: any) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">My Grocery Lists</h1>
      <button
        @click="showNewListForm = true"
        class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        Create New List
      </button>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {{ error }}
    </div>

    <!-- New List Form -->
    <div v-if="showNewListForm" class="bg-white shadow-sm rounded-lg p-4 mb-6">
      <h2 class="text-lg font-medium mb-4">Create New List</h2>
      <form @submit.prevent="handleCreateList" class="space-y-4">
        <div>
          <label for="listName" class="block text-sm font-medium text-gray-700">List Name</label>
          <input
            id="listName"
            v-model="newListName"
            type="text"
            required
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div class="flex justify-end space-x-3">
          <button
            type="button"
            @click="showNewListForm = false"
            class="bg-white text-gray-700 px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Create List
          </button>
        </div>
      </form>
    </div>

    <!-- Lists Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="list in lists"
        :key="list.id"
        class="bg-white shadow-sm rounded-lg p-4 hover:shadow-md transition-shadow"
      >
        <router-link :to="'/list/' + list.id" class="block">
          <h3 class="text-lg font-medium text-gray-900">{{ list.name }}</h3>
          <p class="text-sm text-gray-500 mt-1">{{ list.members.length }} members</p>
        </router-link>

        <!-- Share List Form -->
        <div class="mt-4 pt-4 border-t">
          <form @submit.prevent="selectedList = list.id; handleAddMember()" class="flex space-x-2">
            <input
              v-model="newMemberEmail"
              type="email"
              placeholder="Add member by email"
              class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            />
            <button
              type="submit"
              class="bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 text-sm"
            >
              Share
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="lists.length === 0"
      class="text-center py-12 bg-white rounded-lg shadow-sm"
    >
      <h3 class="text-lg font-medium text-gray-900 mb-2">No Lists Yet</h3>
      <p class="text-gray-500">Create your first grocery list to get started!</p>
    </div>
  </div>
</template>
