/* eslint-disable import-x/unambiguous */

declare module 'neighbor-joining' {
  export interface RapidNeighborJoiningInstance {
    getAsNewick(): string;
    run(): void;
  }

  export const RapidNeighborJoining: {
    new(
      distanceMatrix: number[][],
      taxa: string[],
      copyDistanceMatrix?: boolean,
      taxonIdAccessor?: (taxon: string) => string,
    ): RapidNeighborJoiningInstance;
  };
}
