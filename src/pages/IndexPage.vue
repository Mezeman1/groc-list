<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { createList, getUserLists, inviteUserToList, deleteList, getSentInvitations } from '@/services/firebase-service'
import type { GroceryList, ListInvitation } from '@/types/firebase'
import InvitationDropdown from '@/components/InvitationDropdown.vue'

const auth = useAuthStore()
const lists = ref<GroceryList[]>([])
const newListName = ref('')
const showNewListForm = ref(false)
const newMemberEmail = ref('')
const selectedList = ref<string | null>(null)
const error = ref('')
const invitations = ref<{ [listId: string]: ListInvitation[] }>({})

onMounted(async () => {
  await loadLists()
})

const loadLists = async () => {
  try {
    lists.value = await getUserLists()
    // Load invitations for each list owned by the user
    for (const list of lists.value) {
      if (isListOwner(list)) {
        invitations.value[list.id] = await getSentInvitations(list.id)
      }
    }
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

const handleInviteMember = async () => {
  if (!selectedList.value || !newMemberEmail.value.trim()) return

  try {
    await inviteUserToList(selectedList.value, newMemberEmail.value.trim())
    newMemberEmail.value = ''
    await loadLists()
  } catch (e: any) {
    error.value = e.message
  }
}

const handleDeleteList = async (listId: string) => {
  if (!confirm('Are you sure you want to delete this list and all its items? This action cannot be undone.')) {
    return
  }

  try {
    await deleteList(listId)
    await loadLists()
  } catch (e: any) {
    error.value = e.message
  }
}

const isListOwner = (list: GroceryList) => {
  return auth.user?.uid === list.createdBy
}

const getPendingInvitationsCount = (listId: string) => {
  return invitations.value[listId]?.filter(inv => inv.status === 'pending').length || 0
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">My Grocery Lists</h1>
      <div class="flex items-center space-x-4">
        <InvitationDropdown @invitation-accepted="loadLists" />
        <button @click="showNewListForm = true"
          class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          Create New List
        </button>
      </div>
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
          <input id="listName" v-model="newListName" type="text" required
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
        </div>
        <div class="flex justify-end space-x-3">
          <button type="button" @click="showNewListForm = false"
            class="bg-white text-gray-700 px-4 py-2 border rounded-md hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
            Create List
          </button>
        </div>
      </form>
    </div>

    <!-- Lists Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="list in lists" :key="list.id"
        class="bg-white shadow-sm rounded-lg p-4 hover:shadow-md transition-shadow">
        <div class="flex justify-between items-start mb-2">
          <router-link :to="'/list/' + list.id" class="block">
            <h3 class="text-lg font-medium text-gray-900">{{ list.name }}</h3>
            <p class="text-sm text-gray-500 mt-1">{{ list.members.length }} members</p>
          </router-link>
          <button v-if="isListOwner(list)" @click="handleDeleteList(list.id)"
            class="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50" title="Delete list">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        <!-- Share List Form -->
        <div v-if="isListOwner(list)" class="mt-4 pt-4 border-t">
          <form @submit.prevent="selectedList = list.id; handleInviteMember()" class="flex space-x-2">
            <input v-model="newMemberEmail" type="email" placeholder="Invite by email"
              class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
            <button type="submit" class="bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 text-sm">
              Invite
            </button>
          </form>

          <!-- Pending Invitations -->
          <div v-if="getPendingInvitationsCount(list.id) > 0" class="mt-3">
            <p class="text-sm text-gray-500">
              {{ getPendingInvitationsCount(list.id) }} pending invitation(s)
            </p>
            <div class="mt-2 space-y-2">
              <div v-for="invitation in invitations[list.id]?.filter(inv => inv.status === 'pending')"
                :key="invitation.id" class="text-xs text-gray-500 flex items-center">
                <span class="flex-1">{{ invitation.invitedEmail }}</span>
                <span class="text-yellow-600">Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="lists.length === 0" class="text-center py-12 bg-white rounded-lg shadow-sm">
      <h3 class="text-lg font-medium text-gray-900 mb-2">No Lists Yet</h3>
      <p class="text-gray-500">Create your first grocery list to get started!</p>
    </div>
  </div>
</template>
