import { useCallback } from 'react';
import { useStore } from 'zustand';
import { SearchBar } from '@rivm-loculus-tools/common-frontend/components/ui/SearchBar';

import { phylogenyViewerStore } from '../../../stores/phylogenyViewerStore';

export const PhylogenyViewerSearchBar = () => {
  const searchQuery = useStore(phylogenyViewerStore, (state) => state.searchQuery);
  const setSearchQuery = useStore(phylogenyViewerStore, (state) => state.setSearchQuery);
  const highlightedIds = useStore(phylogenyViewerStore, (state) => state.highlightedIds);

  const onSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, [setSearchQuery]);

  return (
    <SearchBar
      numResults={highlightedIds?.length}
      onSearchQueryChange={onSearchQueryChange}
      searchQuery={searchQuery}
    />
  );
};
