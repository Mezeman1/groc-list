<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getPendingInvitations, respondToInvitation } from '@/services/firebase-service'
import type { ListInvitation } from '@/types/firebase'

const invitations = ref<ListInvitation[]>([])
const isOpen = ref(false)
const error = ref('')
const loading = ref(true)

const emit = defineEmits<{
    (e: 'invitationAccepted'): void
}>()

onMounted(async () => {
    await loadInvitations()
})

const loadInvitations = async () => {
    try {
        loading.value = true
        invitations.value = await getPendingInvitations()
    } catch (e: any) {
        error.value = e.message
    } finally {
        loading.value = false
    }
}

const handleResponse = async (invitationId: string, accept: boolean) => {
    try {
        await respondToInvitation(invitationId, accept)
        if (accept) {
            emit('invitationAccepted')
        }
        await loadInvitations()
    } catch (e: any) {
        error.value = e.message
    }
}
</script>

<template>
    <div class="relative">
        <button @click="isOpen = !isOpen"
            class="relative p-2 text-gray-400 hover:text-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-gray-800">
            <span class="sr-only">View invitations</span>
            <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span v-if="invitations.length > 0"
                class="absolute top-0 right-0 block h-2 w-2 rounded-full bg-pink-500 ring-2 ring-white" />
        </button>

        <div v-if="isOpen"
            class="fixed inset-x-0 top-16 mx-4 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:w-80 sm:mx-0 sm:mt-2 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
            <div class="px-4 py-2 text-sm text-gray-700 border-b flex items-center gap-2">
                <svg class="h-5 w-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 class="font-medium">List Invitations</h3>
            </div>

            <div v-if="loading" class="px-4 py-2 text-sm text-gray-500">
                Loading invitations...
            </div>

            <div v-else-if="error" class="px-4 py-2 text-sm text-red-600">
                {{ error }}
            </div>

            <div v-else-if="invitations.length === 0" class="px-4 py-2 text-sm text-gray-500">
                No pending invitations
            </div>

            <div v-else class="max-h-[calc(100vh-12rem)] sm:max-h-96 overflow-y-auto">
                <div v-for="invitation in invitations" :key="invitation.id"
                    class="px-4 py-3 hover:bg-gray-50 border-b last:border-b-0">
                    <div class="flex flex-col space-y-1">
                        <p class="text-sm font-medium text-gray-900 break-words flex items-center gap-2">
                            <svg class="h-4 w-4 text-pink-600 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                                stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {{ invitation.listName }}
                        </p>
                        <p class="text-xs text-gray-500 break-words flex items-center gap-1">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Invited by {{ invitation.invitedByEmail }}
                        </p>
                        <div class="flex flex-col sm:flex-row gap-2 mt-2">
                            <button @click="handleResponse(invitation.id, true)"
                                class="w-full bg-pink-600 text-white px-3 py-1 rounded-md text-sm hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 flex items-center justify-center gap-1">
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M5 13l4 4L19 7" />
                                </svg>
                                Accept
                            </button>
                            <button @click="handleResponse(invitation.id, false)"
                                class="w-full bg-white text-gray-700 px-3 py-1 border rounded-md text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-pink-500 flex items-center justify-center gap-1">
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
