import { createRouter, createWebHistory } from 'vue-router'
import { auth } from './firebase'
import { useAuthStore } from '@/stores/auth'

import IndexPage from '@/pages/IndexPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import ListPage from '@/pages/ListPage.vue'

const routes = [
  {
    path: '/',
    component: IndexPage,
    meta: {
      title: 'Groc List',
      requiresAuth: true,
    },
  },
  {
    path: '/list/:id',
    component: ListPage,
    meta: {
      title: 'List Details - Groc List',
      requiresAuth: true,
    },
  },
  {
    path: '/login',
    component: LoginPage,
    meta: {
      title: 'Login - Groc List',
      requiresAuth: false,
    },
  },
  {
    path: '/register',
    component: RegisterPage,
    meta: {
      title: 'Register - Groc List',
      requiresAuth: false,
    },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  // Wait for auth to initialize before proceeding
  if (!authStore.isInitialized) {
    // Create a promise that resolves when auth is initialized
    await new Promise<void>(resolve => {
      const unwatch = authStore.$subscribe((mutation, state) => {
        if (state.isInitialized) {
          unwatch()
          resolve()
        }
      })
    })
  }

  const isAuthenticated = authStore.user !== null

  if (requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (!requiresAuth && isAuthenticated && (to.path === '/login' || to.path === '/register')) {
    next('/')
  } else {
    next()
  }
})

export default router
