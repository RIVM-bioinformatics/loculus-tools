import { singleton } from 'tsyringe';
import { SubscribableAbstract } from '@gen-epix/ui-core/classes/abstracts/SubscribableAbstract';
import { Subject } from '@gen-epix/ui-core/classes/Subject';
import Keycloak from 'keycloak-js';

import type { MetadataParseResult } from '../../../models/metadata.models';
import { FastaUtil } from '../../../utils/FastaUtil';
import { MetaDataUtil } from '../../../utils/MetaDataUtil';

export type LoculusServiceSubject = {
  authenticated: boolean;
};

export type RevisedSequences = {
  addedSequencesWithoutMetadata: string[];
  fasta: string;
  groupId: string;
  metadata: string;
  removedSequences: string[];
  sequenceCount: number;
};

@singleton()
export class LoculusService extends SubscribableAbstract<LoculusServiceSubject> {
  public get code(): null | string {
    return this.keycloak?.idToken ?? null;
  }
  private keycloak: Keycloak | null = null;

  public constructor() {
    super(new Subject<LoculusServiceSubject>({
      authenticated: false,
    }));
  }

  public static createRevisedSequences(
    fasta: string,
    metaData: MetadataParseResult,
    rawFasta: string = fasta,
  ): RevisedSequences {
    const parsedFasta = FastaUtil.parseFasta(fasta);
    if (parsedFasta.error) {
      throw new Error(parsedFasta.error);
    }
    const parsedRawFasta = FastaUtil.parseFasta(rawFasta);
    if (parsedRawFasta.error) {
      throw new Error(parsedRawFasta.error);
    }

    const hasMetadataMatch = (sequenceId: string) => (
      Object.values(metaData.recordsByColumn).some((recordsByValue) => recordsByValue[sequenceId])
    );
    const editedSequenceIds = new Set(parsedFasta.sequences.map((sequence) => sequence.id));
    const originalSequenceIds = new Set(parsedRawFasta.sequences.map((sequence) => sequence.id));
    const matchingSequences = parsedFasta.sequences.filter((sequence) => hasMetadataMatch(sequence.id));
    const matchingIds = new Set(matchingSequences.map((sequence) => sequence.id));
    const metadataRows = metaData.records.filter((record) => (
      Object.values(record).some((value) => matchingIds.has(value))
    ));

    return {
      addedSequencesWithoutMetadata: parsedFasta.sequences
        .filter((sequence) => !originalSequenceIds.has(sequence.id) && !hasMetadataMatch(sequence.id))
        .map((sequence) => sequence.id),
      fasta: matchingSequences.map((sequence) => `>${sequence.header}\n${sequence.sequence}`).join('\n'),
      groupId: MetaDataUtil.getGroupId(metaData),
      metadata: [
        metaData.columns.join('\t'),
        ...metadataRows.map((record) => metaData.columns.map((column) => record[column] ?? '').join('\t')),
      ].join('\n'),
      removedSequences: parsedRawFasta.sequences
        .filter((sequence) => !editedSequenceIds.has(sequence.id))
        .map((sequence) => sequence.id),
      sequenceCount: matchingSequences.length,
    };
  }

  public clear(): void {
    this.keycloak = null;
    this.next({
      authenticated: false,
    });
  }

  public async init(kwArgs: { authClientId: string; authEndpoint: string; authRealm: string }): Promise<void> {
    const { authClientId, authEndpoint, authRealm } = kwArgs;
    let authenticated = false;

    try {
      const keycloak = new Keycloak({
        clientId: authClientId,
        realm: authRealm,
        url: authEndpoint,
      });
      this.keycloak = keycloak;
      keycloak.onAuthLogout = () => {
        console.log('Keycloak logged out');
        this.next({
          authenticated: false,
        });
      };
      keycloak.onTokenExpired = () => {
        if (this.keycloak !== keycloak) {
          return;
        }

        void keycloak.updateToken(-1).catch((error: unknown) => {
          console.error('Failed to refresh Keycloak token:', error);
          void keycloak.clearToken();
        });
      };

      authenticated = await keycloak.init({
        enableLogging: true,
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        silentCheckSsoFallback: false,
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        useNonce: true,
      });
      console.log('Keycloak initialized, authenticated:', authenticated);
    } catch (error) {
      console.error('Failed to initialize Keycloak:', error);
    }

    this.next({
      authenticated,
    });
  }

  public async reviseSequences(
    fasta: string,
    metaData: MetadataParseResult,
    returnUrl: string,
    organism: string,
    abortController: AbortController,
  ): Promise<void> {
    console.log('Revising sequences with fasta:', fasta);
    console.log('Revising sequences with metadata:', metaData);
    console.log('Revising sequences with returnUrl:', returnUrl);
    console.log('Revising sequences with organism:', organism);

    const revisedSequences = LoculusService.createRevisedSequences(fasta, metaData);

    const body = new FormData();
    body.append('sequenceFile', new File([revisedSequences.fasta], 'sequences.fasta', { type: 'text/plain' }));
    body.append(
      'metadataFile',
      new File([revisedSequences.metadata], 'metadata.tsv', { type: 'text/tab-separated-values' }),
    );

    const url = `${returnUrl.replace(/\/$/, '')}/${encodeURIComponent(organism)}/revise?${new URLSearchParams({
      dataUseTermsType: 'OPEN',
      groupId: revisedSequences.groupId,
    })}`;

    const response = await this.keycloak?.fetch(url, {
      body,
      method: 'POST',
      signal: abortController.signal,
    });

    if (!response?.ok) {
      if (response?.status === 401 || response?.status === 403) {
        throw new Error('Your Loculus session is no longer valid. Please log in to Loculus again in a separate tab, then try uploading again.');
      }

      const errorText = await response?.text();
      throw new Error(`Failed to revise sequences: ${errorText}`);
    }
  }
}
