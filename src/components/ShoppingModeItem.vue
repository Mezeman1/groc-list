<script setup lang="ts">
import { computed } from 'vue'
import type { GroceryItem } from '@/types/firebase'

const props = defineProps<{
    item: GroceryItem
}>()

const emit = defineEmits<{
    (e: 'toggleComplete', itemId: string, completed: boolean): void
}>()

const handleToggleComplete = () => {
    emit('toggleComplete', props.item.id, !props.item.completed)
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

// Add animation classes based on completed state
const animationClasses = computed(() => {
    if (props.item.completed) {
        return 'opacity-75 scale-98 translate-x-1'
    }
    return 'opacity-100 scale-100 translate-x-0'
})
</script>

<template>
    <div @click="handleToggleComplete"
        class="p-4 flex items-center justify-between hover:bg-gray-50 transition-all duration-300 cursor-pointer"
        :class="[
            item.completed ? 'bg-green-50' : 'bg-white',
            animationClasses
        ]">
        <div class="flex items-center space-x-3 flex-1">
            <div class="flex-shrink-0">
                <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                    :class="item.completed ? 'border-green-500 bg-green-500' : 'border-gray-300'">
                    <svg v-if="item.completed" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            </div>

            <div class="flex flex-col">
                <div class="flex items-center gap-2">
                    <span
                        :class="{ 'line-through text-gray-500 font-medium': item.completed, 'font-medium': !item.completed }"
                        class="transition-all">
                        {{ item.name }}
                    </span>
                    <span class="text-sm text-gray-500">
                        {{ displayQuantity }}
                    </span>
                </div>

                <!-- Item notes in shopping mode -->
                <div v-if="item.note" class="text-xs text-gray-500 italic mb-1">
                    {{ item.note }}
                </div>

                <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span v-if="displayPrice" class="flex items-center gap-1">
                        <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        ${{ displayPrice }}
                    </span>

                    <span v-if="item.storeAisle" class="flex items-center gap-1">
                        <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        Aisle {{ item.storeAisle }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
