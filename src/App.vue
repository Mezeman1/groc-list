<script setup lang="ts">
// See vite.config.ts for details about automatic imports
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import NavBar from '@/components/NavBar.vue'

const route = useRoute()
const auth = useAuthStore()

useHead({
  title: () => route.meta.title || 'Groc List',
  meta: [
    {
      property: 'og:title',
      content: () => route.meta.title,
    },
    {
      name: 'twitter:title',
      content: () => route.meta.title,
    },
  ],
})
</script>

<template>
  <div v-if="!auth.isInitialized" class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
  <div v-else class="min-h-screen bg-gray-100">
    <NavBar />
    <div class="py-4">
      <router-view />
    </div>
  </div>
</template>
