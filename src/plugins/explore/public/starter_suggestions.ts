/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Store, Unsubscribe } from 'redux';
import {
  ChatPluginSetup,
  StarterSuggestionItem,
  StarterSuggestionsContext,
} from '../../chat/public';
import { RootState } from './application/utils/state_management/store';
import { QueryExecutionStatus } from './application/utils/state_management/types';
import {
  selectOverallQueryStatus,
  selectQueryString,
} from './application/utils/state_management/selectors';
import { PLUGIN_ID, ExploreFlavor } from '../common';

/**
 * All app IDs Explore registers (base + per-flavor). currentAppId$ emits
 * these exact strings — e.g. 'explore/logs' on the Logs page, not 'explore'.
 */
const EXPLORE_APP_IDS = [
  PLUGIN_ID,
  `${PLUGIN_ID}/${ExploreFlavor.Logs}`,
  `${PLUGIN_ID}/${ExploreFlavor.Traces}`,
  `${PLUGIN_ID}/${ExploreFlavor.Metrics}`,
];

export function registerExploreStarterSuggestions(chat: ChatPluginSetup) {
  let currentStore: Store<RootState> | undefined;
  let storeUnsubscribe: Unsubscribe | undefined;
  let lastKnownStatus: QueryExecutionStatus | undefined;

  const registration = chat.starterSuggestions.registerProvider({
    id: 'explore',
    appId: EXPLORE_APP_IDS,
    getSuggestions: (context: StarterSuggestionsContext): StarterSuggestionItem[] => {
      if (!currentStore) {
        return context.defaults;
      }

      const state = currentStore.getState();
      const queryStatus = selectOverallQueryStatus(state);
      const queryText = selectQueryString(state);

      switch (queryStatus?.status) {
        case QueryExecutionStatus.ERROR:
          return [
            {
              id: 'fixQueryError',
              icon: 'alert',
              iconColor: 'danger',
              text: 'Fix this query error',
              prompt: queryText
                ? `My query "${queryText}" failed with error: "${
                    queryStatus.error?.message?.reason ??
                    queryStatus.error?.originalErrorMessage ??
                    'unknown error'
                  }". Help me fix it.`
                : 'My query failed. Help me understand the error and fix it.',
            },
          ];

        case QueryExecutionStatus.NO_RESULTS:
          return [
            {
              id: 'explainNoResults',
              icon: 'help',
              text: 'Why did my query return no results?',
              prompt: queryText
                ? `My query "${queryText}" returned no results. Help me understand why.`
                : 'My query returned no results. Help me understand why.',
            },
          ];

        case QueryExecutionStatus.READY:
          return [
            {
              id: 'summarizeResults',
              icon: 'visBarVertical',
              text: 'Summarize these results',
              prompt: queryText
                ? `Summarize the results for query: ${queryText}`
                : 'Summarize the current query results.',
            },
          ];

        default:
          return context.defaults;
      }
    },
  });

  return {
    registration,
    setStore: (store: Store<RootState>) => {
      currentStore = store;
      lastKnownStatus = selectOverallQueryStatus(store.getState())?.status;

      storeUnsubscribe = store.subscribe(() => {
        const newStatus = selectOverallQueryStatus(store.getState())?.status;
        if (newStatus !== lastKnownStatus) {
          lastKnownStatus = newStatus;
          registration?.invalidate();
        }
      });
    },
    clearStore: () => {
      storeUnsubscribe?.();
      storeUnsubscribe = undefined;
      currentStore = undefined;
      lastKnownStatus = undefined;
    },
  };
}
