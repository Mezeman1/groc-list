<script setup lang="ts">
import { ref } from 'vue'
import GroceryLists from '@/components/GroceryLists.vue'
import UserManagement from '@/components/UserManagement.vue'

const activeTab = ref('lists')
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Tabs -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="-mb-px flex space-x-8" aria-label="Tabs">
        <button @click="activeTab = 'lists'"
          class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2"
          :class="[
            activeTab === 'lists'
              ? 'border-pink-500 text-pink-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Grocery Lists
        </button>
        <button @click="activeTab = 'profile'"
          class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2"
          :class="[
            activeTab === 'profile'
              ? 'border-pink-500 text-pink-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Profile
        </button>
      </nav>
    </div>

    <!-- Tab Panels -->
    <div v-if="activeTab === 'lists'">
      <GroceryLists />
    </div>
    <div v-else-if="activeTab === 'profile'">
      <UserManagement />
    </div>
  </div>
</template>
