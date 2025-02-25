<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
    isActive: boolean
}>()

const emit = defineEmits<{
    (e: 'toggle'): void
}>()

const showTooltip = ref(false)

const toggleTooltip = () => {
    showTooltip.value = !showTooltip.value
}
</script>

<template>
    <div class="relative">
        <!-- Info Button -->
        <button @click="toggleTooltip"
            class="absolute -top-1 -right-1 z-10 bg-gray-100 rounded-full p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            title="About Shopping Mode">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </button>

        <!-- Shopping Mode Toggle Button -->
        <button @click="$emit('toggle')"
            class="relative flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors overflow-hidden"
            :class="isActive
                ? 'bg-pink-600 text-white shadow hover:bg-pink-700 border border-pink-700'
                : 'bg-white text-pink-600 hover:bg-pink-50 border border-pink-200'">
            <span class="font-medium">Shopping Mode</span>
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        </button>

        <!-- Info Tooltip -->
        <div v-if="showTooltip"
            class="absolute right-0 top-12 w-64 bg-white rounded-md shadow-lg p-3 border z-20 text-sm text-gray-700 mt-1">
            <div class="font-medium text-gray-900 mb-1">Shopping Mode</div>
            <p class="mb-2">
                Shopping Mode organizes your items by category and aisle for easier in-store shopping.
            </p>
            <ul class="list-disc list-inside text-xs space-y-1 mb-2">
                <li>Items are grouped by category & store aisle</li>
                <li>Quickly add missed items while shopping</li>
                <li>Tap any item to mark as collected</li>
            </ul>
            <button @click="toggleTooltip" class="text-xs text-pink-600 hover:text-pink-800">
                Close
            </button>
        </div>
    </div>
</template>
