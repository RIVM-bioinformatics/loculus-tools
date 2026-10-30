import { container } from 'tsyringe';
import { SearchBar } from '@rivm-loculus-tools/common-frontend/components/ui/SearchBar';
import { useCallback } from 'react';
import { useStore } from 'zustand';

import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';
import { SequenceEditorEventBusService } from '../../../classes/services/SequenceEditorEventBusService';

export const SequenceEditorSearchBar = () => {
  const setSearchQuery = useStore(sequenceEditorStore, (state) => state.setSearchQuery);
  const setSearchHighlightedIndex = useStore(sequenceEditorStore, (state) => state.setSearchResultHighlightedIndex);
  const searchQuery = useStore(sequenceEditorStore, (state) => state.searchQuery);
  const searchResults = useStore(sequenceEditorStore, (state) => state.searchResult);
  const searchHighlightedIndex = useStore(sequenceEditorStore, (state) => state.searchResultHighlightedIndex);

  const onSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    container.resolve(SequenceEditorEventBusService).emit('onSearch', query);
  }, [setSearchQuery]);

  const onHighlightedIndexChange = useCallback((index: number) => {
    setSearchHighlightedIndex(index);
  }, [setSearchHighlightedIndex]);

  return (
    <SearchBar
      allowNavigation
      highlightedIndex={searchHighlightedIndex}
      numResults={searchResults?.num_matches}
      onHighlightedIndexChange={onHighlightedIndexChange}
      onSearchQueryChange={onSearchQueryChange}
      searchQuery={searchQuery}
      truncated={searchResults?.truncated}
    />
  );
};
