<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { GroceryList, User } from '@/types/firebase'
import ShoppingModeToggle from './ShoppingModeToggle.vue'

const props = defineProps<{
    list: GroceryList | null
    itemCount: number
    isOwner: boolean
    members: User[]
    isShoppingMode: boolean
}>()

const emit = defineEmits<{
    (e: 'toggleShoppingMode'): void
    (e: 'removeMember', userId: string): void
}>()

const router = useRouter()
const showMembersMenu = ref(false)

const handleBack = () => {
    router.push('/')
}

const handleRemoveMember = (userId: string) => {
    if (!confirm('Are you sure you want to remove this member from the list?')) {
        return
    }
    emit('removeMember', userId)
}
</script>

<template>
    <div class="mb-6">
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
                <button @click="handleBack"
                    class="text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <div>
                    <div class="flex items-center gap-2">
                        <svg class="h-6 w-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <h1 class="text-2xl font-bold text-gray-900">{{ list?.name || 'Loading...' }}</h1>
                    </div>
                    <div class="flex items-center gap-3 mt-1">
                        <p class="text-sm text-gray-500 flex items-center gap-1">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2M7 7h10" />
                            </svg>
                            {{ itemCount }} items
                        </p>
                        <div v-if="isOwner" class="flex items-center -space-x-2">
                            <template v-for="member in members.slice(0, 3)" :key="member.uid">
                                <div class="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600"
                                    :title="member.email">
                                    {{ member.email?.[0].toUpperCase() }}
                                </div>
                            </template>
                            <div v-if="members.length > 3"
                                class="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                                +{{ members.length - 3 }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Members Menu Button -->
            <div class="relative" v-if="isOwner && members.length > 0">
                <button @click="showMembersMenu = !showMembersMenu"
                    class="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                </button>

                <!-- Members Dropdown -->
                <div v-if="showMembersMenu"
                    class="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-10 py-1 border">
                    <div class="px-4 py-2 border-b flex items-center justify-between">
                        <h3 class="text-sm font-medium text-gray-900">List Members</h3>
                        <div v-if="isOwner" class="text-xs text-pink-600">Owner</div>
                    </div>
                    <div class="max-h-64 overflow-y-auto">
                        <div v-for="member in members" :key="member.uid"
                            class="px-4 py-2 hover:bg-gray-50 flex items-center justify-between group">
                            <div class="flex items-center gap-2">
                                <div
                                    class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                                    {{ member.email?.[0].toUpperCase() }}
                                </div>
                                <div>
                                    <div class="text-sm font-medium text-gray-900">
                                        {{ member.email }}
                                    </div>
                                    <div v-if="member.uid === list?.createdBy" class="text-xs text-pink-600">
                                        Owner
                                    </div>
                                </div>
                            </div>
                            <button v-if="isOwner && member.uid !== list?.createdBy"
                                @click="handleRemoveMember(member.uid)"
                                class="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span class="sr-only">Remove member</span>
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Shopping Mode Toggle - Now more prominent -->
        <div class="mt-4 flex justify-end">
            <ShoppingModeToggle :is-active="isShoppingMode" @toggle="$emit('toggleShoppingMode')" />
        </div>
    </div>
</template>
