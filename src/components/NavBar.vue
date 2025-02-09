<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const handleLogout = async () => {
  try {
    await auth.logoutUser()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}
</script>

<template>
  <nav class="bg-pink-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <router-link to="/" class="text-white font-bold text-xl">Groc List</router-link>
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <template v-if="auth.user">
            <span class="text-pink-100">{{ auth.user.email }}</span>
            <button @click="handleLogout"
              class="bg-pink-800 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-pink-900 focus:ring-pink-500">
              Logout
            </button>
          </template>
          <template v-else>
            <router-link to="/login"
              class="text-pink-100 hover:bg-pink-800 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
              Login
            </router-link>
            <router-link to="/register"
              class="text-pink-100 hover:bg-pink-800 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
              Register
            </router-link>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>
