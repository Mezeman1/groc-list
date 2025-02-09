<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getUserById } from '@/services/firebase-service'
import type { User } from '@/types/firebase'

const auth = useAuthStore()
const currentUser = ref<User | null>(null)
const error = ref('')
const loading = ref(true)

onMounted(async () => {
  if (auth.user?.uid) {
    try {
      currentUser.value = await getUserById(auth.user.uid)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }
})
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div class="bg-white shadow-sm rounded-lg p-6">
      <h2 class="text-lg font-medium mb-6 flex items-center gap-2">
        <svg class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Profile
      </h2>

      <div v-if="loading" class="text-gray-500">
        Loading profile...
      </div>

      <div v-else-if="error" class="text-red-600">
        {{ error }}
      </div>

      <div v-else-if="currentUser" class="space-y-6">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-2xl">
            <template v-if="currentUser.photoURL">
              <img :src="currentUser.photoURL" :alt="currentUser.displayName || currentUser.email"
                class="w-full h-full rounded-full object-cover" />
            </template>
            <template v-else>
              {{ currentUser.email?.[0].toUpperCase() }}
            </template>
          </div>
          <div>
            <div class="font-medium text-gray-900">
              {{ currentUser.displayName || 'No display name set' }}
            </div>
            <div class="text-sm text-gray-500">
              {{ currentUser.email }}
            </div>
          </div>
        </div>

        <div class="border-t pt-6">
          <h3 class="text-sm font-medium text-gray-900 mb-4">Account Details</h3>
          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-sm font-medium text-gray-500">Email</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ currentUser.email }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Display Name</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ currentUser.displayName || 'Not set' }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Account Created</dt>
              <dd class="mt-1 text-sm text-gray-900">
                {{ auth.user?.metadata.creationTime ? new Date(auth.user.metadata.creationTime).toLocaleDateString() : 'Unknown' }}
              </dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Last Sign In</dt>
              <dd class="mt-1 text-sm text-gray-900">
                {{ auth.user?.metadata.lastSignInTime ? new Date(auth.user.metadata.lastSignInTime).toLocaleDateString() : 'Unknown' }}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </div>
</template>
