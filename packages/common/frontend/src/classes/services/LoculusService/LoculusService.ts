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
      this.keycloak = new Keycloak({
        clientId: authClientId,
        realm: authRealm,
        url: authEndpoint,
      });
      this.keycloak.onAuthLogout = () => {
        console.log('Keycloak logged out');
        this.next({
          authenticated: false,
        });
      };

      authenticated = await this.keycloak.init({
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

  public async reviseSequences(fasta: string, metaData: MetadataParseResult, returnUrl: string, organism: string): Promise<void> {
    console.log('Revising sequences with fasta:', fasta);
    console.log('Revising sequences with metadata:', metaData);
    console.log('Revising sequences with returnUrl:', returnUrl);
    console.log('Revising sequences with organism:', organism);

    const groupId = MetaDataUtil.getGroupId(metaData);

    const parsedFasta = FastaUtil.parseFasta(fasta);
    if (parsedFasta.error) {
      throw new Error(parsedFasta.error);
    }

    const matchingSequences = parsedFasta.sequences.filter((sequence) => (
      Object.values(metaData.recordsByColumn).some((recordsByValue) => recordsByValue[sequence.id])
    ));
    const matchingIds = new Set(matchingSequences.map((sequence) => sequence.id));
    const metadataRows = metaData.records.filter((record) => (
      Object.values(record).some((value) => matchingIds.has(value))
    ));
    const revisedFasta = matchingSequences
      .map((sequence) => `>${sequence.header}\n${sequence.sequence}`)
      .join('\n');
    const revisedMetadata = [
      metaData.columns.join('\t'),
      ...metadataRows.map((record) => metaData.columns.map((column) => record[column] ?? '').join('\t')),
    ].join('\n');

    const body = new FormData();
    body.append('sequenceFile', new File([revisedFasta], 'sequences.fasta', { type: 'text/plain' }));
    body.append(
      'metadataFile',
      new File([revisedMetadata], 'metadata.tsv', { type: 'text/tab-separated-values' }),
    );

    const url = `${returnUrl.replace(/\/$/, '')}/${encodeURIComponent(organism)}/revise?${new URLSearchParams({
      dataUseTermsType: 'OPEN',
      groupId,
    })}`;

    const response = await this.keycloak?.fetch(url, {
      body,
      method: 'POST',
    });

    if (!response?.ok) {
      const errorText = await response?.text();
      throw new Error(`Failed to revise sequences: ${errorText}`);
    }
  }
}
