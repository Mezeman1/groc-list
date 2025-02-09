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
            class="relative p-2 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
            <span class="sr-only">View invitations</span>
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span v-if="invitations.length > 0"
                class="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white" />
        </button>

        <div v-if="isOpen"
            class="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div class="px-4 py-2 text-sm text-gray-700 border-b">
                <h3 class="font-medium">Invitations</h3>
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

            <div v-else class="max-h-96 overflow-y-auto">
                <div v-for="invitation in invitations" :key="invitation.id"
                    class="px-4 py-3 hover:bg-gray-50 border-b last:border-b-0">
                    <div class="flex flex-col space-y-1">
                        <p class="text-sm font-medium text-gray-900">
                            {{ invitation.listName }}
                        </p>
                        <p class="text-xs text-gray-500">
                            Invited by {{ invitation.invitedByEmail }}
                        </p>
                        <div class="flex space-x-2 mt-2">
                            <button @click="handleResponse(invitation.id, true)"
                                class="flex-1 bg-indigo-600 text-white px-3 py-1 rounded-md text-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                Accept
                            </button>
                            <button @click="handleResponse(invitation.id, false)"
                                class="flex-1 bg-white text-gray-700 px-3 py-1 border rounded-md text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
