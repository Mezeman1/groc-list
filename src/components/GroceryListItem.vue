<script setup lang="ts">
import { computed } from 'vue'
import type { GroceryItem } from '@/types/firebase'

const props = defineProps<{
    item: GroceryItem
    isDraggable: boolean
}>()

const emit = defineEmits<{
    (e: 'toggleComplete', itemId: string, completed: boolean): void
    (e: 'deleteItem', itemId: string): void
}>()

const handleToggleComplete = () => {
    emit('toggleComplete', props.item.id, !props.item.completed)
}

const handleDeleteItem = () => {
    emit('deleteItem', props.item.id)
}

const displayPrice = computed(() => {
    if (!props.item.estimatedPrice) return null
    return props.item.estimatedPrice.toFixed(2)
})

const displayQuantity = computed(() => {
    const quantity = props.item.quantity
    const unit = props.item.unit ? props.item.unit : ''
    return `× ${quantity} ${unit}`
})
</script>

<template>
    <div class="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group"
        :class="{ 'bg-gray-50': item.completed }">
        <div class="flex items-center space-x-3 flex-1">
            <div class="flex items-center gap-2">
                <button v-if="isDraggable"
                    class="drag-handle p-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-move touch-manipulation flex items-center justify-center">
                    <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                    </svg>
                    <span class="sr-only">Drag to reorder</span>
                </button>
                <div class="flex items-center h-5">
                    <input :id="item.id" type="checkbox" :checked="item.completed" @change="handleToggleComplete"
                        class="h-5 w-5 text-pink-600 focus:ring-pink-500 border-gray-300 rounded cursor-pointer" />
                </div>
            </div>
            <div class="flex flex-col sm:flex-row sm:items-center sm:gap-3 flex-1">
                <div class="flex items-center gap-2 flex-1">
                    <label :for="item.id" class="text-gray-900 cursor-pointer select-none flex-1">
                        {{ item.name }}
                        <span v-if="item.category"
                            class="inline-flex items-center ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                            {{ item.category }}
                        </span>
                        <!-- Notes indicator if present -->
                        <span v-if="item.note" class="ml-1 text-gray-500 text-xs" title="Has notes">
                            <svg class="inline-block h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                        </span>
                    </label>
                    <div class="flex items-center gap-1 text-gray-500">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                        </svg>
                        <span class="inline-flex items-center px-2 py-0.5 text-sm font-medium">
                            {{ displayQuantity }}
                        </span>
                        <span v-if="displayPrice"
                            class="inline-flex items-center px-2 py-0.5 text-sm font-medium text-green-800">
                            ${{ displayPrice }}
                        </span>
                    </div>
                </div>
                <!-- Item notes if present -->
                <div v-if="item.note" class="text-sm text-gray-500 flex items-start gap-1 ml-5 mt-1 italic">
                    <span>{{ item.note }}</span>
                </div>
                <div v-if="item.storeAisle" class="text-sm text-gray-500">
                    <span class="inline-flex items-center gap-1">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        Aisle {{ item.storeAisle }}
                    </span>
                </div>
            </div>
        </div>
        <button @click="handleDeleteItem"
            class="ml-4 text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 focus:outline-none">
            <span class="sr-only">Delete item</span>
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        </button>
    </div>
</template>
