<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getSuggestions } from '@/services/suggestions-service'

const props = defineProps<{
  listId: string
}>()

const emit = defineEmits<{
  (e: 'select', suggestion: string): void
}>()

const suggestions = ref<string[]>([])
const loading = ref(false)
const error = ref('')

const loadSuggestions = async () => {
  try {
    loading.value = true
    suggestions.value = await getSuggestions(props.listId)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(loadSuggestions)

// Reload suggestions when listId changes
watch(() => props.listId, loadSuggestions)

const handleSelect = (suggestion: string) => {
  emit('select', suggestion)
}
</script>

<template>
  <div v-if="suggestions.length > 0" class="mt-4">
    <h3 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
      <svg class="h-5 w-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      Suggested Items
    </h3>
    <div class="flex flex-wrap gap-2">
      <button v-for="suggestion in suggestions" :key="suggestion"
        @click="handleSelect(suggestion)"
        class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-pink-50 text-pink-700 hover:bg-pink-100 transition-colors">
        <svg class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ suggestion }}
      </button>
    </div>
  </div>
</template>
