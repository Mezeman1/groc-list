<script setup lang="ts">
import { ref } from 'vue'
import ItemSuggestions from '@/components/ItemSuggestions.vue'

const props = defineProps<{
    listId: string
}>()

const emit = defineEmits<{
    (e: 'addItem', itemName: string, quantity: number, options: {
        category?: string,
    }): void
    (e: 'suggestionSelect', suggestion: string): void
}>()

const newItemName = ref('')
const newItemQuantity = ref(1)
const newItemCategory = ref('')

const handleAddItem = () => {
    const itemName = newItemName.value.trim()
    if (!itemName) return

    // Store input values in local variables
    const quantity = newItemQuantity.value
    const category = newItemCategory.value

    // Clear form immediately
    newItemName.value = ''
    newItemQuantity.value = 1
    newItemCategory.value = ''

    // Emit the event with all the item data
    emit('addItem', itemName, quantity, {
        category
    })
}

const handleSuggestionSelect = (suggestion: string) => {
    newItemName.value = suggestion
    emit('suggestionSelect', suggestion)
    handleAddItem()
}
</script>

<template>
    <div class="bg-white shadow-sm rounded-lg p-4 mb-6">
        <form @submit.prevent="handleAddItem()" class="flex flex-col gap-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="sm:col-span-2">
                    <label for="itemName" class="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                    <input id="itemName" v-model="newItemName" type="text" required placeholder="Add new item"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500" />
                </div>
                <div>
                    <label for="quantity" class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input id="quantity" v-model.number="newItemQuantity" type="number" min="1" required
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500" />
                </div>
            </div>

            <div>
                <label for="category" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select id="category" v-model="newItemCategory"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500">
                    <option value="">None</option>
                    <option value="Produce">Produce</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Meat">Meat</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Frozen">Frozen</option>
                    <option value="Pantry">Pantry</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Household">Household</option>
                    <option value="Other">Other</option>
                </select>
            </div>

            <div class="flex justify-end">
                <button type="submit"
                    class="bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 flex items-center justify-center gap-2">
                    Add to List
                </button>
            </div>
        </form>

        <!-- Add ItemSuggestions component -->
        <ItemSuggestions :list-id="listId" @select="handleSuggestionSelect" />
    </div>
</template>
