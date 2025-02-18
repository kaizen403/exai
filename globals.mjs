// globals.mjs
export const globals = {
  vectorStore: null,
  globalRetriever: {
    similaritySearch: async (query, k) => {
      if (!globals.vectorStore) {
        console.error("No vector store available for retrieval.");
        return [];
      }
      return globals.vectorStore.similaritySearch(query, k);
    },
  },
};
