import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from 'firebase/auth'
import { loginWithEmail, registerWithEmail, loginWithGoogle, logout, onAuthStateChange } from '@/services/auth-service'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const isInitialized = ref(false)

  // Initialize auth state listener
  onAuthStateChange(newUser => {
    user.value = newUser
    loading.value = false
    isInitialized.value = true
  })

  const login = async (email: string, password: string) => {
    try {
      error.value = null
      loading.value = true
      await loginWithEmail(email, password)
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  const register = async (email: string, password: string) => {
    try {
      error.value = null
      loading.value = true
      await registerWithEmail(email, password)
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  const loginGoogle = async () => {
    try {
      error.value = null
      loading.value = true
      await loginWithGoogle()
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  const logoutUser = async () => {
    try {
      error.value = null
      loading.value = true
      await logout()
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    loading,
    error,
    isInitialized,
    login,
    register,
    loginGoogle,
    logoutUser,
  }
})
