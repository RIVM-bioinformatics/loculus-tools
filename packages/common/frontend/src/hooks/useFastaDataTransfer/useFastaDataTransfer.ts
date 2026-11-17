import { container } from 'tsyringe';
import {
  useCallback,
  useEffect,
} from 'react';
import { WindowService } from '@gen-epix/ui-core/classes/services/WindowService';
import { StringUtil } from '@gen-epix/ui-core/utils/StringUtil';

const DATA_RECEIVER_CHANNEL_PARAM = 'data-receiver-channel';
const DATA_RECEIVER_READY_MESSAGE_TYPE = 'data-receiver-ready';
const IMPORT_DATA_MESSAGE_TYPE = 'import-data';

/**
 * FASTA content and its optional raw metadata exchanged between browser tabs.
 */
export interface FastaTransferData {
  /** FASTA text to load in the receiving application. */
  fasta: string;
  /** Raw metadata text, or `undefined` when no metadata is available. */
  metaData: string | undefined;
}

/**
 * Loads transfer data after the receiving tab has been opened.
 *
 * @returns FASTA and metadata for the transfer.
 * @throws Re-throws errors from the data-loading operation after aborting the handshake and
 * attempting to close the opened tab.
 */
export type FastaTransferDataLoader = () => Promise<FastaTransferData>;

/**
 * Optional receive-side configuration for {@link useFastaDataTransfer}.
 */
export interface UseFastaDataTransferProps {
  /**
   * Allowed sender origins for the `window.postMessage` transport.
   * This allowlist is not used for the same-origin BroadcastChannel transport.
   */
  allowedPostMessageOrigins?: string[];
  /**
   * Handles validated FASTA data received from the sender.
   * Supplying this callback enables receive-side listeners in the hook.
   */
  onDataReceived?: (data: FastaTransferData) => Promise<void>;
}

/**
 * Enables FASTA transfer between browser tabs, supporting both sender and receiver roles.
 *
 * With `onDataReceived`, the hook reads and removes the private channel parameter from the
 * current URL, registers receive listeners, and announces readiness through BroadcastChannel
 * and, when available, `window.opener`. Window messages are accepted only from an allowed
 * origin and the opener; BroadcastChannel messages use the per-transfer channel name.
 *
 * The returned sender opens the target before awaiting `loadData`, preserving browser user
 * activation. It uses BroadcastChannel when the target is same-origin and that API is
 * available, otherwise it falls back to `window.postMessage`. The transfer is sent once both
 * the data and the receiver-ready signal are available.
 *
 * @param options - Optional receive-side origin allowlist and data callback.
 * @returns A sender that accepts a target URL and an async data loader. The sender resolves
 * after loading data; if the receiver is not ready yet, the hook sends the data when it is.
 */
export const useFastaDataTransfer = ({
  allowedPostMessageOrigins,
  onDataReceived,
}: UseFastaDataTransferProps = {}) => {
  useEffect(() => {
    if (!onDataReceived) {
      return;
    }

    // The URL token identifies this transfer; remove it from the visible URL after reading it.
    const viewerUrl = new URL(window.location.href);
    const channelName = viewerUrl.searchParams.get(DATA_RECEIVER_CHANNEL_PARAM);
    viewerUrl.searchParams.delete(DATA_RECEIVER_CHANNEL_PARAM);
    if (channelName) {
      window.history.replaceState(window.history.state, '', `${viewerUrl.pathname}${viewerUrl.search}${viewerUrl.hash}`);
    }

    const broadcastChannel = channelName
      && /^loculus-data-[\da-f-]{36}$/i.test(channelName)
      && typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(channelName)
      : null;
    let importStarted = false;

    // Validate the payload before handing it to the application, and ignore duplicate deliveries.
    const handleImportData = async (data: unknown) => {
      if (importStarted) {
        return;
      }

      if (
        typeof data !== 'object'
        || data === null
        || !('type' in data)
        || data.type !== IMPORT_DATA_MESSAGE_TYPE
        || !('fasta' in data)
        || typeof data.fasta !== 'string'
      ) {
        if (!allowedPostMessageOrigins?.length) {
          console.warn(`Message received but no allowed origins are configured in 'config.allowedPostMessageOrigins'.`);
        } else {
          console.warn('Invalid message received. Check the message type and data.');
        }
        return;
      }

      importStarted = true;
      const metaData = 'metaData' in data && typeof data.metaData === 'string'
        ? data.metaData
        : undefined;
      await onDataReceived({ fasta: data.fasta, metaData });
      broadcastChannel?.close();
    };

    const handleWindowMessage = async (event: MessageEvent<unknown>) => {
      if (
        !allowedPostMessageOrigins?.includes(event.origin)
        || event.source !== window.opener
      ) {
        if (!allowedPostMessageOrigins?.length) {
          console.warn(`Message received from ${event.origin} but no allowed origins are configured in 'config.allowedPostMessageOrigins'.`);
        } else {
          console.warn(`Invalid message received. Check that ${event.origin} is one of ${allowedPostMessageOrigins.join(', ')}.`);
        }
        return;
      }

      await handleImportData(event.data);
    };
    const handleBroadcastMessage = async (event: MessageEvent<unknown>) => {
      if (
        typeof event.data !== 'object'
        || event.data === null
        || !('type' in event.data)
        || event.data.type !== IMPORT_DATA_MESSAGE_TYPE
      ) {
        return;
      }

      await handleImportData(event.data);
    };

    // Listen before announcing readiness so the sender cannot race the receiver setup.
    window.addEventListener('message', handleWindowMessage);
    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcastMessage);
      broadcastChannel.postMessage({ type: DATA_RECEIVER_READY_MESSAGE_TYPE });
    }
    const openerWindow = window.opener as null | Window;
    openerWindow?.postMessage({ type: DATA_RECEIVER_READY_MESSAGE_TYPE }, '*');

    return () => {
      window.removeEventListener('message', handleWindowMessage);
      broadcastChannel?.removeEventListener('message', handleBroadcastMessage);
      broadcastChannel?.close();
    };
  }, [allowedPostMessageOrigins, onDataReceived]);

  return useCallback(async (url: string, loadData: FastaTransferDataLoader) => {
    const viewerUrl = new URL(url);
    const viewerOrigin = viewerUrl.origin;
    const browserWindow = container.resolve(WindowService).window;
    let phylogenyViewerWindow: null | Window = null;
    // A private channel token enables same-origin transfer even when COOP clears window.opener.
    const channelName = viewerOrigin === browserWindow.location.origin && typeof BroadcastChannel !== 'undefined'
      ? `loculus-data-${StringUtil.createUuid()}`
      : null;
    const broadcastChannel = channelName ? new BroadcastChannel(channelName) : null;
    if (channelName) {
      viewerUrl.searchParams.set(DATA_RECEIVER_CHANNEL_PARAM, channelName);
    }

    let transferData: FastaTransferData | null = null;
    let readyTransport: 'broadcast' | 'window' | null = null;
    let hasSentData = false;
    const handshakeAbortController = new AbortController();
    // FASTA export and viewer startup are both asynchronous; send only after both are ready.
    const sendDataIfReady = () => {
      const targetWindow = phylogenyViewerWindow;
      if (readyTransport === null || transferData === null || hasSentData) {
        return;
      }

      const message = {
        fasta: transferData.fasta,
        metaData: transferData.metaData,
        type: IMPORT_DATA_MESSAGE_TYPE,
      };
      if (readyTransport === 'broadcast') {
        if (!broadcastChannel) {
          return;
        }
        broadcastChannel.postMessage(message);
      } else {
        if (!targetWindow) {
          return;
        }
        targetWindow.postMessage(message, viewerOrigin);
      }

      hasSentData = true;
      handshakeAbortController.abort();
      broadcastChannel?.close();
    };
    const markViewerReady = (transport: 'broadcast' | 'window') => {
      if (readyTransport !== null) {
        return;
      }
      readyTransport = transport;
      sendDataIfReady();
    };
    const handleWindowReady = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== viewerOrigin
        || event.source !== phylogenyViewerWindow
        || typeof event.data !== 'object'
        || event.data === null
        || !('type' in event.data)
        || event.data.type !== DATA_RECEIVER_READY_MESSAGE_TYPE
      ) {
        return;
      }

      markViewerReady('window');
    };
    const handleBroadcastReady = (event: MessageEvent<unknown>) => {
      if (
        typeof event.data !== 'object'
        || event.data === null
        || !('type' in event.data)
        || event.data.type !== DATA_RECEIVER_READY_MESSAGE_TYPE
      ) {
        return;
      }

      markViewerReady('broadcast');
    };

    browserWindow.addEventListener('message', handleWindowReady, { signal: handshakeAbortController.signal });
    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcastReady, { signal: handshakeAbortController.signal });
    }
    // Open synchronously before loading data so the browser retains the click's user activation.
    phylogenyViewerWindow = browserWindow.open(viewerUrl.toString());
    if (!phylogenyViewerWindow && !broadcastChannel) {
      handshakeAbortController.abort();
      return;
    }

    try {
      transferData = await loadData();
      sendDataIfReady();
    } catch (error) {
      handshakeAbortController.abort();
      broadcastChannel?.close();
      phylogenyViewerWindow?.close();
      throw error;
    }
  }, []);
};
